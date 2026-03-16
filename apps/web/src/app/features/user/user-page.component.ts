import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiCardComponent, UiLabelComponent } from '@shift-complete/ui-kit';
import { UserProfile } from '@shift-complete/shared-types';
import { ApiErrorService } from '../../core/services/api-error.service';
import { SessionService } from '../../core/services/session.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { AppApiService } from '../../shared/services/app-api.service';
import { UserProfileEditorComponent } from '../../shared/components/user-profile-editor.component';

@Component({
  selector: 'app-user-page',
  standalone: true,
  imports: [CommonModule, FormsModule, UiCardComponent, UiLabelComponent, UserProfileEditorComponent],
  template: `
    <section class="mx-auto grid max-w-6xl gap-6">
      <header class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-orange-600">User page</p>
          <h2 class="text-3xl font-semibold tracking-tight text-slate-900">Profilo personale, contatti e credenziali.</h2>
          <p class="mt-2 text-sm text-slate-500">Aggiorna i tuoi dati operativi e cambia password senza uscire dal workspace.</p>
        </div>
        <div class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm" *ngIf="profile() as user">
          <div class="flex h-12 w-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,#3156b3,#4979e6)] text-sm font-semibold text-white">
            {{ initials(user.fullName) }}
          </div>
          <div>
            <p class="font-medium text-slate-900">{{ user.fullName }}</p>
            <p class="text-xs text-slate-500">{{ roleLabel() }} · {{ user.email }}</p>
          </div>
        </div>
      </header>

      <div class="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <ui-card title="Snapshot utente" subtitle="Stato rapido di identita e copertura profilo">
          <div class="grid gap-4">
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Ruolo</p>
              <p class="mt-2 text-lg font-semibold text-slate-900">{{ roleLabel() }}</p>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Team attivi</p>
              <div class="mt-3 flex flex-wrap gap-2">
                <ui-label *ngFor="let team of activeTeamNames()" tone="neutral">{{ team }}</ui-label>
                <span class="text-sm text-slate-400" *ngIf="!activeTeamNames().length">Nessun team assegnato</span>
              </div>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Checklist profilo</p>
              <div class="mt-3 grid gap-2 text-sm">
                <div class="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                  <span class="text-slate-600">Identita e contatti</span>
                  <ui-label [tone]="identityComplete() ? 'success' : 'warn'">{{ identityComplete() ? 'ok' : 'incompleto' }}</ui-label>
                </div>
                <div class="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                  <span class="text-slate-600">Emergenze</span>
                  <ui-label [tone]="emergencyComplete() ? 'success' : 'warn'">{{ emergencyComplete() ? 'ok' : 'incompleto' }}</ui-label>
                </div>
                <div class="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                  <span class="text-slate-600">Preferenze operative</span>
                  <ui-label [tone]="preferencesComplete() ? 'success' : 'warn'">{{ preferencesComplete() ? 'ok' : 'incompleto' }}</ui-label>
                </div>
              </div>
            </div>
          </div>
        </ui-card>

        <div class="grid gap-4">
          <ui-card title="Informazioni profilo" subtitle="Dati personali e preferenze di servizio">
            <app-user-profile-editor [profileForm]="profileForm" [saving]="savingProfile()" submitLabel="Salva profilo" (save)="saveProfile()"></app-user-profile-editor>
          </ui-card>

          <ui-card title="Credenziali" subtitle="Cambio password con verifica della password attuale">
            <div class="grid gap-4 md:grid-cols-2">
              <div class="grid gap-2 md:col-span-2">
                <label class="text-sm font-medium text-slate-700">Password attuale</label>
                <div class="relative">
                  <input class="w-full rounded-2xl border border-slate-200 px-4 py-3 pr-11 text-sm outline-none" [type]="showCurrentPassword() ? 'text' : 'password'" [(ngModel)]="passwordForm.currentPassword" placeholder="Inserisci la password attuale" />
                  <button type="button" class="absolute inset-y-0 right-0 px-4 text-slate-400 hover:text-[#4979e6]" (click)="showCurrentPassword.set(!showCurrentPassword())">
                    <i class="pi" [class.pi-eye]="!showCurrentPassword()" [class.pi-eye-slash]="showCurrentPassword()"></i>
                  </button>
                </div>
              </div>
              <div class="grid gap-2 md:col-span-2">
                <label class="text-sm font-medium text-slate-700">Nuova password</label>
                <div class="relative">
                  <input class="w-full rounded-2xl border border-slate-200 px-4 py-3 pr-11 text-sm outline-none" [type]="showNewPassword() ? 'text' : 'password'" [(ngModel)]="passwordForm.newPassword" placeholder="Almeno 6 caratteri" />
                  <button type="button" class="absolute inset-y-0 right-0 px-4 text-slate-400 hover:text-[#4979e6]" (click)="showNewPassword.set(!showNewPassword())">
                    <i class="pi" [class.pi-eye]="!showNewPassword()" [class.pi-eye-slash]="showNewPassword()"></i>
                  </button>
                </div>
              </div>
            </div>
            <div class="mt-4 flex items-center justify-between gap-3">
              <p class="text-xs text-slate-500">Dopo il cambio password la sessione resta valida e il nuovo accesso usa subito la credenziale aggiornata.</p>
              <button type="button" class="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 disabled:opacity-60" (click)="changePassword()" [disabled]="savingPassword()">{{ savingPassword() ? 'Aggiornamento...' : 'Aggiorna password' }}</button>
            </div>
          </ui-card>
        </div>
      </div>
    </section>
  `,
})
export class UserPageComponent {
  private readonly api = inject(AppApiService);
  private readonly apiError = inject(ApiErrorService);
  private readonly feedback = inject(UiFeedbackService);
  private readonly session = inject(SessionService);

