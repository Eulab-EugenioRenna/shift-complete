import { HttpClient, HttpEvent, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AvailabilityItem,
  ChangeMyPasswordDto,
  CreateAvailabilityDto,
  CreateDutyDto,
  CreateReplacementDto,
  CreateTeamGroupDto,
  AssignVolunteerDto,
  CreateEventDto,
  CreateTeamDto,
  InventorySummary,
  NotificationItem,
  ReplacementItem,
  ScheduleApplyRequest,
  SchedulePlanListItem,
  SchedulePlanResponse,
  SchedulePreviewRequest,
  TeamAccessRequestItem,
  TeamGroupItem,
  TeamListItem,
  UpdateAvailabilityDto,
  UpdateDutyDto,
  UpdateEventDto,
  UpdateTeamDto,
  UpdateTeamGroupDto,
  UserProfile,
  ResolveReplacementDto,
  UserPreferenceCatalogItem,
  ManagedUserProfileDto,
  UpdateManagedUserProfileDto,
  SyncHolidayCalendarDto,
  UpsertPreferenceCatalogItemDto,
  MeetingGroupItem,
  MeetingListItem,
  CreateMeetingGroupDto,
  UpdateMeetingGroupDto,
  AddMeetingGroupMemberDto,
  CreateMeetingDto,
  UpdateMeetingDto,
  ExtendedUpdateMeetingDto,
} from '@shift-complete/shared-types';
import { resolveApiBaseUrl } from '../../core/config/api-base-url';

