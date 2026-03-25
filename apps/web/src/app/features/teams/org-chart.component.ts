import { CommonModule } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TreeNode } from 'primeng/api';
import { OrganizationChart } from 'primeng/organizationchart';
import { TeamGroupItem, TeamListItem, MeetingGroupItem } from '@shift-complete/shared-types';
import { UiBadgeComponent, UiChipComponent } from '@shift-complete/ui-kit';
import { SessionService } from '../../core/services/session.service';

type OrgNodeData = {
  kind: 'root' | 'group' | 'team' | 'meetingGroup';
  label: string;
  subtitle?: string;
  count?: number;
  color?: string;
  icon?: string;
  members?: Array<{ id: string; fullName: string; isCurrentUser: boolean }>;
  leader?: { id: string; fullName: string; isCurrentUser: boolean } | null;
  duties?: string[];
  teamCount?: number;
  meetingGroupCount?: number;
  route?: string[];
  queryParams?: Record<string, string>;
  isCurrentUserNode?: boolean;
};

@Component({
  selector: 'app-org-chart',
  standalone: true,
  imports: [CommonModule, RouterLink, OrganizationChart, UiBadgeComponent, UiChipComponent],
  templateUrl: './org-chart.component.html',
  styles: [`
    :host { display: block; }

    :host ::ng-deep .p-organizationchart {
      .p-organizationchart-table {
        border-spacing: 0 16px;
      }
      .p-organizationchart-node-content {
        border: none !important;
        background: transparent !important;
        padding: 0 !important;
      }
      .p-organizationchart-line-down {
        height: 20px;
        border-left: 2px solid var(--border-soft, #e2e8f0);
      }
      .p-organizationchart-line-left,
      .p-organizationchart-line-right {
        border-top: 2px solid var(--border-soft, #e2e8f0);
      }
      .p-organizationchart-line-top {
        border-top: 2px solid var(--border-soft, #e2e8f0);
      }
      .p-organizationchart-toggler {
        background: var(--surface-2, #f1f5f9) !important;
        border: 1px solid var(--border-soft, #e2e8f0) !important;
        color: var(--text-2, #64748b) !important;
        width: 1.5rem !important;
        height: 1.5rem !important;
      }
    }
  `],
})
export class OrgChartComponent {
  private readonly session = inject(SessionService);
  readonly teams = input<TeamListItem[]>([]);
  readonly groups = input<TeamGroupItem[]>([]);
  readonly meetingGroups = input<MeetingGroupItem[]>([]);
  readonly mode = input<'general' | 'team'>('general');

  protected readonly treeData = computed<TreeNode<OrgNodeData>[]>(() => {
    const teams = this.teams();
    const groups = this.groups();
    const meetingGroups = this.meetingGroups();

    if (!teams.length && !groups.length && !meetingGroups.length) {
      return [];
    }

    const groupedTeamIds = new Set(groups.flatMap((g) => g.teams.map((t) => t.id)));
    const ungroupedTeams = teams.filter((t) => !groupedTeamIds.has(t.id));

    const children: TreeNode<OrgNodeData>[] = [];

    if (this.mode() === 'team') {
      return teams.length ? teams.map((team) => this.buildTeamNode(team)) : [];
    }

    for (const group of groups) {
      const groupTeams = group.teams.length
        ? group.teams
        : teams.filter((t) => t.groupId === group.id);
      const groupMeetingGroups = group.meetingGroups?.length
        ? group.meetingGroups
        : meetingGroups.filter((meetingGroup) => meetingGroup.groupId === group.id);

      if (!groupTeams.length && !groupMeetingGroups.length) {
        continue;
      }

      children.push({
        expanded: true,
        type: 'group',
        data: {
          kind: 'group',
          label: group.name || 'Gruppo senza nome',
          subtitle: group.description || undefined,
          count: groupTeams.length + groupMeetingGroups.length,
          teamCount: groupTeams.length,
          meetingGroupCount: groupMeetingGroups.length,
          color: '#f97316',
          icon: 'pi pi-folder',
        },
        children: [
          ...groupTeams.map((team) => this.buildTeamNode(team)),
          ...groupMeetingGroups.map((meetingGroup) => this.buildMeetingGroupNode(meetingGroup)),
        ],
      });
    }

    for (const team of ungroupedTeams) {
      children.push(this.buildTeamNode(team));
    }

    for (const mg of meetingGroups.filter((meetingGroup) => !meetingGroup.groupId)) {
      children.push(this.buildMeetingGroupNode(mg));
    }

    const root: TreeNode<OrgNodeData> = {
      expanded: true,
      type: 'root',
        data: {
          kind: 'root',
          label: 'Organizzazione',
          subtitle: `${groups.length} gruppi · ${teams.length} team · ${meetingGroups.length} gruppi riunione`,
          count: groups.length + teams.length + meetingGroups.length,
          color: '#0f766e',
          icon: 'pi pi-sitemap',
        },
      children,
    };

    return [root];
  });

