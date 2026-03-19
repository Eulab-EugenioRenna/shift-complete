import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { ReplacementItem, TeamListItem } from '@shift-complete/shared-types';
import { UiCardComponent, UiDialogShellComponent, UiLabelComponent, UiSelectComponent, UiSidebarPanelComponent, UiTableShellComponent } from '@shift-complete/ui-kit';
import { ApiErrorService } from '../../core/services/api-error.service';
import { GlobalTeamScopeService } from '../../core/services/global-team-scope.service';
import { SpotlightSearchService } from '../../core/services/spotlight-search.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { TeamScopeChipsComponent } from '../../shared/components/team-scope-chips.component';
import { AppApiService } from '../../shared/services/app-api.service';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-replacements-history-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, UiCardComponent, UiDialogShellComponent, UiLabelComponent, UiSelectComponent, UiSidebarPanelComponent, UiTableShellComponent, TeamScopeChipsComponent],
  templateUrl: './replacements-history-page.component.html',
})
export class ReplacementsHistoryPageComponent {
  private readonly api = inject(AppApiService);
  private readonly apiError = inject(ApiErrorService);
  private readonly feedback = inject(UiFeedbackService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);
  protected readonly teamScope = inject(GlobalTeamScopeService);
  protected readonly spotlight = inject(SpotlightSearchService);
  protected readonly replacements = signal<ReplacementItem[]>([]);
  protected readonly teams = signal<TeamListItem[]>([]);
  protected readonly highlightedReplacementId = signal<string | null>(null);
  protected readonly expandedReplacementId = signal<string | null>(null);
  protected readonly assistantReplacement = signal<ReplacementItem | null>(null);
  protected readonly locallyReservedSuggestionIds = signal<string[]>([]);
  protected replacementSelection: Record<string, string> = {};
  protected readonly actionFeedback = signal<Record<string, 'APPROVED' | 'DECLINED'>>({});
  protected readonly selectedReplacementIds = signal<string[]>([]);
  protected readonly bulkReplacementAssigneeId = signal<string | null>(null);
  protected readonly bulkActionStatus = signal<'APPROVED' | 'DECLINED'>('APPROVED');
  protected bulkDialogVisible = false;
  protected readonly filters = {
    status: signal(''),
    person: signal(''),
  };

  protected readonly filteredReplacements = computed(() => {
    const status = this.filters.status().trim();
    const person = this.filters.person().trim().toLowerCase();

    return this.replacements().filter((replacement) => {
      const scopedTeamId = this.teamScope.teamId();
      const teamMatch = !scopedTeamId || (replacement.assignment?.slot?.team as { id?: string } | undefined)?.id === scopedTeamId;
      const statusMatch = !status || replacement.status === status;
      const personPool = `${replacement.requestedBy?.fullName || ''} ${replacement.replacementAssignee?.fullName || ''}`.toLowerCase();
      const personMatch = !person || personPool.includes(person);
      return teamMatch && statusMatch && personMatch;
    });
  });

