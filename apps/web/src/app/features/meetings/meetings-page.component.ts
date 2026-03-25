import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MeetingGroupItem, MeetingListItem, TeamGroupItem, UserProfile } from '@shift-complete/shared-types';
import {
  UiButtonComponent,
  UiDatePickerComponent,
  UiFieldComponent,
  UiFilterBarComponent,
  UiInputComponent,
  UiLabelComponent,
  UiModalComponent,
  UiMultiSelectComponent,
  UiPageHeaderComponent,
  UiSelectComponent,
  UiSidebarPanelComponent,
  UiStatCardComponent,
  UiSurfaceComponent,
} from '@shift-complete/ui-kit';
import { ApiErrorService } from '../../core/services/api-error.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { toIsoDateTime } from '../../core/utils/date-picker.util';
import { AppApiService } from '../../shared/services/app-api.service';

@Component({
  selector: 'app-meetings-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    UiButtonComponent,
    UiDatePickerComponent,
    UiFieldComponent,
    UiFilterBarComponent,
    UiInputComponent,
    UiLabelComponent,
    UiModalComponent,
    UiMultiSelectComponent,
    UiPageHeaderComponent,
    UiSelectComponent,
    UiSidebarPanelComponent,
    UiStatCardComponent,
    UiSurfaceComponent,
  ],
  templateUrl: './meetings-page.component.html',
})
export class MeetingsPageComponent {
  private readonly api = inject(AppApiService);
  private readonly apiError = inject(ApiErrorService);
  private readonly feedback = inject(UiFeedbackService);

  protected readonly meetings = signal<MeetingListItem[]>([]);
  protected readonly meetingGroups = signal<MeetingGroupItem[]>([]);
  protected readonly groups = signal<TeamGroupItem[]>([]);
  protected readonly people = signal<UserProfile[]>([]);
  protected readonly selectedMeeting = signal<MeetingListItem | null>(null);
  protected readonly search = signal('');
  protected readonly groupFilter = signal('');
  protected readonly teamGroupFilter = signal('');
  protected meetingGroupDialogVisible = false;
  protected meetingDialogVisible = false;
  protected editingMeetingGroupId = signal<string | null>(null);
  protected meetingGroupForm = { name: '', description: '', leaderId: '', memberIds: [] as string[], groupId: '' };
  protected meetingForm = { title: '', description: '', locationValue: '', startsAt: null as Date | null, endsAt: null as Date | null, meetingGroupId: '', recurrenceRule: '' };

  protected readonly filteredMeetingGroups = computed(() => {
    const query = this.search().trim().toLowerCase();
    const teamGroupId = this.teamGroupFilter();
    return this.meetingGroups().filter((group) => {
      const queryMatch = !query || `${group.name} ${group.description || ''}`.toLowerCase().includes(query);
      const teamGroupMatch = !teamGroupId || group.groupId === teamGroupId;
      return queryMatch && teamGroupMatch;
    });
  });

  protected readonly filteredMeetings = computed(() => {
    const meetingGroupId = this.groupFilter();
    return this.meetings().filter((meeting) => !meetingGroupId || meeting.meetingGroupId === meetingGroupId);
  });

