import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, ElementRef, ViewChild, effect, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ReplacementItem, TeamAccessRequestItem, TeamListItem, UserProfile } from '@shift-complete/shared-types';
import {
  UiCardComponent,
  UiDialogShellComponent,
  UiLabelComponent,
  UiSelectComponent,
  UiSidebarPanelComponent,
  UiTableShellComponent,
} from '@shift-complete/ui-kit';
import { AuthApiService } from '../../core/services/auth-api.service';
import { ApiErrorService } from '../../core/services/api-error.service';
import { GlobalTeamScopeService } from '../../core/services/global-team-scope.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { TeamScopeChipsComponent } from '../../shared/components/team-scope-chips.component';
import { AppApiService } from '../../shared/services/app-api.service';
import { SessionService } from '../../core/services/session.service';

type TeamDuty = NonNullable<TeamListItem['duties']>[number];

@Component({
  selector: 'app-teams-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    UiCardComponent,
    UiTableShellComponent,
    UiLabelComponent,
    UiSelectComponent,
    UiSidebarPanelComponent,
    UiDialogShellComponent,
    TeamScopeChipsComponent,
  ],
  templateUrl: './teams-page.component.html',
})
export class TeamsPageComponent {
  private readonly api = inject(AppApiService);
  private readonly apiError = inject(ApiErrorService);
  private readonly authApi = inject(AuthApiService);
  private readonly feedback = inject(UiFeedbackService);
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(SessionService);
  protected readonly teamScope = inject(GlobalTeamScopeService);

  protected readonly teams = signal<TeamListItem[]>([]);
  protected readonly visibleTeams = computed(() => {
    const scopedTeamId = this.teamScope.teamId();
    return scopedTeamId ? this.teams().filter((team) => team.id === scopedTeamId) : this.teams();
  });
  protected readonly leaders = signal<UserProfile[]>([]);
  protected readonly people = signal<UserProfile[]>([]);
  protected readonly replacements = signal<ReplacementItem[]>([]);
  protected readonly teamRequests = signal<TeamAccessRequestItem[]>([]);
  protected readonly selectedTeam = signal<TeamListItem | null>(null);
  protected readonly editingTeamId = signal<string | null>(null);
  protected readonly editingDutyId = signal<string | null>(null);
  protected readonly selectedMemberOption = signal<Record<string, unknown> | null>(null);
  protected readonly selectedJoinRequestOption = signal<Record<string, unknown> | null>(null);
  protected readonly leaderOptions = computed(() => this.leaders().map((user) => ({ label: user.fullName, value: user.id })));
  protected readonly teamOptions = computed(() => this.teams().map((team) => ({ label: team.name, value: team.id })));
  protected readonly pendingReplacements = computed(() => this.replacements().filter((replacement) => replacement.status === 'PENDING').length);
  protected readonly recoveredReplacements = computed(() => this.replacements().filter((replacement) => replacement.status === 'APPROVED' && replacement.replacementAssigneeId).length);
  protected readonly pendingTeamRequests = computed(() => this.teamRequests().filter((request) => request.status === 'PENDING').length);
  protected readonly canManageTeams = computed(() => this.session.hasAnyRole('administrator', 'service_leader'));
  protected readonly canEditTeams = computed(() => this.session.isAdministrator());
  protected readonly canManageRequests = computed(() => this.session.hasAnyRole('administrator', 'service_leader'));
  protected readonly memberDutySelections = signal<Record<string, string[]>>({});

  protected teamDialogVisible = false;
  protected dutyDialogVisible = false;
  protected teamForm = { name: '', description: '', leaderId: null as string | null };
  protected dutyForm = { teamId: '', name: '', description: '', color: '', icon: '' };
  protected replacementAssigneeSelection: Record<string, string> = {};
  protected readonly locallyReservedSuggestionIds = signal<string[]>([]);
  protected readonly highlightedTab = signal<'replacements' | 'requests'>('replacements');
  protected readonly assistantReplacement = signal<ReplacementItem | null>(null);
  protected readonly assistantTeamRequest = signal<TeamAccessRequestItem | null>(null);
  @ViewChild('teamRequestsSection') private teamRequestsSection?: ElementRef<HTMLElement>;

  @HostListener('document:keydown.escape', ['$event'])
  protected handleEscape(event: KeyboardEvent): void {
    if (this.dutyDialogVisible) {
      this.dutyDialogVisible = false;
      event.preventDefault();
      return;
    }

    if (this.teamDialogVisible) {
      this.teamDialogVisible = false;
      event.preventDefault();
    }
  }

