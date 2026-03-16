import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { RouterLink } from '@angular/router';
import { UiDialogShellComponent } from '@shift-complete/ui-kit';
import { EditableUserProfileForm, UserProfileEditorComponent } from '../../shared/components/user-profile-editor.component';
import { ApiErrorService } from '../../core/services/api-error.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { AppApiService, DutyListItem } from '../../shared/services/app-api.service';
import { TeamListItem, UserProfile } from '@shift-complete/shared-types';

type ManagedUserForm = EditableUserProfileForm & {
  role: 'administrator' | 'service_leader' | 'volunteer';
  teamIds: string[];
};

type ManagedUserCreateResponse = UserProfile & { generatedPassword?: string };

@Component({
  selector: 'app-admin-users-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, RouterLink, UiDialogShellComponent, UserProfileEditorComponent],
  template: `
    <section class="mx-auto flex max-w-7xl flex-col gap-6">
      <header class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p class="text-sm font-semibold uppercase tracking-widest text-rose-600">Superuser</p>
          <h2 class="mt-1 text-2xl font-semibold tracking-tight text-slate-800">Gestione utenti, team e invio credenziali.</h2>
        </div>
        <button class="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white" (click)="openCreate()">Nuovo utente</button>
      </header>

      <div class="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div class="flex flex-col gap-3 md:flex-row md:items-center">
          <input class="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm" [(ngModel)]="searchQuery" placeholder="Cerca per nome o email" />
          <select class="rounded-md border border-slate-300 px-3 py-2 text-sm" [(ngModel)]="roleFilter" (ngModelChange)="loadUsers()">
            <option value="">Tutti i ruoli</option>
            <option value="administrator">Amministratore</option>
            <option value="service_leader">Leader</option>
            <option value="volunteer">Volontario</option>
          </select>
          <select class="rounded-md border border-slate-300 px-3 py-2 text-sm" [(ngModel)]="teamFilter" (ngModelChange)="loadUsers()">
            <option value="">Tutti i team</option>
            <option *ngFor="let team of teams()" [value]="team.id">{{ team.name }}</option>
          </select>
        </div>
      </div>

      <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-50 text-left text-slate-500">
            <tr>
              <th class="px-5 py-3">Utente</th>
              <th class="px-5 py-3">Ruolo</th>
              <th class="px-5 py-3">Team</th>
              <th class="px-5 py-3">Onboarding</th>
              <th class="px-5 py-3 text-right">Azioni</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let user of filteredUsers()" class="border-t border-slate-100">
              <td class="px-5 py-3">
                <p class="font-medium text-slate-900">{{ user.fullName }}</p>
                <p class="text-xs text-slate-500">{{ user.email }}</p>
              </td>
              <td class="px-5 py-3 text-slate-600">{{ user.role }}</td>
              <td class="px-5 py-3 text-slate-600">{{ teamNames(user.activeTeamIds) }}</td>
              <td class="px-5 py-3 text-slate-600">{{ user.onboardingCompleted ? 'Completo' : 'In corso' }}</td>
              <td class="px-5 py-3 text-right">
                <div class="mb-2 text-xs text-slate-400" *ngIf="deliverySummary(user.id) as summary">{{ summary }}</div>
                <a class="mr-3 text-slate-700 hover:underline" [routerLink]="['/admin/users', user.id]">Dettaglio</a>
                <button class="mr-3 text-[#4979e6] hover:underline" (click)="editUser(user)">Modifica</button>
                <button class="mr-3 text-slate-700 hover:underline" (click)="sendCredentials(user.id)">Invia credenziali</button>
                <button class="text-red-600 hover:underline" (click)="deleteUser(user.id)">Elimina</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p-dialog [visible]="confirmVisible()" (visibleChange)="confirmVisible.set($event)" [modal]="true" [appendTo]="'body'" [baseZIndex]="1200" [blockScroll]="true" [dismissableMask]="true" [closeOnEscape]="true" [focusOnShow]="false" [style]="{ width: '34rem', maxWidth: '94vw' }" [contentStyle]="{ background: 'transparent', padding: '0', overflow: 'visible' }" [draggable]="false" [resizable]="false">
        <ui-dialog-shell title="Conferma azione" eyebrow="Superuser" subtitle="Verifica l'operazione prima di continuare." [icon]="pendingAction()?.icon || 'pi pi-shield'" [tone]="pendingAction()?.tone || 'warn'" [hasFooter]="true">
          <div *ngIf="pendingAction() as action" class="grid gap-4">
            <p class="text-sm font-semibold text-slate-900">{{ action.title }}</p>
            <p class="text-sm text-slate-600">{{ action.message }}</p>
          </div>
          <div dialog-footer class="flex items-center justify-end gap-3">
            <button class="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" (click)="closeConfirm()">Annulla</button>
            <button class="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white" (click)="confirmPendingAction()">Conferma</button>
          </div>
        </ui-dialog-shell>
      </p-dialog>

      <p-dialog [visible]="credentialsVisible()" (visibleChange)="credentialsVisible.set($event)" [modal]="true" [appendTo]="'body'" [baseZIndex]="1200" [blockScroll]="true" [dismissableMask]="true" [closeOnEscape]="true" [focusOnShow]="false" [style]="{ width: '36rem', maxWidth: '94vw' }" [contentStyle]="{ background: 'transparent', padding: '0', overflow: 'visible' }" [draggable]="false" [resizable]="false">
        <ui-dialog-shell title="Credenziali generate" eyebrow="Superuser" subtitle="Condividi la password temporanea con attenzione: dopo la chiusura non viene piu mostrata qui." icon="pi pi-key" tone="success" [hasFooter]="true">
          <div *ngIf="generatedCredentials() as credentials" class="grid gap-4">
            <div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p class="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Utente</p>
              <p class="mt-2 text-sm font-medium text-slate-900">{{ credentials.email }}</p>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Password temporanea</p>
              <p class="mt-2 font-mono text-lg text-slate-900">{{ credentials.password }}</p>
            </div>
          </div>
          <div dialog-footer class="flex items-center justify-end gap-3">
            <button class="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700" (click)="copyGeneratedPassword()">Copia password</button>
            <button class="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white" (click)="closeCredentialsModal()">Chiudi</button>
          </div>
        </ui-dialog-shell>
      </p-dialog>

      <div class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" *ngIf="formOpen()">
        <h3 class="text-lg font-semibold text-slate-900">{{ editingId() ? 'Modifica utente' : 'Nuovo utente' }}</h3>
        <div class="mt-4 grid gap-4">
          <app-user-profile-editor [profileForm]="form" [showSubmit]="false" [teamPreferenceOptions]="preferredTeamOptions()" [dutyPreferenceOptions]="preferredDutyOptions()"></app-user-profile-editor>
          <div class="grid gap-4 md:grid-cols-2">
            <select class="rounded-md border border-slate-300 px-3 py-2 text-sm" [(ngModel)]="form.role">
              <option value="volunteer">Volontario</option>
              <option value="service_leader">Leader</option>
              <option value="administrator">Amministratore</option>
            </select>
            <div>
              <p class="mb-2 text-xs text-slate-400">Clicca una chip per rimuoverla dal gruppo.</p>
              <div class="mb-2 flex flex-wrap gap-2">
                <button type="button" class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50" *ngFor="let teamId of form.teamIds" (click)="removeTeamMembership(teamId)" title="Rimuovi team assegnato">
                  <span>{{ teamNameById(teamId) }}</span>
                  <i class="pi pi-times text-[10px]"></i>
                </button>
              </div>
              <select multiple class="min-h-32 rounded-md border border-slate-300 px-3 py-2 text-sm" [(ngModel)]="form.teamIds">
                <option *ngFor="let team of teams()" [ngValue]="team.id">{{ team.name }}</option>
              </select>
            </div>
          </div>
        </div>
        <div class="mt-4 flex items-center gap-3">
          <button class="rounded-md bg-[#4979e6] px-4 py-2 text-sm font-medium text-white" (click)="saveUser()">{{ editingId() ? 'Salva' : 'Crea utente' }}</button>
          <button class="rounded-md border border-slate-300 px-4 py-2 text-sm" (click)="formOpen.set(false)">Annulla</button>
        </div>
      </div>
    </section>
  `
})
export class AdminUsersPageComponent {
  private readonly api = inject(AppApiService);
  private readonly apiError = inject(ApiErrorService);
  private readonly feedback = inject(UiFeedbackService);

