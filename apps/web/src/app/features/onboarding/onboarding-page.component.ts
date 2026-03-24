import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiButtonComponent, UiCardComponent, UiConfirmDialogComponent, UiDatePickerComponent, UiFieldComponent, UiFormSectionComponent, UiInputComponent, UiLabelComponent, UiPageHeaderComponent, UiSelectComponent, UiTableShellComponent, UiToggleComponent } from '@shift-complete/ui-kit';
import { UserProfile } from '@shift-complete/shared-types';
import { ApiErrorService } from '../../core/services/api-error.service';
import { SessionService } from '../../core/services/session.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { fromIsoDateTime, toIsoDateTime } from '../../core/utils/date-picker.util';
import { AppApiService } from '../../shared/services/app-api.service';
import { UserProfileEditorComponent } from '../../shared/components/user-profile-editor.component';

type AvailabilityType = 'AVAILABLE' | 'UNAVAILABLE';
type AvailabilityRow = {
  id: string;
  userId: string;
  teamId?: string | null;
  type: AvailabilityType;
  startsAt: string;
  endsAt: string;
  reason?: string | null;
};

@Component({
  selector: 'app-onboarding-page',
  standalone: true,
  imports: [CommonModule, FormsModule, UiButtonComponent, UiCardComponent, UiConfirmDialogComponent, UiDatePickerComponent, UiFieldComponent, UiFormSectionComponent, UiInputComponent, UiLabelComponent, UiPageHeaderComponent, UiSelectComponent, UiTableShellComponent, UiToggleComponent, UserProfileEditorComponent],
  templateUrl: './onboarding-page.component.html',
})
export class OnboardingPageComponent {
  private readonly api = inject(AppApiService);
  private readonly apiError = inject(ApiErrorService);
  private readonly feedback = inject(UiFeedbackService);
  private readonly session = inject(SessionService);

