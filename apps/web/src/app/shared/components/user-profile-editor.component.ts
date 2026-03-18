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
  templateUrl: './user-profile-editor.component.html',
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