  protected readonly sortedReplacements = computed(() => {
    const highlightedReplacementId = this.highlightedReplacementId();

    return [...this.filteredReplacements()].sort((left, right) => {
      if (left.id === highlightedReplacementId && right.id !== highlightedReplacementId) {
        return -1;
      }

      if (right.id === highlightedReplacementId && left.id !== highlightedReplacementId) {
        return 1;
      }

      const statusOrder = { PENDING: 0, APPROVED: 1, DECLINED: 2 } as const;
      const statusDelta = statusOrder[left.status] - statusOrder[right.status];
      if (statusDelta !== 0) {
        return statusDelta;
      }

      const assigneeDelta = Number(Boolean(left.replacementAssigneeId)) - Number(Boolean(right.replacementAssigneeId));
      if (assigneeDelta !== 0) {
        return assigneeDelta;
      }

      const suggestionDelta = (right.suggestedReplacement?.score ?? -1) - (left.suggestedReplacement?.score ?? -1);
      if (suggestionDelta !== 0) {
        return suggestionDelta;
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
  });

  protected readonly allPendingSelected = computed(() => {
    const pendingIds = this.filteredReplacements().filter((replacement) => replacement.status === 'PENDING').map((replacement) => replacement.id);
    return pendingIds.length > 0 && pendingIds.every((id) => this.selectedReplacementIds().includes(id));
  });

  protected readonly selectedPendingReplacements = computed(() =>
    this.filteredReplacements().filter((replacement) => this.selectedReplacementIds().includes(replacement.id) && replacement.status === 'PENDING')
  );

  protected readonly canUseBulkAssignee = computed(() => {
    const teamNames = Array.from(new Set(this.selectedPendingReplacements().map((replacement) => replacement.assignment?.slot?.team?.name).filter(Boolean)));
    const slotIds = Array.from(new Set(this.selectedPendingReplacements().map((replacement) => replacement.assignment?.slot?.id).filter(Boolean)));
    return teamNames.length === 1 && slotIds.length === 1 && this.selectedPendingReplacements().length > 0;
  });

  protected readonly bulkReplacementOptions = computed(() => {
    if (!this.canUseBulkAssignee()) {
      return [] as Array<{ label: string; value: string }>;
    }

    const teamName = this.selectedPendingReplacements()[0]?.assignment?.slot?.team?.name;
    const team = this.teams().find((item) => item.name === teamName);
    return (team?.members ?? []).map((member) => ({ label: member.fullName, value: member.id }));
  });

  protected readonly bulkWarnings = computed(() => {
    if (!this.selectedPendingReplacements().length) {
      return [] as string[];
    }

    const teamNames = Array.from(new Set(this.selectedPendingReplacements().map((replacement) => replacement.assignment?.slot?.team?.name).filter(Boolean)));
    const slotIds = Array.from(new Set(this.selectedPendingReplacements().map((replacement) => replacement.assignment?.slot?.id).filter(Boolean)));
    const warnings: string[] = [];

    if (teamNames.length > 1) {
      warnings.push('Le replacement selezionate appartengono a team differenti.');
    }

    if (slotIds.length > 1) {
      warnings.push('Le replacement selezionate appartengono a slot differenti, quindi non possono condividere lo stesso sostituto bulk.');
    }

    const missingSuggestions = this.selectedPendingReplacements().filter((replacement) => !replacement.suggestedReplacement).length;
    if (missingSuggestions > 0) {
      warnings.push(`${missingSuggestions} replacement non hanno un suggerimento automatico disponibile.`);
    }

    const suggestedIds = this.selectedPendingReplacements().map((replacement) => replacement.suggestedReplacement?.id).filter(Boolean);
    if (suggestedIds.length !== new Set(suggestedIds).size) {
      warnings.push('Alcune replacement condividono lo stesso sostituto suggerito e non possono essere approvate insieme con suggerito.');
    }

    return warnings;
  });

  protected readonly canApproveAllWithSuggested = computed(() =>
    this.selectedPendingReplacements().length > 0 &&
    this.selectedPendingReplacements().every((replacement) => Boolean(replacement.suggestedReplacement?.id)) &&
    new Set(this.selectedPendingReplacements().map((replacement) => replacement.suggestedReplacement?.id).filter(Boolean)).size === this.selectedPendingReplacements().length
  );
  protected readonly canManageReplacements = computed(() => this.session.hasAnyRole('administrator', 'service_leader'));
  protected readonly hasActiveReplacementState = computed(() => {
    const feedback = this.actionFeedback();
    return Boolean(
      this.filters.status() ||
      this.filters.person() ||
      this.selectedReplacementIds().length ||
      this.assistantReplacement() ||
      this.expandedReplacementId() ||
      this.highlightedReplacementId() ||
      Object.keys(feedback).length
    );
  });

  constructor() {
    this.api.replacements().subscribe({
      next: (items) => {
        this.replacements.set(items);
        const highlightedReplacementId = this.highlightedReplacementId();
        if (highlightedReplacementId) {
          this.assistantReplacement.set(items.find((item) => item.id === highlightedReplacementId) ?? this.assistantReplacement());
        }
      },
    });
    this.api.teams().subscribe({ next: (teams) => this.teams.set(teams) });
    this.route.queryParamMap.subscribe((params) => {
      const replacementId = params.get('replacementId');
      this.highlightedReplacementId.set(replacementId);
      if (replacementId) {
        this.assistantReplacement.set(this.replacements().find((item) => item.id === replacementId) ?? this.assistantReplacement());
      }
    });
  }

  protected openSpotlight(): void {
    this.spotlight.openSpotlight();
  }

  protected castString(value: unknown): string {
    return value ? String(value) : '';
  }

  protected clearReplacementView(): void {
    this.filters.status.set('');
    this.filters.person.set('');
    this.selectedReplacementIds.set([]);
    this.bulkReplacementAssigneeId.set(null);
    this.actionFeedback.set({});
    this.assistantReplacement.set(null);
    this.expandedReplacementId.set(null);
    this.highlightedReplacementId.set(null);
    this.router.navigate([], {
      queryParams: { replacementId: null },
      queryParamsHandling: 'merge'
    });
  }

  protected replacementOptions(replacement: ReplacementItem): Array<{ label: string; value: string }> {
    const teamName = replacement.assignment?.slot?.team?.name;
    const team = this.teams().find((item) => item.name === teamName);
    return (team?.members ?? []).map((member) => ({ label: member.fullName, value: member.id }));
  }

  protected suggestedReplacementAssigneeId(replacement: ReplacementItem): string | null {
    return replacement.suggestedReplacement?.id ?? this.replacementOptions(replacement)[0]?.value ?? null;
  }

  protected canUseSuggestedReplacement(replacement: ReplacementItem): boolean {
    const suggestedId = this.suggestedReplacementAssigneeId(replacement);
    return Boolean(suggestedId && !this.locallyReservedSuggestionIds().includes(suggestedId));
  }

  protected toggleExpandedReplacement(replacementId: string): void {
    this.expandedReplacementId.set(this.expandedReplacementId() === replacementId ? null : replacementId);
  }

  protected openAssistant(replacement: ReplacementItem): void {
    this.assistantReplacement.set(replacement);
    this.expandedReplacementId.set(replacement.id);
    this.router.navigate([], { queryParams: { replacementId: replacement.id }, queryParamsHandling: 'merge' });
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

  protected replacementStatusLabel(status: ReplacementItem['status']): string {
    if (status === 'APPROVED') {
      return 'Approvata';
    }

    if (status === 'DECLINED') {
      return 'Rifiutata';
    }

    return 'In attesa';
  }

  protected assistantCoverageLabel(replacement: ReplacementItem): string {
    return replacement.replacementAssignee?.fullName ? `Copertura: ${replacement.replacementAssignee.fullName}` : 'Copertura da confermare';
  }

  protected assistantRecommendation(replacement: ReplacementItem): string {
    if (replacement.status === 'APPROVED') {
      return replacement.replacementAssignee?.fullName
        ? `La copertura e gia confermata con ${replacement.replacementAssignee.fullName}.`
        : 'La richiesta e approvata: verifica che il sostituto venga confermato operativamente.';
    }

    if (replacement.status === 'DECLINED') {
      return 'La richiesta e stata chiusa senza sostituzione: valuta se riaprire il coordinamento manuale.';
    }

    if (replacement.suggestedReplacement?.fullName) {
      return `Valuta ${replacement.suggestedReplacement.fullName} come prima scelta e conferma rapidamente per non perdere copertura.`;
    }

    return 'Non c e un suggerimento automatico forte: valuta manualmente disponibilita e priorita del team.';
  }

  protected resolveReplacement(replacementId: string, status: 'APPROVED' | 'DECLINED'): void {
    if (!this.canManageReplacements()) {
      return;
    }
    const replacementAssigneeId = status === 'APPROVED' ? this.replacementSelection[replacementId] || undefined : null;
    const replacementAssignee = replacementAssigneeId ? this.findMemberById(replacementAssigneeId) : null;

    if (status === 'APPROVED' && !replacementAssigneeId) {
      this.feedback.error('Selezione mancante', 'Seleziona un sostituto prima di approvare la richiesta.');
      return;
    }

    this.api.resolveReplacement(replacementId, {
      status,
      replacementAssigneeId,
    }).subscribe({
      next: () => {
        this.actionFeedback.update((state) => ({ ...state, [replacementId]: status }));
        this.selectedReplacementIds.update((ids) => ids.filter((id) => id !== replacementId));
        if (status === 'APPROVED' && replacementAssigneeId) {
          this.locallyReservedSuggestionIds.update((ids) => Array.from(new Set([...ids, replacementAssigneeId])));
        }
        this.feedback.success(status === 'APPROVED' ? 'Sostituzione approvata' : 'Sostituzione rifiutata');
        this.router.navigate([], { queryParams: { replacementId }, queryParamsHandling: 'merge' });
        this.replacements.update((items) =>
          items.map((item) =>
            item.id === replacementId
              ? {
                  ...item,
                  status,
                  resolvedAt: new Date().toISOString(),
                  replacementAssigneeId: replacementAssigneeId ?? item.replacementAssigneeId,
                  replacementAssignee: replacementAssigneeId
                    ? replacementAssignee
                      ? {
                          id: replacementAssignee.id,
                          fullName: replacementAssignee.fullName,
                          email: replacementAssignee.email,
                        }
                      : item.replacementAssignee
                    : item.replacementAssignee,
                }
              : item
          )
        );
        this.assistantReplacement.update((item) =>
          item?.id === replacementId
            ? {
                ...item,
                status,
                resolvedAt: new Date().toISOString(),
                replacementAssigneeId: replacementAssigneeId ?? item.replacementAssigneeId,
                replacementAssignee: replacementAssigneeId
                  ? replacementAssignee
                    ? {
                        id: replacementAssignee.id,
                        fullName: replacementAssignee.fullName,
                        email: replacementAssignee.email,
                      }
                    : item.replacementAssignee
                  : item.replacementAssignee,
              }
            : item
        );
      },
      error: (error) => this.feedback.error('Operazione non riuscita', this.apiError.message(error, 'Impossibile aggiornare la sostituzione.')),
    });
  }

  private findMemberById(memberId: string): NonNullable<TeamListItem['members']>[number] | null {
    return this.teams()
      .flatMap((team) => team.members ?? [])
      .find((member) => member.id === memberId) ?? null;
  }

  protected toggleReplacementSelection(replacementId: string, checked: boolean): void {
    if (!this.canManageReplacements()) {
      return;
    }
    this.selectedReplacementIds.update((ids) =>
      checked ? Array.from(new Set([...ids, replacementId])) : ids.filter((id) => id !== replacementId)
    );
  }

  protected toggleAllPending(checked: boolean): void {
    if (!this.canManageReplacements()) {
      return;
    }
    if (!checked) {
      this.selectedReplacementIds.set([]);
      this.bulkReplacementAssigneeId.set(null);
      return;
    }

    this.selectedReplacementIds.set(this.filteredReplacements().filter((replacement) => replacement.status === 'PENDING').map((replacement) => replacement.id));
  }

  protected openBulkDialog(status: 'APPROVED' | 'DECLINED'): void {
    if (!this.canManageReplacements()) {
      return;
    }
    this.bulkActionStatus.set(status);
    this.bulkDialogVisible = true;
  }

  protected confirmBulkResolve(): void {
    if (!this.canManageReplacements()) {
      return;
    }
    this.bulkDialogVisible = false;
    this.resolveSelected(this.bulkActionStatus());
  }

  protected resolveSelected(status: 'APPROVED' | 'DECLINED'): void {
    if (!this.canManageReplacements()) {
      return;
    }
    for (const replacementId of this.selectedReplacementIds()) {
      if (status === 'APPROVED' && this.canUseBulkAssignee() && this.bulkReplacementAssigneeId()) {
        this.replacementSelection[replacementId] = this.bulkReplacementAssigneeId() as string;
      }
      this.resolveReplacement(replacementId, status);
    }
  }

  protected approveWithSuggestedReplacement(replacement: ReplacementItem): void {
    if (!this.canManageReplacements()) {
      return;
    }
    const suggestedId = this.suggestedReplacementAssigneeId(replacement);
    if (!suggestedId) {
      return;
    }

    this.replacementSelection[replacement.id] = suggestedId;
    this.resolveReplacement(replacement.id, 'APPROVED');
  }

  protected approveAllWithSuggested(): void {
    if (!this.canManageReplacements()) {
      return;
    }
    for (const replacement of this.selectedPendingReplacements()) {
      const suggestedId = this.suggestedReplacementAssigneeId(replacement);
      if (!suggestedId) {
        continue;
      }

      this.replacementSelection[replacement.id] = suggestedId;
      this.resolveReplacement(replacement.id, 'APPROVED');
    }
  }
}