  protected readonly groupOptions = computed(() => [
    { label: 'Tutti i gruppi riunione', value: '' },
    ...this.meetingGroups().map((group) => ({ label: group.name, value: group.id })),
  ]);
  protected readonly teamGroupOptions = computed(() => [
    { label: 'Tutti i gruppi generali', value: '' },
    ...this.groups().map((group) => ({ label: group.name || 'Gruppo senza nome', value: group.id })),
  ]);
  protected readonly leaderOptions = computed(() => this.people().map((user) => ({ label: user.fullName, value: user.id })));
  protected readonly memberOptions = computed(() => this.people().map((user) => ({ label: user.fullName, value: user.id })));
  protected readonly summaryCards = computed(() => [
    {
      label: 'Gruppi riunione',
      value: `${this.meetingGroups().length}`,
      detail: `${this.filteredMeetingGroups().length} visibili con i filtri`,
    },
    {
      label: 'Meeting',
      value: `${this.meetings().length}`,
      detail: `${this.filteredMeetings().length} nel registro corrente`,
    },
    {
      label: 'Collegati a gruppi',
      value: `${this.meetingGroups().filter((group) => group.groupId).length}`,
      detail: 'gruppi riunione agganciati all organigramma',
    },
  ]);
  protected readonly upcomingMeetings = computed(() =>
    [...this.meetings()]
      .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime())
      .slice(0, 4)
  );

  constructor() {
    this.loadData();
  }

  protected clearFilters(): void {
    this.search.set('');
    this.groupFilter.set('');
    this.teamGroupFilter.set('');
  }

  protected openMeetingGroupDialog(group?: MeetingGroupItem): void {
    this.editingMeetingGroupId.set(group?.id ?? null);
    this.meetingGroupForm = {
      name: group?.name ?? '',
      description: group?.description ?? '',
      leaderId: group?.leaderId ?? '',
      memberIds: group?.members.map((member) => member.id) ?? [],
      groupId: group?.groupId ?? '',
    };
    this.meetingGroupDialogVisible = true;
  }

  protected saveMeetingGroup(): void {
    const payload = {
      name: this.meetingGroupForm.name.trim(),
      description: this.meetingGroupForm.description.trim() || undefined,
      leaderId: this.meetingGroupForm.leaderId || undefined,
      groupId: this.meetingGroupForm.groupId || undefined,
    };

    const request = this.editingMeetingGroupId()
      ? this.api.updateMeetingGroup(this.editingMeetingGroupId()!, payload)
      : this.api.createMeetingGroup(payload as any);

    request.subscribe({
      next: (meetingGroup) => {
        this.api.assignMeetingGroupMembers(meetingGroup.id, this.meetingGroupForm.memberIds).subscribe({
          next: () => {
            if (meetingGroup.groupId) {
              const currentGroup = this.groups().find((group) => group.id === meetingGroup.groupId);
              const nextIds = Array.from(new Set([...(currentGroup?.meetingGroups ?? []).map((item) => item.id), meetingGroup.id]));
              this.api.assignMeetingGroupsToGroup(meetingGroup.groupId, nextIds).subscribe({
                next: () => {
                  this.meetingGroupDialogVisible = false;
                  this.loadData();
                  this.feedback.success(this.editingMeetingGroupId() ? 'Gruppo riunione aggiornato' : 'Gruppo riunione creato');
                },
                error: (error) => this.feedback.error('Collegamento gruppo non riuscito', this.apiError.message(error, 'Impossibile collegare il gruppo riunione al gruppo generale.')),
              });
              return;
            }

            this.meetingGroupDialogVisible = false;
            this.loadData();
            this.feedback.success(this.editingMeetingGroupId() ? 'Gruppo riunione aggiornato' : 'Gruppo riunione creato');
          },
          error: (error) => this.feedback.error('Membri non aggiornati', this.apiError.message(error, 'Impossibile aggiornare i partecipanti del gruppo riunione.')),
        });
      },
      error: (error) => this.feedback.error('Operazione gruppo riunione non riuscita', this.apiError.message(error, 'Impossibile salvare il gruppo riunione.')),
    });
  }

  protected openMeetingDialog(group?: MeetingGroupItem): void {
    this.meetingForm = {
      title: '',
      description: '',
      locationValue: '',
      startsAt: null,
      endsAt: null,
      meetingGroupId: group?.id ?? '',
      recurrenceRule: '',
    };
    this.meetingDialogVisible = true;
  }

  protected saveMeeting(): void {
    if (!this.meetingForm.startsAt || !this.meetingForm.endsAt || !this.meetingForm.meetingGroupId) {
      this.feedback.error('Dati mancanti', 'Gruppo riunione, inizio e fine sono obbligatori.');
      return;
    }

    this.api.createMeeting({
      meetingGroupId: this.meetingForm.meetingGroupId,
      title: this.meetingForm.title.trim(),
      description: this.meetingForm.description.trim() || undefined,
      locationValue: this.meetingForm.locationValue.trim() || undefined,
      startsAt: toIsoDateTime(this.meetingForm.startsAt),
      endsAt: toIsoDateTime(this.meetingForm.endsAt),
      recurrenceRule: this.meetingForm.recurrenceRule.trim() || undefined,
    }).subscribe({
      next: () => {
        this.meetingDialogVisible = false;
        this.loadData();
        this.feedback.success('Riunione creata');
      },
      error: (error) => this.feedback.error('Creazione riunione non riuscita', this.apiError.message(error, 'Impossibile salvare la riunione.')),
    });
  }

  protected selectMeeting(meeting: MeetingListItem): void {
    this.selectedMeeting.set(meeting);
  }

  protected teamGroupLabel(groupId: string | null | undefined): string {
    return this.groups().find((item) => item.id === groupId)?.name || 'Non assegnato';
  }

  protected meetingParticipantsLabel(meetingGroupId: string): string {
    const group = this.meetingGroups().find((item) => item.id === meetingGroupId);
    return group ? `${group.members.length} partecipanti` : 'Partecipanti non trovati';
  }

  private loadData(): void {
    this.api.meetingGroups().subscribe({ next: (groups) => this.meetingGroups.set(groups) });
    this.api.meetings().subscribe({ next: (meetings) => this.meetings.set(meetings) });
    this.api.teamGroups().subscribe({ next: (groups) => this.groups.set(groups) });
    this.api.users().subscribe({ next: (users) => this.people.set(users) });
  }
}
