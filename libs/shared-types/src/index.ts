export enum Role {
  ADMINISTRATOR = 'administrator',
  SERVICE_LEADER = 'service_leader',
  VOLUNTEER = 'volunteer'
}

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
}

export interface TeamSummary {
  id: string;
  name: string;
  leaderId?: string;
  memberCount: number;
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
