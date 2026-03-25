import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UiButtonComponent, UiConfirmDialogComponent, UiFieldComponent, UiFilterBarComponent, UiModalComponent, UiMultiSelectComponent, UiPageHeaderComponent, UiSelectComponent, UiSurfaceComponent } from '@shift-complete/ui-kit';
import { GlobalTeamScopeService } from '../../core/services/global-team-scope.service';
import { SpotlightSearchService } from '../../core/services/spotlight-search.service';
import { EditableUserProfileForm, UserProfileEditorComponent } from '../../shared/components/user-profile-editor.component';
import { TeamScopeChipsComponent } from '../../shared/components/team-scope-chips.component';
import { ApiErrorService } from '../../core/services/api-error.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { AppApiService, DutyListItem } from '../../shared/services/app-api.service';
import { TeamListItem, UserPreferenceCatalogItem, UserProfile } from '@shift-complete/shared-types';

type ManagedUserForm = EditableUserProfileForm & {
  role: 'administrator' | 'service_leader' | 'volunteer';
  teamIds: string[];
};

type ManagedUserCreateResponse = UserProfile & { generatedPassword?: string };

@Component({
  selector: 'app-admin-users-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, UiButtonComponent, UiConfirmDialogComponent, UiFieldComponent, UiFilterBarComponent, UiModalComponent, UiMultiSelectComponent, UiPageHeaderComponent, UiSelectComponent, UiSurfaceComponent, UserProfileEditorComponent, TeamScopeChipsComponent],
  templateUrl: './admin-users-page.component.html',
})

export class AdminUsersPageComponent {
  private readonly api = inject(AppApiService);
  private readonly apiError = inject(ApiErrorService);
  private readonly feedback = inject(UiFeedbackService);
  protected readonly teamScope = inject(GlobalTeamScopeService);
  protected readonly spotlight = inject(SpotlightSearchService);

  protected readonly users = signal<UserProfile[]>([]);
  protected readonly teams = signal<TeamListItem[]>([]);
  protected readonly duties = signal<DutyListItem[]>([]);
  protected readonly preferenceCatalog = signal<UserPreferenceCatalogItem[]>([]);
  protected readonly catalogType = signal<'competency' | 'shift' | 'location'>('competency');
  protected catalogForm = { value: '', label: '', description: '' };
  protected readonly deliveries = signal<Array<{ channel: string; status: string; notification?: { user?: { id?: string } | null } | null }>>([]);
  protected readonly selectedUser = signal<UserProfile | null>(null);
  protected readonly formOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly pendingAction = signal<{ title: string; message: string; detail?: string; run: () => void; tone: 'confirm' | 'danger'; icon: string; confirmLabel: string } | null>(null);
  protected readonly generatedCredentials = signal<{ email: string; password: string } | null>(null);
  protected readonly confirmVisible = signal(false);
  protected readonly credentialsVisible = signal(false);
  protected searchQuery = '';
  protected roleFilter = '';
  protected teamFilter = '';
  protected form: ManagedUserForm = this.createEmptyForm();

  protected readonly filteredUsers = computed(() => {
    const q = this.searchQuery.trim().toLowerCase();
    const scopedTeamId = this.teamScope.teamId();
    return this.users().filter((user) => {
      const searchMatch = !q || user.fullName.toLowerCase().includes(q) || user.email.toLowerCase().includes(q);
      const teamMatch = !scopedTeamId || (user.activeTeamIds ?? []).includes(scopedTeamId);
      return searchMatch && teamMatch;
    });
  });
  protected readonly preferredTeamOptions = computed(() => this.teams().map((team) => ({ label: team.name, value: team.id })));
  protected readonly preferredDutyOptions = computed(() => this.duties().map((duty) => ({ label: duty.name, value: duty.id })));
  protected readonly shiftPreferenceOptions = computed(() => this.preferenceCatalog().filter((item) => item.type === 'shift').map((item) => ({ label: item.label, value: item.value })));
  protected readonly competencyOptions = computed(() => this.preferenceCatalog().filter((item) => item.type === 'competency').map((item) => ({ label: item.label, value: item.value })));
  protected readonly locationOptions = computed(() => this.preferenceCatalog().filter((item) => item.type === 'location').map((item) => ({ label: item.label, value: item.value })));
  protected readonly activeCatalogItems = computed(() => this.preferenceCatalog().filter((item) => item.type === this.catalogType()));
  protected readonly roleOptions = [
    { label: 'Tutti i ruoli', value: '' },
    { label: 'Amministratore', value: 'administrator' },
    { label: 'Leader', value: 'service_leader' },
    { label: 'Volontario', value: 'volunteer' },
  ];
  protected readonly accountRoleOptions = [
    { label: 'Volontario', value: 'volunteer' },
    { label: 'Leader', value: 'service_leader' },
    { label: 'Amministratore', value: 'administrator' },
  ];