  private buildTeamNode(team: TeamListItem): TreeNode<OrgNodeData> {
    const volunteers = (team.members ?? []).filter(
      (m) => m.id !== team.leader?.id
    );
    const teamColor = this.colorFromLabel(team.groupId || team.name);

    return {
      expanded: true,
        type: 'team',
        data: {
          kind: 'team',
          label: team.name,
          subtitle: team.group?.name || 'Team autonomo',
          color: teamColor,
          leader: team.leader
            ? { id: team.leader.id, fullName: team.leader.fullName, isCurrentUser: this.isCurrentUser(team.leader.id) }
            : null,
          count: team.memberCount || (team.members?.length ?? 0),
          duties: (team.duties ?? []).map((d) => d.name),
          members: volunteers.map((member) => ({ id: member.id, fullName: member.fullName, isCurrentUser: this.isCurrentUser(member.id) })),
          icon: 'pi pi-users',
          route: ['/teams'],
          queryParams: { teamId: team.id, view: 'org' },
          isCurrentUserNode: Boolean(this.isCurrentUser(team.leader?.id) || volunteers.some((member) => this.isCurrentUser(member.id))),
        },
      };
  }

  private buildMeetingGroupNode(meetingGroup: MeetingGroupItem): TreeNode<OrgNodeData> {
    const accentColor = this.colorFromLabel(meetingGroup.groupId || meetingGroup.name);
    const members = (meetingGroup.members || []).map((member) => ({ id: member.id, fullName: member.fullName, isCurrentUser: this.isCurrentUser(member.id) }));
    return {
      expanded: true,
      type: 'meetingGroup',
      data: {
        kind: 'meetingGroup',
        label: meetingGroup.name,
        subtitle: meetingGroup.description || undefined,
        color: accentColor,
        leader: meetingGroup.leader
          ? { id: meetingGroup.leader.id, fullName: meetingGroup.leader.fullName, isCurrentUser: this.isCurrentUser(meetingGroup.leader.id) }
          : null,
        count: meetingGroup.members?.length || 0,
        members,
        icon: 'pi pi-comments',
        route: ['/meetings/groups', meetingGroup.id],
        isCurrentUserNode: Boolean(this.isCurrentUser(meetingGroup.leader?.id) || members.some((member) => member.isCurrentUser)),
      },
    };
  }

  protected nodeColor(node: TreeNode<OrgNodeData>): string {
    return node.data?.color || '#475569';
  }

  private colorFromLabel(seed: string | null | undefined): string {
    const value = (seed || '').trim();
    if (!value) {
      return '#0f766e';
    }

    const palette = ['#0f766e', '#0284c7', '#1d4ed8', '#b45309', '#be123c', '#166534'];
    const total = Array.from(value).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return palette[total % palette.length];
  }

  private isCurrentUser(userId: string | null | undefined): boolean {
    return Boolean(userId && this.session.getCurrentUser()?.id === userId);
  }
}
