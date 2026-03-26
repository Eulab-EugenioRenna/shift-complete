export * from './schemas/core.schema';
export * from './schemas/api.schema';
export * from './schemas/auth.schema';
export * from './schemas/event.schema';
export * from './schemas/team.schema';
export * from './schemas/duty.schema';
export * from './schemas/availability.schema';
export * from './schemas/replacement.schema';
export * from './schemas/team-request.schema';
export * from './schemas/team-group.schema';
export * from './schemas/user-profile.schema';
export * from './schemas/catalog.schema';
export * from './schemas/meeting.schema';
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
  preferredLocationValues?: string[] | null;
  competencies?: string[] | null;
  serviceNotes?: string | null;
}

export interface UserPreferenceCatalogItem {
  id: string;
  type: 'shift' | 'competency' | 'location';
  value: string;
  label: string;
  description?: string | null;
  keywords?: string[] | null;
  active: boolean;
  sortOrder: number;
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
  requiredCompetencies?: string[] | null;
  groupId?: string | null;
  group?: { id: string; name: string | null } | null;
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
    requiredCompetencies?: string[] | null;
    recommendedEventVolunteers?: number | null;
  }>;
}

export interface TeamGroupItem {
  id: string;
  name: string | null;
  description?: string | null;
  sortOrder: number;
  teams: TeamListItem[];
  meetingGroups: MeetingGroupItem[];
}

export interface MeetingGroupItem {
  id: string;
  name: string;
  description?: string | null;
  leaderId?: string | null;
  groupId?: string | null;
  leader?: { id: string; fullName: string; email: string } | null;
  members: Array<{
    id: string;
    fullName: string;
    email: string;
    role: Role;
  }>;
}

export interface MeetingListItem {
  id: string;
  meetingGroupId?: string | null;
  teamId?: string | null;
  title: string;
  description?: string | null;
  locationValue?: string | null;
  startsAt: string;
  endsAt: string;
  type: 'single' | 'recurring';
  recurrenceRule?: string | null;
  recurrenceTz?: string | null;
  recurrenceUntil?: string | null;
  recurrenceDurationMonths?: number | null;
  recurrenceAutoRenew?: boolean | null;
  recurrenceRenewMonths?: number | null;
  occurrenceStart?: string;
  isOccurrence?: boolean;
  isVirtualOccurrence?: boolean;
  seriesId?: string;
  parentMeetingId?: string | null;
  seriesTemplate?: {
    title: string;
    description?: string | null;
    locationValue?: string | null;
    startsAt: string;
    endsAt: string;
    recurrenceRule?: string | null;
    recurrenceTz?: string | null;
    recurrenceUntil?: string | null;
    recurrenceDurationMonths?: number | null;
    recurrenceAutoRenew?: boolean | null;
    recurrenceRenewMonths?: number | null;
  } | null;
  meetingGroup?: {
    id: string;
    name: string;
  } | null;
  team?: {
    id: string;
    name: string;
  } | null;
  ownerType?: 'team' | 'meetingGroup';
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
  planId?: string;
  eventId?: string;
  occurrenceStart?: string;
  teamId?: string;
  scope?: 'single' | 'series' | 'range';
  includeExistingAssignments?: boolean;
  manualSelections?: ScheduleManualSelection[];
}

export type ScheduleApplyScope = 'event' | 'month' | 'cycle' | 'year' | 'all';

export interface ScheduleManualSelection {
  slotId: string;
  slotDemandKey?: string;
  assigneeId: string;
}

export interface ScheduleCandidate {
  id: string;
  fullName: string;
  score: number;
  reasons: string[];
}

export interface ScheduleSuggestionItem {
  slotId: string;
  slotDemandKey: string;
  slotDemandIndex: number;
  eventId: string;
  eventTitle: string;
  teamId: string;
  teamName: string;
  dutyId: string;
  roleName: string;
  startsAt: string;
  endsAt: string;
  coverageStatus: 'covered' | 'suggested' | 'manual' | 'open';
  strategy: string;
  assigneeId: string | null;
  assigneeName?: string | null;
  score?: number | null;
  reasons?: string[];
  candidates?: ScheduleCandidate[];
  cycleKey: string;
  cycleIndex: number;
  cycleLength: number;
  cycleNumber: number;
  selectionSource: 'existing' | 'suggested' | 'manual' | 'open';
  existingAssignmentId?: string | null;
  existingAssigneeId?: string | null;
  existingAssigneeName?: string | null;
  drift?: {
    status: 'match' | 'changed' | 'missing';
    currentAssigneeId?: string | null;
    currentAssigneeName?: string | null;
  };
}

export interface SchedulePlanResponse {
  planId?: string;
  status?: 'completed' | 'queued' | 'running';
  jobId?: string;
  cacheHit?: boolean;
  message: string;
  criteria: string[];
  generatedAt: string;
  anchorEventId: string;
  anchorEventTitle?: string;
  invalidatedAt?: string | null;
  invalidationReason?: string | null;
  suggestions: ScheduleSuggestionItem[];
  summary: {
    events: number;
    slots: number;
    covered: number;
    proposed: number;
    open: number;
    changed?: number;
    missing?: number;
  };
}

export interface SchedulePlanListItem {
  id: string;
  anchorEventId: string;
  anchorEventTitle: string;
  createdAt: string;
  updatedAt: string;
  invalidatedAt?: string | null;
  invalidationReason?: string | null;
  scope: string;
  applyScope?: string | null;
  summary: {
    events: number;
    slots: number;
    covered: number;
    proposed: number;
    open: number;
    changed?: number;
    missing?: number;
  };
}

export interface ScheduleApplyRequest extends SchedulePreviewRequest {
  applyScope: ScheduleApplyScope;
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