  protected readonly availability = signal<AvailabilityRow[]>([]);
  protected readonly users = signal<UserProfile[]>([]);
  protected readonly teams = signal<Array<{ id: string; name: string }>>([]);
  protected readonly selectedUserId = signal<string | null>(null);
  protected readonly editingAvailabilityId = signal<string | null>(null);
  protected readonly savingProfile = signal(false);
  protected readonly savingAvailability = signal(false);
  protected readonly confirmVisible = signal(false);
  protected readonly pendingDeleteAvailability = signal<AvailabilityRow | null>(null);
  protected readonly canManageOthers = computed(() => this.users().length > 1);
  protected readonly profileCompletion = computed(() => Boolean(this.profileForm.phone && this.profileForm.emergencyName && this.profileForm.emergencyPhone));
  protected readonly preferencesCompletion = computed(() => this.profileForm.preferredShifts.length > 0 && this.profileForm.competencies.length > 0);
  protected readonly availabilityCompletion = computed(() => this.availability().length > 0);
  protected readonly onboardingSummary = computed(() => {
    const completed = [this.profileCompletion(), this.preferencesCompletion(), this.availabilityCompletion()].filter(Boolean).length;
    return `${completed}/3 aree completate. Ogni salvataggio aggiorna profilo, regole e storico operativo.`;
  });
  protected readonly teamOptions = computed(() => this.teams().map((team) => ({ label: team.name, value: team.id })));
  protected readonly personOptions = computed(() => this.users().map((user) => ({ label: `${user.fullName} · ${user.role}`, value: user.id })));
  protected readonly typeOptions = [
    { label: 'Disponibile', value: 'AVAILABLE' },
    { label: 'Non disponibile', value: 'UNAVAILABLE' },
  ];
  protected form = this.createEmptyForm();
  protected profileForm = {
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

  constructor() {
    this.loadContext();
  }

  protected castType(value: unknown): AvailabilityType {
    return value === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE';
  }

  protected castNullable(value: unknown): string | null {
    return value ? String(value) : null;
  }

  protected onUserChange(value: unknown): void {
    this.selectedUserId.set(value ? String(value) : null);
    this.loadAvailability();
  }

  protected canSave(): boolean {
    return Boolean(this.selectedUserId() && this.form.startsAt && this.form.endsAt && this.form.startsAt < this.form.endsAt);
  }

  protected saveAvailability(): void {
    if (!this.canSave()) {
      this.feedback.error('Disponibilita non valida', 'Controlla data iniziale, finale e persona selezionata.');
      return;
    }

    const payload = {
      teamId: this.form.teamId || undefined,
      type: this.form.type,
      startsAt: toIsoDateTime(this.form.startsAt),
      endsAt: toIsoDateTime(this.form.endsAt),
      reason: this.form.reason.trim() || undefined,
    };

    const request = this.editingAvailabilityId()
      ? this.api.updateAvailability(this.editingAvailabilityId() as string, payload)
      : this.api.createAvailability(payload, this.selectedUserId() ?? undefined);

    this.savingAvailability.set(true);
    request.subscribe({
      next: () => {
        this.resetForm();
        this.loadAvailability();
        this.savingAvailability.set(false);
        this.feedback.success('Disponibilita salvata', 'La fascia oraria e stata sincronizzata correttamente.');
      },
      error: (error) => {
        this.savingAvailability.set(false);
        this.feedback.error('Salvataggio non riuscito', this.apiError.message(error, 'Impossibile salvare la disponibilita.'));
      },
    });
  }

  protected editAvailability(item: AvailabilityRow): void {
    this.editingAvailabilityId.set(item.id);
    this.form = {
      type: item.type,
      startsAt: fromIsoDateTime(item.startsAt) ?? new Date(item.startsAt),
      endsAt: fromIsoDateTime(item.endsAt) ?? new Date(item.endsAt),
      reason: item.reason ?? '',
      teamId: item.teamId ?? null,
    };
  }

  protected removeAvailability(availabilityId: string): void {
    this.pendingDeleteAvailability.set(this.availability().find((item) => item.id === availabilityId) ?? null);
    this.confirmVisible.set(true);
  }

  protected confirmDeleteAvailability(): void {
    const pending = this.pendingDeleteAvailability();
    if (!pending) {
      return;
    }

    this.api.deleteAvailability(pending.id).subscribe({
      next: () => {
        this.closeDeleteConfirm();
        this.loadAvailability();
        this.feedback.success('Disponibilita eliminata');
      },
      error: (error) => this.feedback.error('Eliminazione non riuscita', this.apiError.message(error, 'Impossibile eliminare la disponibilita.'))
    });
  }

  protected closeDeleteConfirm(): void {
    this.confirmVisible.set(false);
    this.pendingDeleteAvailability.set(null);
  }

  protected resetForm(): void {
    this.editingAvailabilityId.set(null);
    this.form = this.createEmptyForm();
  }

  protected saveProfile(): void {
    this.savingProfile.set(true);
    this.api.updateMe({
      fullName: this.profileForm.fullName || undefined,
      email: this.profileForm.email || undefined,
      phone: this.profileForm.phone || undefined,
      address: this.profileForm.address || undefined,
      emergencyName: this.profileForm.emergencyName || undefined,
      emergencyPhone: this.profileForm.emergencyPhone || undefined,
      preferredShifts: this.profileForm.preferredShifts,
      preferredTeamIds: this.session.getCurrentUser()?.activeTeamIds ?? [],
      competencies: this.profileForm.competencies,
      serviceNotes: this.profileForm.serviceNotes || undefined,
    }).subscribe({
      next: (profile) => {
        const token = localStorage.getItem('shift.token') ?? '';
        this.session.setSession(profile, token);
        this.patchProfileForm(profile);
        this.savingProfile.set(false);
        this.feedback.success('Profilo aggiornato', 'Le preferenze del volontario sono state salvate e tracciate.');
      },
      error: (error) => {
        this.savingProfile.set(false);
        this.feedback.error('Profilo non salvato', this.apiError.message(error, 'Impossibile aggiornare il profilo.'));
      }
    });
  }

  private createEmptyForm() {
      return {
        type: 'AVAILABLE' as AvailabilityType,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        reason: '',
        teamId: null as string | null,
      };
  }

  private loadContext(): void {
    this.api.teams().subscribe({ next: (teams) => this.teams.set(teams.map((team) => ({ id: team.id, name: team.name }))) });

    this.api.users().subscribe({
      next: (users) => {
        this.users.set(users);
        const currentUserId = this.session.getCurrentUser()?.id;
        const currentUser = users.find((user) => user.id === currentUserId) ?? users[0] ?? null;
        this.selectedUserId.set(currentUser?.id ?? null);
        if (currentUser) {
          this.patchProfileForm(currentUser);
        }
        this.loadAvailability();
      },
      error: () => {
        this.api.me().subscribe({
          next: (user) => {
            this.users.set([user]);
            this.selectedUserId.set(user.id);
            this.patchProfileForm(user);
            this.loadAvailability();
          },
          error: (error) => this.feedback.error('Onboarding non disponibile', this.apiError.message(error, 'Impossibile caricare il contesto onboarding.'))
        });
      },
    });
  }

  private patchProfileForm(user: UserProfile): void {
    this.profileForm = {
      fullName: user.fullName ?? '',
      email: user.email ?? '',
      phone: user.phone ?? '',
      address: user.address ?? '',
      emergencyName: user.emergencyName ?? '',
      emergencyPhone: user.emergencyPhone ?? '',
      preferredShifts: user.preferredShifts ?? [],
      preferredTeamIds: user.preferredTeamIds ?? [],
      preferredDutyIds: user.preferredDutyIds ?? [],
      competencies: user.competencies ?? [],
      serviceNotes: user.serviceNotes ?? '',
    };
  }

  private loadAvailability(): void {
    const userId = this.selectedUserId();
    if (!userId) {
      this.availability.set([]);
      return;
    }

    this.api.availability(userId).subscribe({
      next: (items) => this.availability.set(items as AvailabilityRow[]),
      error: (error) => this.feedback.error('Storico disponibilita non caricato', this.apiError.message(error, 'Impossibile recuperare la disponibilita.'))
    });
  }
}
