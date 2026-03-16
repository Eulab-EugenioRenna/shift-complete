import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiCardComponent, UiDatePickerComponent, UiLabelComponent, UiSelectComponent, UiTableShellComponent, UiToggleComponent } from '@shift-complete/ui-kit';
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
  imports: [CommonModule, FormsModule, UiCardComponent, UiDatePickerComponent, UiLabelComponent, UiSelectComponent, UiTableShellComponent, UiToggleComponent, UserProfileEditorComponent],
  template: `
    <section class="mx-auto grid max-w-6xl gap-6">
      <header>
        <p class="text-sm uppercase tracking-[0.3em] text-orange-600">Onboarding e disponibilita</p>
        <h2 class="text-3xl font-semibold tracking-tight text-slate-900">Profilo, disponibilita, preferenze e competenze operative.</h2>
      </header>

      <div class="grid gap-4 xl:grid-cols-[0.95fr_1.05fr_1.25fr]">
        <ui-card title="Checklist onboarding" subtitle="Passaggi essenziali per volontari e leader">
          <div class="grid gap-3">
            <div class="rounded-2xl border p-4" [class.border-emerald-200]="profileCompletion()" [class.bg-emerald-50]="profileCompletion()" [class.border-slate-200]="!profileCompletion()">
              <p class="font-medium text-slate-900">1. Profilo</p>
              <p class="mt-2 text-sm text-slate-500">Anagrafica, contatti ed emergenze.</p>
            </div>
            <div class="rounded-2xl border p-4" [class.border-emerald-200]="preferencesCompletion()" [class.bg-emerald-50]="preferencesCompletion()" [class.border-slate-200]="!preferencesCompletion()">
              <p class="font-medium text-slate-900">2. Preferenze</p>
              <p class="mt-2 text-sm text-slate-500">Turni preferiti, team e mansioni.</p>
            </div>
            <div class="rounded-2xl border p-4" [class.border-emerald-200]="availabilityCompletion()" [class.bg-emerald-50]="availabilityCompletion()" [class.border-slate-200]="!availabilityCompletion()">
              <p class="font-medium text-slate-900">3. Disponibilita</p>
              <p class="mt-2 text-sm text-slate-500">Fasce orarie, indisponibilita e note servizio.</p>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p class="text-xs font-semibold uppercase tracking-widest text-slate-400">Stato</p>
              <p class="mt-2 text-sm text-slate-700">{{ onboardingSummary() }}</p>
            </div>
          </div>
        </ui-card>

        <ui-card title="Profilo volontario" subtitle="Contatti, competenze e preferenze di servizio">
          <app-user-profile-editor [profileForm]="profileForm" [saving]="savingProfile()" [showIdentityFields]="false" submitLabel="Salva profilo" (save)="saveProfile()"></app-user-profile-editor>
        </ui-card>

        <ui-card title="Gestione disponibilita" subtitle="Creazione, modifica inline e collegamento al team">
          <div class="grid gap-4 md:grid-cols-2">
            <div class="grid gap-2 md:col-span-2" *ngIf="canManageOthers()">
              <label class="text-sm font-medium text-slate-700">Persona</label>
              <ui-select [options]="personOptions()" [value]="selectedUserId()" (valueChange)="onUserChange($event)"></ui-select>
            </div>
            <div class="grid gap-2">
              <label class="text-sm font-medium text-slate-700">Tipo</label>
              <ui-select [options]="typeOptions" [value]="form.type" (valueChange)="form.type = castType($event)"></ui-select>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <ui-toggle label="Disponibile" [value]="form.type === 'AVAILABLE'" (valueChange)="form.type = $event ? 'AVAILABLE' : 'UNAVAILABLE'"></ui-toggle>
            </div>
            <ui-date-picker label="Inizio" [(value)]="form.startsAt" [showTime]="true" hourFormat="24" [baseZIndex]="1400" inputStyleClass="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"></ui-date-picker>
            <ui-date-picker label="Fine" [(value)]="form.endsAt" [showTime]="true" hourFormat="24" [baseZIndex]="1400" inputStyleClass="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none"></ui-date-picker>
            <div class="grid gap-2 md:col-span-2">
              <label class="text-sm font-medium text-slate-700">Motivo</label>
              <input class="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" [(ngModel)]="form.reason" placeholder="Es. lavoro, ferie, preferenza personale" />
            </div>
            <div class="grid gap-2 md:col-span-2">
              <label class="text-sm font-medium text-slate-700">Team collegato</label>
              <ui-select [options]="teamOptions()" [value]="form.teamId" (valueChange)="form.teamId = castNullable($event)"></ui-select>
            </div>
          </div>
          <div class="mt-4 flex justify-end gap-2">
            <button type="button" class="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-600" (click)="resetForm()">Reset</button>
            <button type="button" class="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-60" (click)="saveAvailability()" [disabled]="!canSave() || savingAvailability()">
              {{ savingAvailability() ? 'Salvataggio...' : (editingAvailabilityId() ? 'Aggiorna disponibilita' : 'Salva disponibilita') }}
            </button>
          </div>

          <div class="mt-6">
            <ui-table-shell title="Storico disponibilita">
              <table class="min-w-full text-sm">
                <thead class="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th class="px-4 py-3">Tipo</th>
                    <th class="px-4 py-3">Inizio</th>
                    <th class="px-4 py-3">Fine</th>
                    <th class="px-4 py-3">Motivo</th>
                    <th class="px-4 py-3">Azione</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let item of availability()" class="border-t border-slate-100">
                    <td class="px-4 py-3"><ui-label [tone]="item.type === 'AVAILABLE' ? 'success' : 'warn'">{{ item.type }}</ui-label></td>
                    <td class="px-4 py-3">{{ item.startsAt | date:'short' }}</td>
                    <td class="px-4 py-3">{{ item.endsAt | date:'short' }}</td>
                    <td class="px-4 py-3">{{ item.reason || '-' }}</td>
                    <td class="px-4 py-3">
                      <button type="button" class="mr-3 text-sm text-slate-700" (click)="editAvailability(item)">Modifica</button>
                      <button type="button" class="text-sm text-red-600" (click)="removeAvailability(item.id)">Elimina</button>
                    </td>
                  </tr>
                  <tr *ngIf="!availability().length">
                    <td colspan="5" class="px-4 py-6 text-center text-sm text-slate-400">Nessuna disponibilita registrata per la persona selezionata.</td>
                  </tr>
                </tbody>
              </table>
            </ui-table-shell>
          </div>
        </ui-card>
      </div>
    </section>
  `,
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
    this.api.deleteAvailability(availabilityId).subscribe({
      next: () => {
        this.loadAvailability();
        this.feedback.success('Disponibilita eliminata');
      },
      error: (error) => this.feedback.error('Eliminazione non riuscita', this.apiError.message(error, 'Impossibile eliminare la disponibilita.'))
    });
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
