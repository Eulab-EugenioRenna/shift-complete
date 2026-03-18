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
  templateUrl: './user-page.component.html',
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