export interface DutyListItem {
  id: string;
  teamId: string;
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AppApiService {
  private readonly apiBaseUrl = resolveApiBaseUrl();

  constructor(private readonly http: HttpClient) {}

  me(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.apiBaseUrl}/users/me`);
  }

  updateMe(payload: Partial<UserProfile> & { preferredShifts?: string[]; preferredTeamIds?: string[]; preferredDutyIds?: string[]; competencies?: string[] }): Observable<UserProfile> {
    return this.http.patch<UserProfile>(`${this.apiBaseUrl}/users/me`, payload);
  }

  changeMyPassword(payload: ChangeMyPasswordDto): Observable<{ updated: boolean }> {
    return this.http.patch<{ updated: boolean }>(`${this.apiBaseUrl}/users/me/password`, payload);
  }

  teams(): Observable<TeamListItem[]> {
    return this.http.get<TeamListItem[]>(`${this.apiBaseUrl}/teams`);
  }

  duties(teamId?: string): Observable<DutyListItem[]> {
    const suffix = teamId ? `?teamId=${teamId}` : '';
    return this.http.get<DutyListItem[]>(`${this.apiBaseUrl}/duties${suffix}`);
  }

  createDuty(payload: CreateDutyDto): Observable<DutyListItem> {
    return this.http.post<DutyListItem>(`${this.apiBaseUrl}/duties`, payload);
  }

  updateDuty(dutyId: string, payload: UpdateDutyDto): Observable<DutyListItem> {
    return this.http.patch<DutyListItem>(`${this.apiBaseUrl}/duties/${dutyId}`, payload);
  }

  updateDutyCompetencies(dutyId: string, competencyValues: string[]): Observable<DutyListItem> {
    return this.http.patch<DutyListItem>(`${this.apiBaseUrl}/duties/${dutyId}/competencies`, { competencyValues });
  }

  deleteDuty(dutyId: string): Observable<{ deleted: boolean; id: string }> {
    return this.http.delete<{ deleted: boolean; id: string }>(`${this.apiBaseUrl}/duties/${dutyId}`);
  }

  createTeam(payload: CreateTeamDto): Observable<TeamListItem> {
    return this.http.post<TeamListItem>(`${this.apiBaseUrl}/teams`, payload);
  }

  addTeamMember(teamId: string, userId: string): Observable<{ id: string; teamId: string; userId: string }> {
    return this.http.post<{ id: string; teamId: string; userId: string }>(`${this.apiBaseUrl}/teams/${teamId}/members`, { userId });
  }

  removeTeamMember(teamId: string, userId: string): Observable<{ deleted: boolean; teamId: string; userId: string }> {
    return this.http.delete<{ deleted: boolean; teamId: string; userId: string }>(`${this.apiBaseUrl}/teams/${teamId}/members/${userId}`);
  }

  assignTeamMemberDuties(teamId: string, userId: string, dutyIds: string[]): Observable<{ updated: boolean; teamId: string; userId: string; dutyIds: string[] }> {
    return this.http.patch<{ updated: boolean; teamId: string; userId: string; dutyIds: string[] }>(`${this.apiBaseUrl}/teams/${teamId}/members/${userId}/duties`, { dutyIds });
  }

  teamJoinRequests(): Observable<TeamAccessRequestItem[]> {
    return this.http.get<TeamAccessRequestItem[]>(`${this.apiBaseUrl}/teams/join-requests`);
  }

  createTeamJoinRequest(teamId: string, userId: string): Observable<TeamAccessRequestItem> {
    return this.http.post<TeamAccessRequestItem>(`${this.apiBaseUrl}/teams/join-requests`, { teamId, userId });
  }

  resolveTeamJoinRequest(requestId: string, status: 'APPROVED' | 'DECLINED'): Observable<TeamAccessRequestItem> {
    return this.http.patch<TeamAccessRequestItem>(`${this.apiBaseUrl}/teams/join-requests/${requestId}`, { status });
  }

  updateTeam(teamId: string, payload: UpdateTeamDto): Observable<TeamListItem> {
    return this.http.patch<TeamListItem>(`${this.apiBaseUrl}/teams/${teamId}`, payload);
  }

  updateTeamCompetencies(teamId: string, competencyValues: string[]): Observable<TeamListItem> {
    return this.http.patch<TeamListItem>(`${this.apiBaseUrl}/teams/${teamId}/competencies`, { competencyValues });
  }

  deleteTeam(teamId: string): Observable<{ deleted: boolean; id: string }> {
    return this.http.delete<{ deleted: boolean; id: string }>(`${this.apiBaseUrl}/teams/${teamId}`);
  }

  teamGroups(): Observable<TeamGroupItem[]> {
    return this.http.get<TeamGroupItem[]>(`${this.apiBaseUrl}/team-groups`);
  }

  createTeamGroup(payload: CreateTeamGroupDto): Observable<TeamGroupItem> {
    return this.http.post<TeamGroupItem>(`${this.apiBaseUrl}/team-groups`, payload);
  }

  updateTeamGroup(id: string, payload: UpdateTeamGroupDto): Observable<TeamGroupItem> {
    return this.http.patch<TeamGroupItem>(`${this.apiBaseUrl}/team-groups/${id}`, payload);
  }

  deleteTeamGroup(id: string): Observable<{ deleted: boolean; id: string }> {
    return this.http.delete<{ deleted: boolean; id: string }>(`${this.apiBaseUrl}/team-groups/${id}`);
  }

  assignTeamsToGroup(groupId: string, teamIds: string[]): Observable<{ updated: boolean }> {
    return this.http.put<{ updated: boolean }>(`${this.apiBaseUrl}/team-groups/${groupId}/teams`, { teamIds });
  }

  assignMeetingGroupsToGroup(groupId: string, meetingGroupIds: string[]): Observable<{ updated: boolean }> {
    return this.http.put<{ updated: boolean }>(`${this.apiBaseUrl}/team-groups/${groupId}/meeting-groups`, { meetingGroupIds });
  }

  users(role?: string): Observable<UserProfile[]> {
    const suffix = role ? `?role=${role}` : '';
    return this.http.get<UserProfile[]>(`${this.apiBaseUrl}/users${suffix}`);
  }

  managedUsers(role?: string, teamId?: string): Observable<UserProfile[]> {
    const params = new URLSearchParams();
    if (role) params.set('role', role);
    if (teamId) params.set('teamId', teamId);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return this.http.get<UserProfile[]>(`${this.apiBaseUrl}/users${suffix}`);
  }

  userPreferenceCatalog(): Observable<UserPreferenceCatalogItem[]> {
    return this.http.get<UserPreferenceCatalogItem[]>(`${this.apiBaseUrl}/users/preferences/catalog`);
  }

  upsertPreferenceCatalogItem(payload: UpsertPreferenceCatalogItemDto): Observable<UserPreferenceCatalogItem> {
    return this.http.post<UserPreferenceCatalogItem>(`${this.apiBaseUrl}/catalog/preferences`, payload);
  }

  deletePreferenceCatalogItem(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.apiBaseUrl}/catalog/preferences/${id}`);
  }

  holidayCalendar(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiBaseUrl}/catalog/holidays`);
  }

  syncHolidayCalendar(payload: SyncHolidayCalendarDto): Observable<any[]> {
    return this.http.post<any[]>(`${this.apiBaseUrl}/catalog/holidays/sync`, payload);
  }

  createManagedUser(payload: ManagedUserProfileDto): Observable<UserProfile & { generatedPassword?: string }> {
    return this.http.post<UserProfile & { generatedPassword?: string }>(`${this.apiBaseUrl}/users`, payload);
  }

  updateManagedUser(userId: string, payload: UpdateManagedUserProfileDto): Observable<UserProfile> {
    return this.http.patch<UserProfile>(`${this.apiBaseUrl}/users/${userId}`, payload);
  }

  deleteManagedUser(userId: string): Observable<{ deleted: boolean; id: string }> {
    return this.http.delete<{ deleted: boolean; id: string }>(`${this.apiBaseUrl}/users/${userId}`);
  }

  sendUserCredentials(userId: string): Observable<{ sent: boolean; id: string; generatedPassword: string }> {
    return this.http.post<{ sent: boolean; id: string; generatedPassword: string }>(`${this.apiBaseUrl}/users/${userId}/send-credentials`, {});
  }

  managedUserDetail(userId: string): Observable<any> {
    return this.http.get<any>(`${this.apiBaseUrl}/users/${userId}/detail`);
  }

  suspendManagedUser(userId: string): Observable<{ suspended: boolean; id: string }> {
    return this.http.post<{ suspended: boolean; id: string }>(`${this.apiBaseUrl}/users/${userId}/suspend`, {});
  }

  resumeManagedUser(userId: string): Observable<{ suspended: boolean; id: string }> {
    return this.http.post<{ suspended: boolean; id: string }>(`${this.apiBaseUrl}/users/${userId}/resume`, {});
  }

  availability(userId?: string): Observable<AvailabilityItem[]> {
    const suffix = userId ? `?userId=${userId}` : '';
    return this.http.get<AvailabilityItem[]>(`${this.apiBaseUrl}/availability${suffix}`);
  }

  createAvailability(payload: CreateAvailabilityDto, userId?: string): Observable<AvailabilityItem> {
    const suffix = userId ? `?userId=${userId}` : '';
    return this.http.post<AvailabilityItem>(`${this.apiBaseUrl}/availability${suffix}`, payload);
  }

  updateAvailability(availabilityId: string, payload: UpdateAvailabilityDto): Observable<AvailabilityItem> {
    return this.http.patch<AvailabilityItem>(`${this.apiBaseUrl}/availability/${availabilityId}`, payload);
  }

  deleteAvailability(availabilityId: string): Observable<{ deleted: boolean; id: string }> {
    return this.http.delete<{ deleted: boolean; id: string }>(`${this.apiBaseUrl}/availability/${availabilityId}`);
  }

  events(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiBaseUrl}/events`);
  }

  createEvent(payload: CreateEventDto): Observable<any> {
    return this.http.post<any>(`${this.apiBaseUrl}/events`, payload);
  }

  updateEvent(eventId: string, payload: UpdateEventDto & { editMode?: 'single' | 'series'; occurrenceStart?: string }): Observable<any> {
    return this.http.patch<any>(`${this.apiBaseUrl}/events/${eventId}`, payload);
  }

  deleteEvent(eventId: string, options?: { mode?: 'single' | 'series'; occurrenceStart?: string }): Observable<{ deleted: boolean; id: string }> {
    const params = new URLSearchParams();
    if (options?.mode) params.set('mode', options.mode);
    if (options?.occurrenceStart) params.set('occurrenceStart', options.occurrenceStart);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return this.http.delete<{ deleted: boolean; id: string }>(`${this.apiBaseUrl}/events/${eventId}${suffix}`);
  }

  assignVolunteer(payload: AssignVolunteerDto): Observable<any> {
    return this.http.post<any>(`${this.apiBaseUrl}/events/assignments`, payload);
  }

  inventorySummary(): Observable<InventorySummary> {
    return this.http.get<InventorySummary>(`${this.apiBaseUrl}/inventory/summary`);
  }

  resources(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiBaseUrl}/resources`);
  }

  resourceSummary(): Observable<any> {
    return this.http.get<any>(`${this.apiBaseUrl}/resources/summary`);
  }

  aiSettings(): Observable<any> {
    return this.http.get(`${this.apiBaseUrl}/ai-settings`);
  }

  updateAiSettings(payload: { provider: string; apiKey?: string; ollamaUrl?: string; agnostic?: boolean; model?: string; automationMode?: string; remindersEnabled?: boolean; quietHours?: boolean; smtpHost?: string; smtpPort?: number; smtpSecure?: boolean; smtpUser?: string; smtpPassword?: string; smtpFromEmail?: string; smtpFromName?: string; smtpReplyTo?: string; redisUrl?: string; webAppUrl?: string; resourceStorageDriver?: string; totalStorageLimitBytes?: number; defaultTeamStorageLimitBytes?: number; resourceTeamQuotaRules?: Array<{ teamId: string; storageLimitBytes?: number }>; resourceS3Endpoint?: string; resourceS3Region?: string; resourceS3Bucket?: string; resourceS3AccessKey?: string; resourceS3SecretKey?: string; resourceS3ForcePathStyle?: boolean; resourceS3UseSsl?: boolean; resourceJobConcurrency?: number; notificationJobConcurrency?: number; aiJobConcurrency?: number; schedulingPreviewTransport?: 'polling' | 'websocket' | 'hybrid'; schedulingPreviewRetryCount?: number; schedulingPreviewPollIntervalMs?: number; schedulingAsyncRangeDays?: number; schedulingAsyncManualSelections?: number; schedulingAsyncWithoutEvent?: boolean; inAppNotificationsEnabled?: boolean; websocketNotificationsEnabled?: boolean; emailNotificationsEnabled?: boolean; webhookEnabled?: boolean; webhookUrl?: string; webhookSecret?: string }): Observable<any> {
    return this.http.patch(`${this.apiBaseUrl}/ai-settings`, payload);
  }

  pingAiProvider(payload: { provider: string; apiKey?: string; ollamaUrl?: string }): Observable<{ ok: boolean; latencyMs?: number }> {
    return this.http.post<{ ok: boolean; latencyMs?: number }>(`${this.apiBaseUrl}/ai-settings/ping`, payload);
  }

  testSmtp(to: string): Observable<any> {
    return this.http.post<any>(`${this.apiBaseUrl}/ai-settings/test-smtp`, { to });
  }

  testWebhook(): Observable<any> {
    return this.http.post<any>(`${this.apiBaseUrl}/ai-settings/test-webhook`, {});
  }

  getAiModels(provider: string, apiKey?: string, ollamaUrl?: string): Observable<{ models: string[] }> {
    let url = `${this.apiBaseUrl}/ai-settings/models?provider=${provider}`;
    if (apiKey) url += `&apiKey=${encodeURIComponent(apiKey)}`;
    if (ollamaUrl) url += `&ollamaUrl=${encodeURIComponent(ollamaUrl)}`;
    return this.http.get<{ models: string[] }>(url);
  }

  aiCapabilities(): Observable<Array<{ provider: string; supportsChat: boolean; supportsModelListing: boolean; supportsHealthcheck: boolean }>> {
    return this.http.get<Array<{ provider: string; supportsChat: boolean; supportsModelListing: boolean; supportsHealthcheck: boolean }>>(`${this.apiBaseUrl}/ai-settings/capabilities`);
  }

  createAiJob(payload: { provider: string; model?: string; prompt: string; apiKey?: string; ollamaUrl?: string }): Observable<any> {
    return this.http.post<any>(`${this.apiBaseUrl}/ai-settings/jobs`, payload);
  }

  jobs(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiBaseUrl}/jobs`);
  }

  job(jobId: string): Observable<any> {
    return this.http.get<any>(`${this.apiBaseUrl}/jobs/${jobId}`);
  }

  notifications(): Observable<NotificationItem[]> {
    return this.http.get<NotificationItem[]>(`${this.apiBaseUrl}/notifications`);
  }

  recentNotificationDeliveries(limit = 20): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiBaseUrl}/notifications/deliveries/recent?limit=${limit}`);
  }

  markNotificationRead(notificationId: string): Observable<NotificationItem> {
    return this.http.patch<NotificationItem>(`${this.apiBaseUrl}/notifications/${notificationId}/read`, {});
  }

  replacements(): Observable<ReplacementItem[]> {
    return this.http.get<ReplacementItem[]>(`${this.apiBaseUrl}/replacements`);
  }

  createReplacement(payload: CreateReplacementDto): Observable<ReplacementItem> {
    return this.http.post<ReplacementItem>(`${this.apiBaseUrl}/replacements`, payload);
  }

  resolveReplacement(replacementId: string, payload: ResolveReplacementDto): Observable<ReplacementItem> {
    return this.http.patch<ReplacementItem>(`${this.apiBaseUrl}/replacements/${replacementId}/resolve`, payload);
  }

  generateSchedulePreview(payload: SchedulePreviewRequest): Observable<SchedulePlanResponse> {
    return this.http.post<SchedulePlanResponse>(`${this.apiBaseUrl}/scheduling/generate`, payload);
  }

  applySchedulePlan(payload: ScheduleApplyRequest): Observable<SchedulePlanResponse> {
    return this.http.post<SchedulePlanResponse>(`${this.apiBaseUrl}/scheduling/apply`, payload);
  }

  schedulingPlans(eventId?: string): Observable<SchedulePlanListItem[]> {
    const suffix = eventId ? `?eventId=${eventId}` : '';
    return this.http.get<SchedulePlanListItem[]>(`${this.apiBaseUrl}/scheduling/plans${suffix}`);
  }

  schedulingPlan(planId: string): Observable<SchedulePlanResponse> {
    return this.http.get<SchedulePlanResponse>(`${this.apiBaseUrl}/scheduling/plans/${planId}`);
  }

  schedulingMetrics(): Observable<any> {
    return this.http.get<any>(`${this.apiBaseUrl}/scheduling/metrics`);
  }

  resetSchedulingMetrics(): Observable<any> {
    return this.http.post<any>(`${this.apiBaseUrl}/scheduling/metrics/reset`, {});
  }

  recentAuditLogs(limit = 20): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiBaseUrl}/logs/recent?limit=${limit}`);
  }

  // Inventory CRUD
  inventoryItems(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiBaseUrl}/inventory`);
  }

  createInventoryItem(payload: { name: string; serialNumber?: string; status?: string; teamId?: string; maintenanceDueAt?: string }): Observable<any> {
    return this.http.post<any>(`${this.apiBaseUrl}/inventory`, payload);
  }

  updateInventoryItem(id: string, payload: Partial<{ teamId: string; name: string; serialNumber: string; status: string; maintenanceDueAt: string }>): Observable<any> {
    return this.http.patch<any>(`${this.apiBaseUrl}/inventory/${id}`, payload);
  }

  deleteInventoryItem(id: string): Observable<{ deleted: boolean; id: string }> {
    return this.http.delete<{ deleted: boolean; id: string }>(`${this.apiBaseUrl}/inventory/${id}`);
  }

  // Resources CRUD
  uploadResource(file: File, teamId?: string): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    if (teamId) formData.append('teamId', teamId);
    return this.http.post<any>(`${this.apiBaseUrl}/resources/upload`, formData);
  }

  uploadResourceWithProgress(file: File, teamId?: string): Observable<HttpEvent<any>> {
    const formData = new FormData();
    formData.append('file', file);
    if (teamId) formData.append('teamId', teamId);
    return this.http.post<any>(`${this.apiBaseUrl}/resources/upload`, formData, {
      observe: 'events',
      reportProgress: true
    });
  }

  uploadResourceAsync(file: File, teamId?: string): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    if (teamId) formData.append('teamId', teamId);
    return this.http.post<any>(`${this.apiBaseUrl}/resources/upload-async`, formData);
  }

  renameResource(id: string, name: string): Observable<any> {
    return this.http.patch<any>(`${this.apiBaseUrl}/resources/${id}`, { name });
  }

  deleteResource(id: string): Observable<{ deleted: boolean; id: string }> {
    return this.http.delete<{ deleted: boolean; id: string }>(`${this.apiBaseUrl}/resources/${id}`);
  }

  downloadResource(id: string): string {
    return `${this.apiBaseUrl}/resources/${id}/download`;
  }

  downloadResourceWithProgress(id: string): Observable<HttpEvent<Blob>> {
    return this.http.get(`${this.apiBaseUrl}/resources/${id}/download`, {
      observe: 'events',
      reportProgress: true,
      responseType: 'blob'
    });
  }

  prepareResourceDownload(id: string): Observable<any> {
    return this.http.post<any>(`${this.apiBaseUrl}/resources/${id}/download-async`, {});
  }

  // Meeting Groups

  meetingGroups() {
    return this.http.get<MeetingGroupItem[]>(`${this.apiBaseUrl}/meeting-groups`);
  }

  createMeetingGroup(payload: CreateMeetingGroupDto) {
    return this.http.post<MeetingGroupItem>(`${this.apiBaseUrl}/meeting-groups`, payload);
  }

  updateMeetingGroup(id: string, payload: UpdateMeetingGroupDto) {
    return this.http.patch<MeetingGroupItem>(`${this.apiBaseUrl}/meeting-groups/${id}`, payload);
  }

  deleteMeetingGroup(id: string) {
    return this.http.delete<{ deleted: boolean; id: string }>(`${this.apiBaseUrl}/meeting-groups/${id}`);
  }

  assignMeetingGroupMembers(id: string, userIds: string[]) {
    return this.http.put<{ updated: boolean }>(`${this.apiBaseUrl}/meeting-groups/${id}/members`, { userIds });
  }

  // Meetings

  meetings(start?: string, end?: string) {
    let params = new HttpParams();
    if (start) params = params.set('start', start);
    if (end) params = params.set('end', end);
    return this.http.get<MeetingListItem[]>(`${this.apiBaseUrl}/meetings`, { params });
  }

  createMeeting(payload: CreateMeetingDto) {
    return this.http.post<MeetingListItem>(`${this.apiBaseUrl}/meetings`, payload);
  }

  updateMeeting(id: string, payload: ExtendedUpdateMeetingDto) {
    return this.http.patch<MeetingListItem>(`${this.apiBaseUrl}/meetings/${id}`, payload);
  }

  deleteMeeting(id: string, mode: 'single' | 'series' = 'single', occurrenceStart?: string) {
    let params = new HttpParams().set('mode', mode);
    if (occurrenceStart) {
      params = params.set('occurrenceStart', occurrenceStart);
    }
    return this.http.delete<{ deleted: boolean; id: string }>(`${this.apiBaseUrl}/meetings/${id}`, { params });
  }
}