  protected readonly users = signal<UserProfile[]>([]);
  protected readonly teams = signal<TeamListItem[]>([]);
  protected readonly duties = signal<DutyListItem[]>([]);
  protected readonly deliveries = signal<Array<{ channel: string; status: string; notification?: { user?: { id?: string } | null } | null }>>([]);
  protected readonly formOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly pendingAction = signal<{ title: string; message: string; run: () => void; tone: 'warn' | 'danger' | 'info'; icon: string } | null>(null);
  protected readonly generatedCredentials = signal<{ email: string; password: string } | null>(null);
  protected readonly confirmVisible = signal(false);
  protected readonly credentialsVisible = signal(false);
  protected searchQuery = '';
  protected roleFilter = '';
  protected teamFilter = '';
  protected form: ManagedUserForm = this.createEmptyForm();

  protected readonly filteredUsers = computed(() => {
    const q = this.searchQuery.trim().toLowerCase();
    return this.users().filter((user) => !q || user.fullName.toLowerCase().includes(q) || user.email.toLowerCase().includes(q));
  });
  protected readonly preferredTeamOptions = computed(() => this.teams().map((team) => ({ label: team.name, value: team.id })));
  protected readonly preferredDutyOptions = computed(() => this.duties().map((duty) => ({ label: duty.name, value: duty.id })));

  constructor() {
    this.loadTeams();
    this.loadUsers();
  }

  protected openCreate() {
    this.editingId.set(null);
    this.form = this.createEmptyForm();
    this.formOpen.set(true);
  }

  protected editUser(user: UserProfile) {
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
      tone: 'danger',
      icon: 'pi pi-trash',
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
      tone: 'warn',
      icon: 'pi pi-key',
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
      next: (users) => this.users.set(users),
      error: (error) => this.feedback.error('Utenti non caricati', this.apiError.message(error, 'Impossibile recuperare gli utenti.'))
    });
  }

  private loadTeams() {
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
      competencies: [],
      serviceNotes: '',
      role: 'volunteer',
      teamIds: []
    };
  }

  private openCredentialsModal(email: string, password: string) {
    this.generatedCredentials.set({ email, password });
    this.confirmVisible.set(false);
    queueMicrotask(() => this.credentialsVisible.set(true));
  }
}
