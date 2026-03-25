import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MeetingGroupItem, TeamGroupItem, TeamListItem } from '@shift-complete/shared-types';
import {
  UiButtonComponent,
  UiFieldComponent,
  UiInputComponent,
  UiLabelComponent,
  UiModalComponent,
  UiMultiSelectComponent,
  UiPageHeaderComponent,
  UiStatCardComponent,
  UiSurfaceComponent,
  UiTextareaComponent,
} from '@shift-complete/ui-kit';
import { ApiErrorService } from '../../core/services/api-error.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { AppApiService } from '../../shared/services/app-api.service';
import { OrgChartComponent } from '../teams/org-chart.component';

@Component({
  selector: 'app-org-chart-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    UiButtonComponent,
    UiFieldComponent,
    UiInputComponent,
    UiLabelComponent,
    UiModalComponent,
    UiMultiSelectComponent,
    UiPageHeaderComponent,
    UiStatCardComponent,
    UiSurfaceComponent,
    UiTextareaComponent,
    OrgChartComponent,
  ],
  templateUrl: './org-chart-page.component.html',
})
export class OrgChartPageComponent {
  private readonly api = inject(AppApiService);
  private readonly apiError = inject(ApiErrorService);
  private readonly feedback = inject(UiFeedbackService);

  protected readonly teams = signal<TeamListItem[]>([]);
  protected readonly groups = signal<TeamGroupItem[]>([]);
  protected readonly meetingGroups = signal<MeetingGroupItem[]>([]);
  protected readonly editingGroupId = signal<string | null>(null);
  protected readonly editMode = signal(false);
  protected groupDialogVisible = false;
  protected groupForm = { name: '', description: '', teamIds: [] as string[], meetingGroupIds: [] as string[] };

  protected readonly ungroupedTeams = computed(() => this.teams().filter((team) => !team.groupId));
  protected readonly ungroupedMeetingGroups = computed(() => this.meetingGroups().filter((group) => !group.groupId));
  protected readonly teamOptions = computed(() => this.teams().map((team) => ({ label: team.name, value: team.id })));
  protected readonly meetingGroupOptions = computed(() => this.meetingGroups().map((group) => ({ label: group.name, value: group.id })));
  protected readonly overviewCards = computed(() => [
    {
      label: 'Gruppi',
      value: `${this.groups().length}`,
      detail: 'Nodi generali configurati',
    },
    {
      label: 'Team collegati',
      value: `${this.teams().length}`,
      detail: `${this.ungroupedTeams().length} senza gruppo`,
    },
    {
      label: 'Gruppi riunione',
      value: `${this.meetingGroups().length}`,
      detail: `${this.ungroupedMeetingGroups().length} non assegnati`,
    },
    {
      label: 'Nodi cliccabili',
      value: `${this.teams().length + this.meetingGroups().length}`,
      detail: 'team e meeting group aprono il dettaglio dedicato',
    },
  ]);
  protected readonly highlightedGroups = computed(() =>
    [...this.groups()]
      .sort((left, right) => (right.teams.length + right.meetingGroups.length) - (left.teams.length + left.meetingGroups.length))
      .slice(0, 3)
  );

  constructor() {
    this.loadData();
  }

  protected openGroupDialog(): void {
    this.editingGroupId.set(null);
    this.groupForm = { name: '', description: '', teamIds: [], meetingGroupIds: [] };
    this.groupDialogVisible = true;
  }

  protected toggleEditMode(): void {
    this.editMode.update((value) => !value);
  }

  protected editGroup(group: TeamGroupItem): void {
    this.editingGroupId.set(group.id);
    this.groupForm = {
      name: group.name || '',
      description: group.description || '',
      teamIds: group.teams.map((team) => team.id),
      meetingGroupIds: (group.meetingGroups || []).map((meetingGroup) => meetingGroup.id),
    };
    this.groupDialogVisible = true;
  }

  protected saveGroup(): void {
    const payload = {
      name: this.groupForm.name.trim() || null,
      description: this.groupForm.description.trim() || null,
      meetingGroupIds: this.groupForm.meetingGroupIds,
    };

    const request = this.editingGroupId()
      ? this.api.updateTeamGroup(this.editingGroupId()!, payload)
      : this.api.createTeamGroup(payload);

    request.subscribe({
      next: (group) => {
        const groupId = group.id;
        this.api.assignTeamsToGroup(groupId, this.groupForm.teamIds).subscribe({
          next: () => {
            this.api.assignMeetingGroupsToGroup(groupId, this.groupForm.meetingGroupIds).subscribe({
              next: () => {
                this.groupDialogVisible = false;
                this.loadData();
                this.feedback.success(this.editingGroupId() ? 'Gruppo aggiornato' : 'Gruppo creato');
              },
              error: (error) => this.feedback.error('Assegnazione riunioni non riuscita', this.apiError.message(error, 'Impossibile collegare i gruppi riunione.')),
            });
          },
          error: (error) => this.feedback.error('Assegnazione team non riuscita', this.apiError.message(error, 'Impossibile collegare i team al gruppo.')),
        });
      },
      error: (error) => this.feedback.error('Operazione gruppo non riuscita', this.apiError.message(error, 'Impossibile salvare il gruppo.')),
    });
  }

  protected deleteGroup(groupId: string): void {
    this.api.deleteTeamGroup(groupId).subscribe({
      next: () => {
        this.loadData();
        this.feedback.success('Gruppo eliminato');
      },
      error: (error) => this.feedback.error('Eliminazione non riuscita', this.apiError.message(error, 'Impossibile eliminare il gruppo.')),
    });
  }

  private loadData(): void {
    this.api.teams().subscribe({ next: (teams) => this.teams.set(teams) });
    this.api.teamGroups().subscribe({ next: (groups) => this.groups.set(groups) });
    this.api.meetingGroups().subscribe({ next: (groups) => this.meetingGroups.set(groups) });
  }
}
