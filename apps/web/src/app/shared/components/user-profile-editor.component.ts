import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiAutocompleteComponent } from '@shift-complete/ui-kit';

type SelectOption = { label: string; value: string };

export type EditableUserProfileForm = {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  emergencyName: string;
  emergencyPhone: string;
  preferredShifts: string[];
  preferredTeamIds: string[];
  preferredDutyIds: string[];
  competencies: string[];
  serviceNotes: string;
};

@Component({
  selector: 'app-user-profile-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, UiAutocompleteComponent],
  template: `
    <div class="grid gap-4 md:grid-cols-2">
      <ng-container *ngIf="showIdentityFields">
        <div class="grid gap-2">
          <label class="text-sm font-medium text-slate-700">Nome completo</label>
          <input class="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" [(ngModel)]="profileForm.fullName" placeholder="Nome e cognome" />
        </div>
        <div class="grid gap-2">
          <label class="text-sm font-medium text-slate-700">Email</label>
          <input class="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" [(ngModel)]="profileForm.email" placeholder="nome@dominio.it" />
        </div>
      </ng-container>
      <div class="grid gap-2">
        <label class="text-sm font-medium text-slate-700">Telefono</label>
        <input class="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" [(ngModel)]="profileForm.phone" placeholder="+39 ..." />
      </div>
      <div class="grid gap-2">
        <label class="text-sm font-medium text-slate-700">Indirizzo</label>
        <input class="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" [(ngModel)]="profileForm.address" placeholder="Via e citta" />
      </div>
      <div class="grid gap-2">
        <label class="text-sm font-medium text-slate-700">Contatto emergenza</label>
        <input class="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" [(ngModel)]="profileForm.emergencyName" placeholder="Nome e cognome" />
      </div>
      <div class="grid gap-2">
        <label class="text-sm font-medium text-slate-700">Telefono emergenza</label>
        <input class="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" [(ngModel)]="profileForm.emergencyPhone" placeholder="+39 ..." />
      </div>
      <ui-autocomplete label="Preferenze turni" [options]="shiftPreferenceOptions" [value]="selectedShiftPreference()" (valueChange)="selectedShiftPreference.set(asRecord($event))"></ui-autocomplete>
      <ui-autocomplete label="Competenze" [options]="competencyOptions" [value]="selectedCompetency()" (valueChange)="selectedCompetency.set(asRecord($event))"></ui-autocomplete>
      <ui-autocomplete *ngIf="teamPreferenceOptions.length" label="Team preferiti" [options]="teamPreferenceOptions" [value]="selectedPreferredTeam()" (valueChange)="selectedPreferredTeam.set(asRecord($event))"></ui-autocomplete>
      <ui-autocomplete *ngIf="dutyPreferenceOptions.length" label="Mansioni preferite" [options]="dutyPreferenceOptions" [value]="selectedPreferredDuty()" (valueChange)="selectedPreferredDuty.set(asRecord($event))"></ui-autocomplete>
      <div class="flex gap-2 md:col-span-2">
        <button type="button" class="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-600" (click)="addShiftPreference()">Aggiungi preferenza</button>
        <button type="button" class="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-600" (click)="addCompetency()">Aggiungi competenza</button>
        <button *ngIf="teamPreferenceOptions.length" type="button" class="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-600" (click)="addPreferredTeam()">Aggiungi team</button>
        <button *ngIf="dutyPreferenceOptions.length" type="button" class="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-600" (click)="addPreferredDuty()">Aggiungi mansione</button>
      </div>
      <div class="md:col-span-2">
        <p class="mb-2 text-xs text-slate-400">Clicca una chip per rimuoverla.</p>
        <div class="flex flex-wrap gap-2">
        <button type="button" class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50" *ngFor="let item of profileForm.preferredShifts" (click)="removeShiftPreference(item)" title="Rimuovi preferenza turno">
          <span>{{ item }}</span>
          <i class="pi pi-times text-[10px]"></i>
        </button>
        <button type="button" class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50" *ngFor="let item of profileForm.competencies" (click)="removeCompetency(item)" title="Rimuovi competenza">
          <span>{{ item }}</span>
          <i class="pi pi-times text-[10px]"></i>
        </button>
        <button type="button" class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50" *ngFor="let item of selectedTeamLabels()" (click)="removePreferredTeamByLabel(item)" title="Rimuovi team preferito">
          <span>Team: {{ item }}</span>
          <i class="pi pi-times text-[10px]"></i>
        </button>
        <button type="button" class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50" *ngFor="let item of selectedDutyLabels()" (click)="removePreferredDutyByLabel(item)" title="Rimuovi mansione preferita">
          <span>Mansione: {{ item }}</span>
          <i class="pi pi-times text-[10px]"></i>
        </button>
        </div>
      </div>
      <div class="grid gap-2 md:col-span-2">
        <label class="text-sm font-medium text-slate-700">Note servizio</label>
        <textarea class="min-h-28 rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" [(ngModel)]="profileForm.serviceNotes" placeholder="Preferenze, note operative, certificazioni"></textarea>
      </div>
    </div>
    <div class="mt-4 flex justify-end" *ngIf="showSubmit">
      <button type="button" class="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-60" (click)="save.emit()" [disabled]="saving">{{ saving ? 'Salvataggio...' : submitLabel }}</button>
    </div>
  `,
})
export class UserProfileEditorComponent implements OnChanges {
  @Input({ required: true }) profileForm!: EditableUserProfileForm;
  @Input() saving = false;
  @Input() submitLabel = 'Salva profilo';
  @Input() showIdentityFields = true;
  @Input() showSubmit = true;
  @Input() teamPreferenceOptions: SelectOption[] = [];
  @Input() dutyPreferenceOptions: SelectOption[] = [];
  @Output() readonly save = new EventEmitter<void>();