  constructor() {
    this.loadTeams();
    this.loadUsers();
    effect(() => {
      const scopedTeamId = this.teamScope.teamId();
      if (scopedTeamId !== this.teamFilter) {
        this.teamFilter = scopedTeamId;
        this.loadUsers();
      }
    });
  }

  protected openCreate() {
    this.editingId.set(null);
    this.form = this.createEmptyForm();
    this.formOpen.set(true);
  }

  protected openSpotlight(): void {
    this.spotlight.openSpotlight();
  }

  protected editUser(user: UserProfile) {
    this.selectedUser.set(user);
    this.editingId.set(user.id);
    this.form = {
      fullName: user.fullName,
      email: user.email,
      phone: user.phone ?? '',
      address: user.address ?? '',
      emergencyName: user.emergencyName ?? '',
      emergencyPhone: user.emergencyPhone ?? '',
      preferredShifts: user.preferredShifts ?? [],
      preferredTeamIds: user.preferredTeamIds ?? [],
      preferredDutyIds: user.preferredDutyIds ?? [],
      preferredLocationValues: user.preferredLocationValues ?? [],
      competencies: user.competencies ?? [],
      serviceNotes: user.serviceNotes ?? '',
      role: user.role,
      teamIds: [...(user.activeTeamIds ?? [])]
    };
    this.formOpen.set(true);
  }

  protected saveUser() {
    const payload = {
      fullName: this.form.fullName,
      email: this.form.email,
      phone: this.form.phone || undefined,
      address: this.form.address || undefined,
      emergencyName: this.form.emergencyName || undefined,
      emergencyPhone: this.form.emergencyPhone || undefined,
      preferredShifts: this.form.preferredShifts,
      preferredTeamIds: this.form.preferredTeamIds,
      preferredDutyIds: this.form.preferredDutyIds,
      preferredLocationValues: this.form.preferredLocationValues,
      competencies: this.form.competencies,
      serviceNotes: this.form.serviceNotes || undefined,
      role: this.form.role,
      teamIds: this.form.teamIds,
    };
    const req = this.editingId()
      ? this.api.updateManagedUser(this.editingId()!, payload)
      : this.api.createManagedUser(payload);
    req.subscribe({
      next: (result) => {
        this.formOpen.set(false);
        this.loadUsers();
        const createdResult = result as ManagedUserCreateResponse;
        this.feedback.success(this.editingId() ? 'Utente aggiornato' : 'Utente creato', createdResult.generatedPassword ? `Password generata: ${createdResult.generatedPassword}` : undefined);
        if (createdResult.generatedPassword) {
          this.openCredentialsModal(createdResult.email, createdResult.generatedPassword);
        }
      },
      error: (error) => this.feedback.error('Operazione utenti fallita', this.apiError.message(error, 'Impossibile salvare l\'utente.'))
    });
  }

  protected deleteUser(userId: string) {
    this.pendingAction.set({
      title: 'Eliminare utente?',
      message: 'L’utente verra rimosso definitivamente e perdera accesso ai flussi applicativi.',
      detail: 'Questa azione elimina l account gestito e il suo accesso operativo.',
      tone: 'danger',
      icon: 'pi pi-trash',
      confirmLabel: 'Elimina utente',
      run: () => this.api.deleteManagedUser(userId).subscribe({
      next: () => {
        this.pendingAction.set(null);
        this.loadUsers();
        this.feedback.success('Utente eliminato');
      },
      error: (error) => {
        this.pendingAction.set(null);
        this.feedback.error('Eliminazione non riuscita', this.apiError.message(error, 'Impossibile eliminare l\'utente.'));
      }
      })
    });
    this.confirmVisible.set(true);
  }

  protected sendCredentials(userId: string) {
    this.pendingAction.set({
      title: 'Rigenerare e inviare credenziali?',
      message: 'VerrA generata una nuova password temporanea e verra inviata via notifiche, email e webhook se configurati.',
      detail: 'Le credenziali precedenti non saranno piu valide per l accesso corrente.',
      tone: 'confirm',
      icon: 'pi pi-key',
      confirmLabel: 'Invia credenziali',
      run: () => this.api.sendUserCredentials(userId).subscribe({
      next: (result) => {
        this.pendingAction.set(null);
        this.feedback.success('Credenziali inviate', `Password temporanea: ${result.generatedPassword}`);
        const user = this.users().find((item) => item.id === userId);
        if (result.generatedPassword) {
          this.openCredentialsModal(user?.email ?? 'utente', result.generatedPassword);
        }
      },
      error: (error) => {
        this.pendingAction.set(null);
        this.feedback.error('Invio credenziali fallito', this.apiError.message(error, 'Impossibile inviare le credenziali.'));
      }
      })
    });
    this.confirmVisible.set(true);
  }

