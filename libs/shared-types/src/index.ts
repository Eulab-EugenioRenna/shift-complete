export * from './schemas/core.schema';
export * from './schemas/api.schema';
export * from './schemas/auth.schema';
export * from './schemas/event.schema';
export * from './schemas/team.schema';
export * from './schemas/duty.schema';
export * from './schemas/availability.schema';
export * from './schemas/replacement.schema';
export * from './schemas/team-request.schema';
export * from './schemas/user-profile.schema';

import type { AvailabilityType, ReplacementStatus, Role } from './schemas/core.schema';

// Keeping these for backwards compatibility if needed, but should be replaced eventually
export enum EventVisibilityScope {
  GLOBAL = 'global',
  TEAM = 'team',
  PERSONAL = 'personal'
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  onboardingCompleted: boolean;
  activeTeamIds: string[];
  phone?: string | null;
  address?: string | null;
  emergencyName?: string | null;
  emergencyPhone?: string | null;
  preferredShifts?: string[] | null;
  preferredTeamIds?: string[] | null;
  preferredDutyIds?: string[] | null;
  competencies?: string[] | null;
  serviceNotes?: string | null;
}

export interface TeamSummary {
  id: string;
  name: string;
  leaderId?: string;
  memberCount: number;
}

export interface TeamListItem {
  id: string;
  name: string;
  description?: string | null;
  leader?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  memberCount: number;
  members?: Array<{
    id: string;
    fullName: string;
    email: string;
    role: Role;
    dutyIds?: string[];
    duties?: Array<{
      id: string;
      name: string;
      color?: string | null;
      icon?: string | null;
    }>;
  }>;
  duties?: Array<{
    id: string;
    name: string;
    color?: string | null;
    icon?: string | null;
  }>;
}

export interface AvailabilityItem {
  id: string;
  userId: string;
  teamId?: string | null;
  type: AvailabilityType;
  startsAt: string;
  endsAt: string;
  reason?: string | null;
}

export interface ReplacementItem {
  id: string;
  assignmentId: string;
  requestedByUserId: string;
  replacementAssigneeId?: string | null;
  status: ReplacementStatus;
  reason?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
  assignment?: {
    id: string;
    status: string;
    assigneeId?: string | null;
    slot?: {
      id: string;
      startsAt: string;
      endsAt: string;
      team?: { name: string } | null;
      duty?: { name: string } | null;
      event?: { title: string } | null;
    } | null;
    assignee?: { id: string; fullName: string; email: string } | null;
  } | null;
  requestedBy?: { id: string; fullName: string; email: string } | null;
  replacementAssignee?: { id: string; fullName: string; email: string } | null;
  suggestedReplacement?: { id: string; fullName: string; email: string; score: number; reasons: string[] } | null;
  suggestedCandidates?: Array<{ id: string; fullName: string; email: string; score: number; reasons: string[] }>;
}

export interface NotificationItem {
  id: string;
  userId: string;
  channel: string;
  subject: string;
  body: string;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export interface TeamAccessRequestItem {
  id: string;
  teamId: string;
  kind: 'SIGNUP' | 'TEAM_JOIN';
  status: 'PENDING' | 'APPROVED' | 'DECLINED';
  fullName?: string | null;
  email?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  team?: { id: string; name: string } | null;
  targetUser?: { id: string; fullName: string; email: string } | null;
  requestedBy?: { id: string; fullName: string; email: string } | null;
  reviewedBy?: { id: string; fullName: string; email: string } | null;
}

export interface InventorySummary {
  assets: number;
  checkedOut: number;
  maintenanceDue: number;
  items: Array<{
    id: string;
    teamId: string;
    name: string;
    serialNumber?: string | null;
    status: string;
    maintenanceDueAt?: string | null;
  }>;
}

export interface SchedulePreviewRequest {
  from: string;
  to: string;
  teamId?: string;
  eventId?: string;
  occurrenceStart?: string;
  scope?: 'single' | 'series' | 'range';
  apply?: boolean;
  includeExistingAssignments?: boolean;
}

export interface EventRoleAssignment {
  slotId: string;
  roleName: string;
  assigneeId?: string;
  teamId: string;
  status: 'open' | 'assigned' | 'confirmed' | 'declined';
}

export interface EventSummary {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  isRecurring: boolean;
  visibility: EventVisibilityScope;
  assignments: EventRoleAssignment[];
}

export interface DashboardKpi {
  label: string;
  value: string;
  trend?: string;
}