  protected readonly selectedShiftPreference = signal<Record<string, unknown> | null>(null);
  protected readonly selectedCompetency = signal<Record<string, unknown> | null>(null);
  protected readonly selectedPreferredTeam = signal<Record<string, unknown> | null>(null);
  protected readonly selectedPreferredDuty = signal<Record<string, unknown> | null>(null);
  protected readonly shiftPreferenceOptions = [
    { label: 'Mattina', value: 'morning' },
    { label: 'Pomeriggio', value: 'afternoon' },
    { label: 'Sera', value: 'evening' },
    { label: 'Weekend', value: 'weekend' },
  ];
  protected readonly competencyOptions = [
    { label: 'Audio', value: 'audio' },
    { label: 'Luci', value: 'lights' },
    { label: 'Accoglienza', value: 'welcome' },
    { label: 'Primo soccorso', value: 'medical' },
    { label: 'Logistica', value: 'logistics' },
  ];
  protected readonly selectedTeamLabels = signal<string[]>([]);
  protected readonly selectedDutyLabels = signal<string[]>([]);

  protected asRecord(value: unknown): Record<string, unknown> | null {
    return (value as Record<string, unknown> | null) ?? null;
  }

  protected addShiftPreference(): void {
    const value = String(this.selectedShiftPreference()?.['value'] ?? '');
    if (value && !this.profileForm.preferredShifts.includes(value)) {
      this.profileForm.preferredShifts = [...this.profileForm.preferredShifts, value];
    }
    this.selectedShiftPreference.set(null);
  }

  protected addCompetency(): void {
    const value = String(this.selectedCompetency()?.['value'] ?? '');
    if (value && !this.profileForm.competencies.includes(value)) {
      this.profileForm.competencies = [...this.profileForm.competencies, value];
    }
    this.selectedCompetency.set(null);
  }

  protected removeShiftPreference(item: string): void {
    this.profileForm.preferredShifts = this.profileForm.preferredShifts.filter((value) => value !== item);
  }

  protected removeCompetency(item: string): void {
    this.profileForm.competencies = this.profileForm.competencies.filter((value) => value !== item);
  }

  protected addPreferredTeam(): void {
    const value = String(this.selectedPreferredTeam()?.['value'] ?? '');
    if (value && !this.profileForm.preferredTeamIds.includes(value)) {
      this.profileForm.preferredTeamIds = [...this.profileForm.preferredTeamIds, value];
    }
    this.selectedPreferredTeam.set(null);
    this.syncSelectedLabels();
  }

  protected addPreferredDuty(): void {
    const value = String(this.selectedPreferredDuty()?.['value'] ?? '');
    if (value && !this.profileForm.preferredDutyIds.includes(value)) {
      this.profileForm.preferredDutyIds = [...this.profileForm.preferredDutyIds, value];
    }
    this.selectedPreferredDuty.set(null);
    this.syncSelectedLabels();
  }

  protected removePreferredTeamByLabel(label: string): void {
    const option = this.teamPreferenceOptions.find((item) => item.label === label);
    if (!option) {
      return;
    }
    this.profileForm.preferredTeamIds = this.profileForm.preferredTeamIds.filter((value) => value !== option.value);
    this.syncSelectedLabels();
  }

  protected removePreferredDutyByLabel(label: string): void {
    const option = this.dutyPreferenceOptions.find((item) => item.label === label);
    if (!option) {
      return;
    }
    this.profileForm.preferredDutyIds = this.profileForm.preferredDutyIds.filter((value) => value !== option.value);
    this.syncSelectedLabels();
  }

  ngOnChanges(): void {
    this.syncSelectedLabels();
  }

  private syncSelectedLabels(): void {
    this.selectedTeamLabels.set(
      this.profileForm.preferredTeamIds
        .map((id) => this.teamPreferenceOptions.find((option) => option.value === id)?.label)
        .filter((label): label is string => Boolean(label))
    );
    this.selectedDutyLabels.set(
      this.profileForm.preferredDutyIds
        .map((id) => this.dutyPreferenceOptions.find((option) => option.value === id)?.label)
        .filter((label): label is string => Boolean(label))
    );
  }
}