  constructor() {
    this.loadData();
    this.route.queryParamMap.subscribe((params) => {
      this.highlightedTab.set(params.get('tab') === 'requests' ? 'requests' : 'replacements');
      const teamId = params.get('teamId');
      if (teamId) {
        this.teamScope.setTeam(teamId);
      }
      if (params.get('tab') === 'requests') {
        setTimeout(() => this.teamRequestsSection?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      }
    });
    effect(() => {
      const scopedTeamId = this.teamScope.teamId();
      if (!scopedTeamId) {
        return;
      }
      const scopedTeam = this.teams().find((team) => team.id === scopedTeamId) ?? null;
      if (scopedTeam) {
        this.selectedTeam.set(scopedTeam);
      }
    });
  }

  protected castNullable(value: unknown): string | null {
    return value ? String(value) : null;
  }

  protected castString(value: unknown): string {
    return value ? String(value) : '';
  }

  protected selectScopedTeam(team: TeamListItem): void {
    this.teamScope.setTeam(team.id);
    this.selectTeam(team);
  }

  protected asRecord(value: unknown): Record<string, unknown> | null {
    return (value as Record<string, unknown> | null) ?? null;
  }

  protected selectedMemberUserId(): string {
    return String(this.selectedMemberOption()?.['value'] ?? '');
  }

  protected selectedJoinRequestUserId(): string {
    return String(this.selectedJoinRequestOption()?.['value'] ?? '');
  }

  protected availableUserOptions(teamId: string): Array<{ label: string; value: string }> {
    const memberIds = new Set((this.teams().find((team) => team.id === teamId)?.members ?? []).map((member) => member.id));
    return this.people()
      .filter((user) => !memberIds.has(user.id))
      .map((user) => ({ label: `${user.fullName} · ${user.role}`, value: user.id }));
  }

  protected dutyOptionsForTeam(team: TeamListItem): Array<{ label: string; value: string }> {
    return (team.duties ?? []).map((duty) => ({ label: duty.name, value: duty.id }));
  }

  protected memberAssignedDutyNames(member: NonNullable<TeamListItem['members']>[number]): string {
    return member.duties?.map((duty) => duty.name).join(', ') || 'Nessuna mansione assegnata';
  }

  protected selectedDutyIdsForMember(member: NonNullable<TeamListItem['members']>[number]): string[] {
    return this.memberDutySelections()[member.id] ?? member.dutyIds ?? [];
  }

  protected updateMemberDutySelection(memberId: string, selected: string[]): void {
    this.memberDutySelections.update((state) => ({ ...state, [memberId]: selected }));
  }

  protected toggleMemberDuty(memberId: string, dutyId: string): void {
    const current = this.memberDutySelections()[memberId] ?? [];
    const next = current.includes(dutyId)
      ? current.filter((item) => item !== dutyId)
      : [...current, dutyId];
    this.updateMemberDutySelection(memberId, next);
  }

  protected openTeamDialog(): void {
    if (!this.canManageTeams()) {
      return;
    }
    this.editingTeamId.set(null);
    this.teamForm = { name: '', description: '', leaderId: null };
    this.teamDialogVisible = true;
  }

  protected openDutyDialog(team?: TeamListItem): void {
    if (!this.canManageTeams()) {
      return;
    }
    this.editingDutyId.set(null);
    this.dutyForm = {
      teamId: team?.id ?? this.selectedTeam()?.id ?? '',
      name: '',
      description: '',
      color: '',
      icon: '',
    };
    this.dutyDialogVisible = true;
  }

  protected selectTeam(team: TeamListItem): void {
    this.selectedTeam.set(team);
    this.selectedMemberOption.set(null);
    this.selectedJoinRequestOption.set(null);
  }

  protected editTeam(team: TeamListItem): void {
    if (!this.canEditTeams()) {
      return;
    }
    this.editingTeamId.set(team.id);
    this.teamForm = {
      name: team.name,
      description: team.description ?? '',
      leaderId: team.leader?.id ?? null,
    };
    this.teamDialogVisible = true;
  }

  protected renameTeam(teamId: string, name: string): void {
    if (!this.canEditTeams()) {
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }

    this.api.updateTeam(teamId, { name: trimmed }).subscribe({
      next: () => this.loadData(),
    });
  }

  protected saveTeam(): void {
    if (!this.canManageTeams()) {
      return;
    }
    const payload = {
      name: this.teamForm.name.trim(),
      description: this.teamForm.description.trim() || undefined,
      leaderId: this.teamForm.leaderId || undefined,
    };

    const request = this.editingTeamId()
      ? this.api.updateTeam(this.editingTeamId() as string, payload)
      : this.api.createTeam(payload);

    request.subscribe({
      next: () => {
        this.teamDialogVisible = false;
        this.loadData();
        this.feedback.success(this.editingTeamId() ? 'Team aggiornato' : 'Team creato');
      },
      error: (error) => this.feedback.error('Operazione team non riuscita', this.apiError.message(error, 'Impossibile salvare il team.')),
    });
  }

  protected deleteTeam(teamId: string): void {
    if (!this.canEditTeams()) {
      return;
    }
    this.api.deleteTeam(teamId).subscribe({
      next: () => {
        if (this.selectedTeam()?.id === teamId) {
          this.selectedTeam.set(null);
        }
        this.loadData();
        this.feedback.success('Team eliminato');
      },
      error: (error) => this.feedback.error('Eliminazione non riuscita', this.apiError.message(error, 'Impossibile eliminare il team.')),
    });
  }

  protected editDuty(team: TeamListItem, duty: TeamDuty): void {
    if (!this.canManageTeams()) {
      return;
    }
    this.selectedTeam.set(team);
    this.editingDutyId.set(duty.id);
    this.dutyForm = {
      teamId: team.id,
      name: duty.name,
      description: '',
      color: duty.color ?? '',
      icon: duty.icon ?? '',
    };
    this.dutyDialogVisible = true;
  }

  protected saveDuty(): void {
    if (!this.canManageTeams()) {
      return;
    }
    const payload = {
      teamId: this.dutyForm.teamId,
      name: this.dutyForm.name.trim(),
      description: this.dutyForm.description.trim() || undefined,
      color: this.dutyForm.color.trim() || undefined,
      icon: this.dutyForm.icon.trim() || undefined,
    };

    const request = this.editingDutyId()
      ? this.api.updateDuty(this.editingDutyId() as string, {
          name: payload.name,
          description: payload.description,
          color: payload.color,
          icon: payload.icon,
        })
      : this.api.createDuty(payload);

    request.subscribe({
      next: () => {
        this.dutyDialogVisible = false;
        this.loadData();
        this.feedback.success(this.editingDutyId() ? 'Mansione aggiornata' : 'Mansione creata');
      },
      error: (error) => this.feedback.error('Operazione mansione non riuscita', this.apiError.message(error, 'Impossibile salvare la mansione.')),
    });
  }

  protected deleteDuty(dutyId: string): void {
    if (!this.canManageTeams()) {
      return;
    }
    this.api.deleteDuty(dutyId).subscribe({
      next: () => {
        this.loadData();
        this.feedback.success('Mansione eliminata');
      },
      error: (error) => this.feedback.error('Eliminazione non riuscita', this.apiError.message(error, 'Impossibile eliminare la mansione.')),
    });
  }

  protected resolveReplacement(replacementId: string, status: 'APPROVED' | 'DECLINED'): void {
    if (!this.canManageRequests()) {
      return;
    }
    const replacementAssigneeId = status === 'APPROVED' ? this.replacementAssigneeSelection[replacementId] || undefined : null;
    const replacementAssignee = replacementAssigneeId ? this.findMemberById(replacementAssigneeId) : null;

    if (status === 'APPROVED' && !replacementAssigneeId) {
      this.feedback.error('Selezione mancante', 'Seleziona un sostituto prima di approvare la richiesta.');
      return;
    }

    this.api.resolveReplacement(replacementId, { status, replacementAssigneeId }).subscribe({
      next: () => {
        if (status === 'APPROVED' && replacementAssigneeId) {
          this.locallyReservedSuggestionIds.update((ids) => Array.from(new Set([...ids, replacementAssigneeId])));
        }
        this.patchReplacementState(replacementId, status, replacementAssigneeId ?? null, replacementAssignee);
        this.feedback.success(status === 'APPROVED' ? 'Sostituzione approvata' : 'Sostituzione rifiutata');
      },
      error: (error) => this.feedback.error('Sostituzione non aggiornata', this.apiError.message(error, 'Impossibile aggiornare la richiesta di sostituzione.')),
    });
  }

  protected approveReplacementWithSuggestion(replacement: ReplacementItem): void {
    if (!this.canManageRequests()) {
      return;
    }
    if (!replacement.suggestedReplacement?.id) {
      return;
    }

    this.replacementAssigneeSelection[replacement.id] = replacement.suggestedReplacement.id;
    this.resolveReplacement(replacement.id, 'APPROVED');
  }

  protected openReplacementAssistant(replacement: ReplacementItem): void {
    this.assistantReplacement.set(replacement);
  }

  protected clearReplacementCard(): void {
    this.assistantReplacement.set(null);
    this.replacementAssigneeSelection = {};
    this.locallyReservedSuggestionIds.set([]);
  }

  protected clearTeamRequestsCard(): void {
    this.highlightedTab.set('replacements');
    this.selectedJoinRequestOption.set(null);
    this.assistantTeamRequest.set(null);
  }

  protected replacementTone(status: ReplacementItem['status']): 'success' | 'warn' | 'info' {
    if (status === 'APPROVED') {
      return 'success';
    }

    if (status === 'DECLINED') {
      return 'warn';
    }

    return 'info';
  }

  protected assistantScoreTone(score: number): 'success' | 'info' | 'warn' {
    if (score >= 80) {
      return 'success';
    }

    if (score >= 60) {
      return 'info';
    }

    return 'warn';
  }

  protected assistantStatusLabel(replacement: ReplacementItem): string {
    if (replacement.status === 'APPROVED') {
      return 'Decisione presa';
    }

    if (replacement.status === 'DECLINED') {
      return 'Richiesta chiusa';
    }

    return 'Decisione richiesta';
  }

  protected assistantCoverageLabel(replacement: ReplacementItem): string {
    return replacement.replacementAssignee?.fullName ? `Copertura: ${replacement.replacementAssignee.fullName}` : 'Copertura da confermare';
  }

  protected replacementStatusLabel(status: ReplacementItem['status']): string {
    if (status === 'APPROVED') {
      return 'Approvata';
    }

    if (status === 'DECLINED') {
      return 'Rifiutata';
    }

    return 'In attesa';
  }

  protected teamRequestTabLabel(tab: 'replacements' | 'requests'): string {
    return tab === 'replacements' ? 'Sostituzioni' : 'Richieste team';
  }

  protected teamRequestKindLabel(kind: TeamAccessRequestItem['kind']): string {
    return kind === 'SIGNUP' ? 'Registrazione' : 'Ingresso nel team';
  }

  protected teamRequestStatusLabel(status: TeamAccessRequestItem['status']): string {
    if (status === 'APPROVED') {
      return 'Approvata';
    }

    if (status === 'DECLINED') {
      return 'Rifiutata';
    }

    return 'In attesa';
  }

  protected openTeamRequestAssistant(request: TeamAccessRequestItem): void {
    this.highlightedTab.set('requests');
    this.assistantTeamRequest.set(request);
  }

  protected teamRequestAssistantStatusLabel(request: TeamAccessRequestItem): string {
    if (request.status === 'APPROVED') {
      return 'Richiesta approvata';
    }

    if (request.status === 'DECLINED') {
      return 'Richiesta chiusa';
    }

    return 'Decisione richiesta';
  }

  protected teamRequestAssistantKindLabel(request: TeamAccessRequestItem): string {
    return request.kind === 'SIGNUP' ? 'Signup al workspace' : 'Ingresso nel team';
  }

  protected teamRequestAssistantSubject(request: TeamAccessRequestItem): string {
    return request.targetUser?.fullName || request.fullName || request.email || 'Richiesta team';
  }

  protected teamRequestAssistantRecommendation(request: TeamAccessRequestItem): string {
    if (request.status === 'APPROVED') {
      return request.kind === 'SIGNUP'
        ? 'La persona puo completare l’accesso al workspace: verifica onboarding e assegnazione team iniziale.'
        : 'La persona e stata accettata nel team: verifica mansioni, copertura e leadership associata.';
    }

    if (request.status === 'DECLINED') {
      return 'La richiesta e chiusa: se serve, raccogli motivazione operativa e proponi un nuovo inserimento guidato.';
    }

    return request.kind === 'SIGNUP'
      ? 'Valuta se il profilo puo entrare nel workspace e se il team associato e corretto prima di approvare.'
      : 'Controlla carico del team, ruolo della persona e disponibilita operativa prima di approvare l’ingresso.';
  }

  protected assistantRecommendation(replacement: ReplacementItem): string {
    if (replacement.status === 'APPROVED') {
      return replacement.replacementAssignee?.fullName
        ? `La copertura del team e gia confermata con ${replacement.replacementAssignee.fullName}.`
        : 'La richiesta e approvata: verifica il passaggio operativo del sostituto con il team leader.';
    }

    if (replacement.status === 'DECLINED') {
      return 'La richiesta e stata chiusa senza sostituzione: valuta un contatto diretto con il team per coprire il turno.';
    }

    if (replacement.suggestedReplacement?.fullName) {
      return `Per velocizzare il workspace team, ${replacement.suggestedReplacement.fullName} e la prima scelta da confermare.`;
    }

    return 'Non c e un suggerimento automatico forte: valuta disponibilita e seniority dei membri del team.';
  }

  protected replacementOptions(replacement: ReplacementItem): Array<{ label: string; value: string }> {
    const teamId = replacement.assignment?.slot?.team?.name
      ? this.teams().find((team) => team.name === replacement.assignment?.slot?.team?.name)?.id
      : null;
    const team = this.teams().find((item) => item.id === teamId);
    return (team?.members ?? []).map((member) => ({ label: member.fullName, value: member.id }));
  }

  protected addMemberToSelectedTeam(): void {
    if (!this.canManageTeams()) {
      return;
    }
    const teamId = this.selectedTeam()?.id;
    const userId = this.selectedMemberUserId();
    if (!teamId || !userId) {
      return;
    }

    this.api.addTeamMember(teamId, userId).subscribe({
      next: () => {
        this.selectedMemberOption.set(null);
        this.loadData();
        this.feedback.success('Membro aggiunto al team');
      },
      error: (error) => this.feedback.error('Inserimento non riuscito', this.apiError.message(error, 'Impossibile aggiungere la persona al team.')),
    });
  }

  protected removeMemberFromSelectedTeam(userId: string): void {
    if (!this.canManageTeams()) {
      return;
    }
    const teamId = this.selectedTeam()?.id;
    if (!teamId) {
      return;
    }

    this.api.removeTeamMember(teamId, userId).subscribe({
      next: () => {
        this.loadData();
        this.feedback.success('Membro rimosso dal team');
      },
      error: (error) => this.feedback.error('Rimozione non riuscita', this.apiError.message(error, 'Impossibile rimuovere la persona dal team.')),
    });
  }

  protected saveMemberDuties(memberId: string): void {
    if (!this.canManageTeams()) {
      return;
    }

    const teamId = this.selectedTeam()?.id;
    if (!teamId) {
      return;
    }

    const member = this.findMemberById(memberId);
    if (!member) {
      return;
    }

    this.api.assignTeamMemberDuties(teamId, memberId, this.selectedDutyIdsForMember(member)).subscribe({
      next: () => {
        this.loadData();
        this.feedback.success('Mansioni volontario aggiornate');
      },
      error: (error) => this.feedback.error('Aggiornamento non riuscito', this.apiError.message(error, 'Impossibile aggiornare le mansioni del volontario.')),
    });
  }

  protected requestJoinForSelectedTeam(): void {
    if (!this.canManageTeams()) {
      return;
    }
    const teamId = this.selectedTeam()?.id;
    const userId = this.selectedJoinRequestUserId();
    if (!teamId || !userId) {
      return;
    }

    this.api.createTeamJoinRequest(teamId, userId).subscribe({
      next: () => {
        this.selectedJoinRequestOption.set(null);
        this.loadData();
        this.feedback.success('Invito al team inviato');
      },
      error: (error) => this.feedback.error('Invito non inviato', this.apiError.message(error, 'Impossibile creare la richiesta di inserimento.')),
    });
  }

  protected approveTeamRequest(request: TeamAccessRequestItem): void {
    if (!this.canManageRequests()) {
      return;
    }
    if (request.kind === 'SIGNUP') {
      this.authApi.resolveSignupRequest(request.id, 'APPROVED').subscribe({
        next: () => {
          this.assistantTeamRequest.set({ ...request, status: 'APPROVED', reviewedAt: new Date().toISOString() });
          this.loadData();
          this.feedback.success('Richiesta signup approvata');
        },
        error: (error) => this.feedback.error('Approvazione non riuscita', this.apiError.message(error, 'Impossibile approvare la richiesta signup.')),
      });
      return;
    }

    this.api.resolveTeamJoinRequest(request.id, 'APPROVED').subscribe({
      next: () => {
        this.assistantTeamRequest.set({ ...request, status: 'APPROVED', reviewedAt: new Date().toISOString() });
        this.loadData();
        this.feedback.success('Richiesta team approvata');
      },
      error: (error) => this.feedback.error('Approvazione non riuscita', this.apiError.message(error, 'Impossibile approvare la richiesta team.')),
    });
  }

  protected declineTeamRequest(request: TeamAccessRequestItem): void {
    if (!this.canManageRequests()) {
      return;
    }
    if (request.kind === 'SIGNUP') {
      this.authApi.resolveSignupRequest(request.id, 'DECLINED').subscribe({
        next: () => {
          this.assistantTeamRequest.set({ ...request, status: 'DECLINED', reviewedAt: new Date().toISOString() });
          this.loadData();
          this.feedback.success('Richiesta signup rifiutata');
        },
        error: (error) => this.feedback.error('Rifiuto non riuscito', this.apiError.message(error, 'Impossibile rifiutare la richiesta signup.')),
      });
      return;
    }

    this.api.resolveTeamJoinRequest(request.id, 'DECLINED').subscribe({
      next: () => {
        this.assistantTeamRequest.set({ ...request, status: 'DECLINED', reviewedAt: new Date().toISOString() });
        this.loadData();
        this.feedback.success('Richiesta team rifiutata');
      },
      error: (error) => this.feedback.error('Rifiuto non riuscito', this.apiError.message(error, 'Impossibile rifiutare la richiesta team.')),
    });
  }

  private loadData(): void {
    this.api.teams().subscribe({
      next: (teams) => {
        this.teams.set(teams);
        this.memberDutySelections.set(
          Object.fromEntries(
            teams.flatMap((team) => (team.members ?? []).map((member) => [member.id, member.dutyIds ?? []]))
          )
        );
        const selectedTeamId = this.teamScope.teamId() || this.selectedTeam()?.id;
        const nextSelectedTeam = teams.find((team) => team.id === selectedTeamId) ?? teams[0] ?? null;
        this.selectedTeam.set(nextSelectedTeam);
      },
      error: (error) => this.feedback.error('Team non caricati', this.apiError.message(error, 'Impossibile recuperare i team.')),
    });

    this.api.users('service_leader').subscribe({
      next: (users) => this.leaders.set(users),
      error: (error) => this.feedback.error('Leader non caricati', this.apiError.message(error, 'Impossibile recuperare i leader.')),
    });

    this.api.users().subscribe({
      next: (users) => this.people.set(users),
      error: (error) => this.feedback.error('Persone non caricate', this.apiError.message(error, 'Impossibile recuperare gli utenti.')),
    });

    this.api.replacements().subscribe({
      next: (items) => this.replacements.set(items),
      error: (error) => this.feedback.error('Sostituzioni non caricate', this.apiError.message(error, 'Impossibile recuperare le sostituzioni.')),
    });

    this.api.teamJoinRequests().subscribe({
      next: (items) => this.teamRequests.set(items),
      error: (error) => this.feedback.error('Richieste team non caricate', this.apiError.message(error, 'Impossibile recuperare le richieste team.')),
    });
  }

  private patchReplacementState(
    replacementId: string,
    status: ReplacementItem['status'],
    replacementAssigneeId: string | null,
    replacementAssignee: NonNullable<ReplacementItem['replacementAssignee']> | null
  ): void {
    const resolvedAt = new Date().toISOString();
    this.replacements.update((items) =>
      items.map((item) =>
        item.id === replacementId
          ? {
              ...item,
              status,
              resolvedAt,
              replacementAssigneeId: replacementAssigneeId ?? item.replacementAssigneeId,
              replacementAssignee: replacementAssigneeId ? replacementAssignee ?? item.replacementAssignee : item.replacementAssignee,
            }
          : item
      )
    );
    this.assistantReplacement.update((item) =>
      item?.id === replacementId
        ? {
            ...item,
            status,
            resolvedAt,
            replacementAssigneeId: replacementAssigneeId ?? item.replacementAssigneeId,
            replacementAssignee: replacementAssigneeId ? replacementAssignee ?? item.replacementAssignee : item.replacementAssignee,
          }
        : item
    );
  }

  private findMemberById(memberId: string): NonNullable<TeamListItem['members']>[number] | null {
    return this.teams()
      .flatMap((team) => team.members ?? [])
      .find((member) => member.id === memberId) ?? null;
  }
}