  protected confirmPendingAction() {
    const action = this.pendingAction();
    if (!action) return;
    this.confirmVisible.set(false);
    action.run();
  }

  protected closeConfirm() {
    this.confirmVisible.set(false);
    this.pendingAction.set(null);
  }

  protected copyGeneratedPassword() {
    const password = this.generatedCredentials()?.password;
    if (!password) return;
    void navigator.clipboard.writeText(password);
    this.feedback.success('Password copiata');
  }

  protected closeCredentialsModal() {
    this.credentialsVisible.set(false);
    this.generatedCredentials.set(null);
  }

  protected teamNames(teamIds: string[]) {
    if (!teamIds?.length) return '—';
    return this.teams().filter((team) => teamIds.includes(team.id)).map((team) => team.name).join(', ');
  }

  protected teamNameById(teamId: string): string {
    return this.teams().find((team) => team.id === teamId)?.name ?? teamId;
  }

  protected removeTeamMembership(teamId: string): void {
    this.form.teamIds = this.form.teamIds.filter((item) => item !== teamId);
  }

  protected deliverySummary(userId: string) {
    const items = this.deliveries().filter((item) => item.notification?.user?.id === userId).slice(0, 3);
    if (!items.length) {
      return '';
    }
    return items.map((item) => `${item.channel}:${item.status}`).join(' · ');
  }

  protected loadUsers() {
    this.api.managedUsers(this.roleFilter || undefined, this.teamFilter || undefined).subscribe({
      next: (users) => {
        this.users.set(users);
        if (this.selectedUser()) {
          this.selectedUser.set(users.find((user) => user.id === this.selectedUser()?.id) ?? null);
        }
      },
      error: (error) => this.feedback.error('Utenti non caricati', this.apiError.message(error, 'Impossibile recuperare gli utenti.'))
    });
  }

  protected selectUser(user: UserProfile): void {
    this.selectedUser.set(user);
  }

  private loadTeams() {
    this.api.userPreferenceCatalog().subscribe({ next: (items) => this.preferenceCatalog.set(items) });
    this.api.teams().subscribe({ next: (teams) => this.teams.set(teams) });
    this.api.duties().subscribe({ next: (duties) => this.duties.set(duties) });
    this.api.recentNotificationDeliveries(100).subscribe({ next: (items) => this.deliveries.set(items) });
  }

  private createEmptyForm(): ManagedUserForm {
    return {
      fullName: '',
      email: '',
      phone: '',
      address: '',
      emergencyName: '',
      emergencyPhone: '',
      preferredShifts: [],
      preferredTeamIds: [],
      preferredDutyIds: [],
      preferredLocationValues: [],
      competencies: [],
      serviceNotes: '',
      role: 'volunteer',
      teamIds: []
    };
  }

  protected saveCatalogItem(): void {
    if (!this.catalogForm.value.trim() || !this.catalogForm.label.trim()) {
      return;
    }

    this.api.upsertPreferenceCatalogItem({
      type: this.catalogType(),
      value: this.catalogForm.value.trim(),
      label: this.catalogForm.label.trim(),
      description: this.catalogForm.description.trim() || undefined,
    }).subscribe({
      next: () => {
        this.catalogForm = { value: '', label: '', description: '' };
        this.api.userPreferenceCatalog().subscribe({ next: (items) => this.preferenceCatalog.set(items) });
        this.feedback.success('Catalogo aggiornato');
      },
      error: (error) => this.feedback.error('Catalogo non aggiornato', this.apiError.message(error, 'Impossibile salvare il valore di catalogo.')),
    });
  }

  protected removeCatalogItem(id: string): void {
    this.api.deletePreferenceCatalogItem(id).subscribe({
      next: () => {
        this.api.userPreferenceCatalog().subscribe({ next: (items) => this.preferenceCatalog.set(items) });
        this.feedback.success('Valore catalogo eliminato');
      },
      error: (error) => this.feedback.error('Catalogo non aggiornato', this.apiError.message(error, 'Impossibile eliminare il valore di catalogo.')),
    });
  }

  private openCredentialsModal(email: string, password: string) {
    this.generatedCredentials.set({ email, password });
    this.confirmVisible.set(false);
    queueMicrotask(() => this.credentialsVisible.set(true));
  }
}
