import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiButtonComponent, UiChipComponent, UiFieldComponent, UiFormSectionComponent, UiInputComponent, UiMultiSelectComponent, UiTextareaComponent } from '@shift-complete/ui-kit';

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
  preferredLocationValues: string[];
  competencies: string[];
  serviceNotes: string;
};

@Component({
  selector: 'app-user-profile-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, UiButtonComponent, UiChipComponent, UiFieldComponent, UiFormSectionComponent, UiInputComponent, UiMultiSelectComponent, UiTextareaComponent],
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
  @Input() shiftPreferenceOptions: SelectOption[] = [];
  @Input() locationPreferenceOptions: SelectOption[] = [];
  @Input() competencyOptions: SelectOption[] = [];
  @Output() readonly save = new EventEmitter<void>();

  protected readonly selectedTeamLabels = signal<string[]>([]);
  protected readonly selectedDutyLabels = signal<string[]>([]);
  protected readonly selectedLocationLabels = signal<string[]>([]);
  protected readonly selectedShiftLabels = computed(() =>
    this.profileForm.preferredShifts
      .map((id) => this.shiftPreferenceOptions.find((option) => option.value === id)?.label ?? id)
  );
  protected readonly selectedCompetencyLabels = computed(() =>
    this.profileForm.competencies
      .map((id) => this.competencyOptions.find((option) => option.value === id)?.label ?? id)
  );

  protected removeShiftPreference(item: string): void {
    this.profileForm.preferredShifts = this.profileForm.preferredShifts.filter((value) => value !== item);
  }

  protected removeCompetency(item: string): void {
    this.profileForm.competencies = this.profileForm.competencies.filter((value) => value !== item);
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

  protected setShiftPreferences(value: unknown[] | null | undefined): void {
    this.profileForm.preferredShifts = (value ?? []).map((item) => String(item));
  }

  protected setCompetencies(value: unknown[] | null | undefined): void {
    this.profileForm.competencies = (value ?? []).map((item) => String(item));
  }

  protected setPreferredTeams(value: unknown[] | null | undefined): void {
    this.profileForm.preferredTeamIds = (value ?? []).map((item) => String(item));
    this.syncSelectedLabels();
  }

  protected setPreferredDuties(value: unknown[] | null | undefined): void {
    this.profileForm.preferredDutyIds = (value ?? []).map((item) => String(item));
    this.syncSelectedLabels();
  }

  protected setPreferredLocations(value: unknown[] | null | undefined): void {
    this.profileForm.preferredLocationValues = (value ?? []).map((item) => String(item));
    this.syncSelectedLabels();
  }

  protected shiftLabel(value: string): string {
    return this.shiftPreferenceOptions.find((option) => option.value === value)?.label ?? value;
  }

  protected competencyLabel(value: string): string {
    return this.competencyOptions.find((option) => option.value === value)?.label ?? value;
  }

  protected locationLabel(value: string): string {
    return this.locationPreferenceOptions.find((option) => option.value === value)?.label ?? value;
  }

  protected removePreferredLocation(value: string): void {
    this.profileForm.preferredLocationValues = this.profileForm.preferredLocationValues.filter((item) => item !== value);
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
    this.selectedLocationLabels.set(
      this.profileForm.preferredLocationValues
        .map((id) => this.locationPreferenceOptions.find((option) => option.value === id)?.label)
        .filter((label): label is string => Boolean(label))
    );
  }
}