  protected readonly profile = signal<UserProfile | null>(this.session.getCurrentUser());
  protected readonly teams = signal<Array<{ id: string; name: string }>>([]);
  protected readonly savingProfile = signal(false);
  protected readonly savingPassword = signal(false);
  protected readonly showCurrentPassword = signal(false);
  protected readonly showNewPassword = signal(false);

  protected profileForm = this.emptyProfileForm();
  protected passwordForm = { currentPassword: '', newPassword: '' };

  protected readonly activeTeamNames = computed(() => {
    const profile = this.profile();
    if (!profile) {
      return [];
    }
    return profile.activeTeamIds
      .map((teamId) => this.teams().find((team) => team.id === teamId)?.name)
      .filter((teamName): teamName is string => Boolean(teamName));
  });
  protected readonly identityComplete = computed(() => Boolean(this.profileForm.fullName.trim() && this.profileForm.email.trim() && this.profileForm.phone.trim()));
  protected readonly emergencyComplete = computed(() => Boolean(this.profileForm.emergencyName.trim() && this.profileForm.emergencyPhone.trim()));
  protected readonly preferencesComplete = computed(() => this.profileForm.preferredShifts.length > 0 && this.profileForm.competencies.length > 0);

  constructor() {
    this.api.me().subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.patchProfile(profile);
      },
      error: (error) => this.feedback.error('Profilo non disponibile', this.apiError.message(error, 'Impossibile recuperare il profilo utente.')),
    });
    this.api.teams().subscribe({ next: (teams) => this.teams.set(teams.map((team) => ({ id: team.id, name: team.name }))) });
  }

  protected initials(fullName: string): string {
    return fullName.split(' ').filter(Boolean).slice(0, 2).map((chunk) => chunk[0]?.toUpperCase() ?? '').join('') || 'SC';
  }

  protected roleLabel(): string {
    const role = this.profile()?.role;
    if (role === 'administrator') return 'Amministratore';
    if (role === 'service_leader') return 'Leader del servizio';
    return 'Volontario';
  }

  protected saveProfile(): void {
    const currentProfile = this.profile();
    if (!currentProfile) {
      return;
    }

    this.savingProfile.set(true);
    this.api.updateMe({
      fullName: this.profileForm.fullName.trim() || undefined,
      email: this.profileForm.email.trim() || undefined,
      phone: this.profileForm.phone.trim() || undefined,
      address: this.profileForm.address.trim() || undefined,
      emergencyName: this.profileForm.emergencyName.trim() || undefined,
      emergencyPhone: this.profileForm.emergencyPhone.trim() || undefined,
      preferredShifts: this.profileForm.preferredShifts,
      preferredTeamIds: currentProfile.activeTeamIds,
      competencies: this.profileForm.competencies,
      serviceNotes: this.profileForm.serviceNotes.trim() || undefined,
    }).subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.patchProfile(profile);
        this.session.setSession(profile, localStorage.getItem('shift.token') ?? '');
        this.savingProfile.set(false);
        this.feedback.success('Profilo aggiornato', 'Le informazioni personali sono state salvate correttamente.');
      },
      error: (error) => {
        this.savingProfile.set(false);
        this.feedback.error('Profilo non salvato', this.apiError.message(error, 'Impossibile aggiornare il profilo utente.'));
      },
    });
  }

  protected changePassword(): void {
    if (this.passwordForm.currentPassword.trim().length < 6 || this.passwordForm.newPassword.trim().length < 6) {
      this.feedback.error('Credenziali non valide', 'Inserisci password attuale e nuova password di almeno 6 caratteri.');
      return;
    }

    this.savingPassword.set(true);
    this.api.changeMyPassword({
      currentPassword: this.passwordForm.currentPassword,
      newPassword: this.passwordForm.newPassword,
    }).subscribe({
      next: () => {
        this.savingPassword.set(false);
        this.passwordForm = { currentPassword: '', newPassword: '' };
        this.showCurrentPassword.set(false);
        this.showNewPassword.set(false);
        this.feedback.success('Password aggiornata', 'La nuova password e attiva da subito.');
      },
      error: (error) => {
        this.savingPassword.set(false);
        this.feedback.error('Password non aggiornata', this.apiError.message(error, 'Impossibile aggiornare la password.'));
      },
    });
  }

  private patchProfile(profile: UserProfile): void {
    this.profileForm = {
      fullName: profile.fullName ?? '',
      email: profile.email ?? '',
      phone: profile.phone ?? '',
      address: profile.address ?? '',
      emergencyName: profile.emergencyName ?? '',
      emergencyPhone: profile.emergencyPhone ?? '',
      preferredShifts: profile.preferredShifts ?? [],
      preferredTeamIds: profile.preferredTeamIds ?? [],
      preferredDutyIds: profile.preferredDutyIds ?? [],
      competencies: profile.competencies ?? [],
      serviceNotes: profile.serviceNotes ?? '',
    };
  }

  private emptyProfileForm() {
    return {
      fullName: '',
      email: '',
      phone: '',
      address: '',
      emergencyName: '',
      emergencyPhone: '',
      preferredShifts: [] as string[],
      preferredTeamIds: [] as string[],
      preferredDutyIds: [] as string[],
      competencies: [] as string[],
      serviceNotes: '',
    };
  }
}
