import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MeetingGroupItem, MeetingListItem, TeamGroupItem, TeamListItem, UserProfile } from '@shift-complete/shared-types';
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
    RouterLink,
  ],
  templateUrl: './meetings-page.component.html',
})
export class MeetingsPageComponent {
  private readonly api = inject(AppApiService);
  private readonly apiError = inject(ApiErrorService);
  private readonly feedback = inject(UiFeedbackService);
  private readonly route = inject(ActivatedRoute);

  protected readonly meetings = signal<MeetingListItem[]>([]);
  protected readonly meetingGroups = signal<MeetingGroupItem[]>([]);
  protected readonly groups = signal<TeamGroupItem[]>([]);
  protected readonly teams = signal<TeamListItem[]>([]);
  protected readonly people = signal<UserProfile[]>([]);
  protected readonly selectedMeeting = signal<MeetingListItem | null>(null);
  protected readonly search = signal('');
  protected readonly groupFilter = signal('');
  protected readonly teamGroupFilter = signal('');
  protected readonly ownerFilter = signal<'all' | 'team' | 'meetingGroup'>('all');
  protected readonly teamFilter = signal('');
  protected meetingGroupDialogVisible = false;
  protected meetingDialogVisible = false;
  protected editingMeetingGroupId = signal<string | null>(null);
  protected meetingGroupForm = { name: '', description: '', leaderId: '', memberIds: [] as string[], groupId: '' };
  protected meetingForm = { title: '', description: '', locationValue: '', startsAt: null as Date | null, endsAt: null as Date | null, meetingGroupId: '', teamId: '', ownerType: 'meetingGroup' as 'team' | 'meetingGroup', recurrenceRule: '' };

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
    const query = this.search().trim().toLowerCase();
    const meetingGroupId = this.groupFilter();
    const teamId = this.teamFilter();
    const owner = this.ownerFilter();
    const teamGroupId = this.teamGroupFilter();

    return this.meetings().filter((meeting) => {
      const queryMatch = !query || `${meeting.title} ${meeting.description || ''} ${meeting.team?.name || ''} ${meeting.meetingGroup?.name || ''}`.toLowerCase().includes(query);
      const ownerMatch = owner === 'all' || meeting.ownerType === owner;
      const meetingGroupMatch = !meetingGroupId || meeting.meetingGroupId === meetingGroupId;
      const teamMatch = !teamId || meeting.teamId === teamId;
      const teamGroupMatch = !teamGroupId
        || this.teamGroupIdForMeeting(meeting) === teamGroupId;

      return queryMatch && ownerMatch && meetingGroupMatch && teamMatch && teamGroupMatch;
    });
  });

  protected readonly groupOptions = computed(() => [
    { label: 'Tutti i meeting group', value: '' },
    ...this.meetingGroups().map((group) => ({ label: group.name, value: group.id })),
  ]);
  protected readonly teamOptions = computed(() => [
    { label: 'Tutti i team', value: '' },
    ...this.teams().map((team) => ({ label: team.name, value: team.id })),
  ]);
  protected readonly teamGroupOptions = computed(() => [
    { label: 'Tutti i gruppi generali', value: '' },
    ...this.groups().map((group) => ({ label: group.name || 'Gruppo senza nome', value: group.id })),
  ]);
  protected readonly ownerOptions = [
    { label: 'Tutte', value: 'all' },
    { label: 'Riunioni team', value: 'team' },
    { label: 'Riunioni meeting group', value: 'meetingGroup' },
  ];
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
      label: 'Riunioni team',
      value: `${this.meetings().filter((meeting) => meeting.ownerType === 'team').length}`,
      detail: `${this.meetings().filter((meeting) => meeting.ownerType === 'meetingGroup').length} collegate ai meeting group`,
    },
  ]);
  protected readonly upcomingMeetings = computed(() =>
    [...this.meetings()]
      .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime())
      .slice(0, 4)
  );

  constructor() {
    this.loadData();
    this.route.queryParamMap.subscribe((params) => {
      const teamId = params.get('teamId') || '';
      const groupId = params.get('groupId') || '';
      const owner = params.get('owner');

      if (teamId) {
        this.teamFilter.set(teamId);
        this.ownerFilter.set('team');
      }

      if (groupId) {
        this.groupFilter.set(groupId);
        this.ownerFilter.set('meetingGroup');
      }

      if (owner === 'team' || owner === 'meetingGroup') {
        this.ownerFilter.set(owner);
      }
    });
  }

  protected clearFilters(): void {
    this.search.set('');
    this.groupFilter.set('');
    this.teamGroupFilter.set('');
    this.ownerFilter.set('all');
    this.teamFilter.set('');
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

  protected openMeetingDialog(group?: MeetingGroupItem, team?: TeamListItem): void {
    this.meetingForm = {
      title: '',
      description: '',
      locationValue: '',
      startsAt: null,
      endsAt: null,
      meetingGroupId: group?.id ?? '',
      teamId: team?.id ?? '',
      ownerType: team?.id ? 'team' : 'meetingGroup',
      recurrenceRule: '',
    };
    this.meetingDialogVisible = true;
  }

  protected saveMeeting(): void {
    const ownerId = this.meetingForm.ownerType === 'team' ? this.meetingForm.teamId : this.meetingForm.meetingGroupId;
    if (!this.meetingForm.startsAt || !this.meetingForm.endsAt || !ownerId) {
      this.feedback.error('Dati mancanti', 'Origine, inizio e fine sono obbligatori.');
      return;
    }

    this.api.createMeeting({
      meetingGroupId: this.meetingForm.ownerType === 'meetingGroup' ? this.meetingForm.meetingGroupId : undefined,
      teamId: this.meetingForm.ownerType === 'team' ? this.meetingForm.teamId : undefined,
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

  protected meetingParticipantsLabel(meeting: MeetingListItem): string {
    if (meeting.ownerType === 'team') {
      const team = this.teams().find((item) => item.id === meeting.teamId);
      return team ? `${team.memberCount} membri team` : 'Partecipanti non trovati';
    }

    const group = this.meetingGroups().find((item) => item.id === meeting.meetingGroupId);
    return group ? `${group.members.length} partecipanti` : 'Partecipanti non trovati';
  }

  protected ownerLabel(meeting: MeetingListItem): string {
    return meeting.team?.name || meeting.meetingGroup?.name || 'Origine non definita';
  }

  protected teamName(teamId: string | null | undefined): string {
    return this.teams().find((team) => team.id === teamId)?.name || 'Team non definito';
  }

  protected teamGroupIdForMeeting(meeting: MeetingListItem): string | null {
    if (meeting.ownerType === 'team') {
      return this.teams().find((team) => team.id === meeting.teamId)?.groupId || null;
    }

    return this.meetingGroups().find((group) => group.id === meeting.meetingGroupId)?.groupId || null;
  }

  private loadData(): void {
    this.api.meetingGroups().subscribe({ next: (groups) => this.meetingGroups.set(groups) });
    this.api.meetings().subscribe({ next: (meetings) => this.meetings.set(meetings) });
    this.api.teamGroups().subscribe({ next: (groups) => this.groups.set(groups) });
    this.api.teams().subscribe({ next: (teams) => this.teams.set(teams) });
    this.api.users().subscribe({ next: (users) => this.people.set(users) });
  }
}
