import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AppApiService {
  private readonly apiBaseUrl = 'http://localhost:3333/api';

  constructor(private readonly http: HttpClient) {}

  me(): Observable<any> {
    return this.http.get(`${this.apiBaseUrl}/users/me`);
  }

  teams(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiBaseUrl}/teams`);
  }

  createTeam(payload: { name: string; description?: string; leaderId?: string }): Observable<any> {
    return this.http.post(`${this.apiBaseUrl}/teams`, payload);
  }

  updateTeam(teamId: string, payload: { name?: string; description?: string; leaderId?: string }): Observable<any> {
    return this.http.patch(`${this.apiBaseUrl}/teams/${teamId}`, payload);
  }

  deleteTeam(teamId: string): Observable<any> {
    return this.http.delete(`${this.apiBaseUrl}/teams/${teamId}`);
  }

  users(role?: string): Observable<any[]> {
    const suffix = role ? `?role=${role}` : '';
    return this.http.get<any[]>(`${this.apiBaseUrl}/users${suffix}`);
  }

  events(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiBaseUrl}/events`);
  }

  createEvent(payload: any): Observable<any> {
    return this.http.post(`${this.apiBaseUrl}/events`, payload);
  }

  updateEvent(eventId: string, payload: any): Observable<any> {
    return this.http.patch(`${this.apiBaseUrl}/events/${eventId}`, payload);
  }

  deleteEvent(eventId: string): Observable<any> {
    return this.http.delete(`${this.apiBaseUrl}/events/${eventId}`);
  }

  assignVolunteer(payload: { slotId: string; assigneeId?: string; status?: string; autoAssigned?: boolean }): Observable<any> {
    return this.http.post(`${this.apiBaseUrl}/events/assignments`, payload);
  }

  inventorySummary(): Observable<any> {
    return this.http.get(`${this.apiBaseUrl}/inventory/summary`);
  }

  resources(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiBaseUrl}/resources`);
  }

  aiSettings(): Observable<any> {
    return this.http.get(`${this.apiBaseUrl}/ai-settings`);
  }

  notifications(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiBaseUrl}/notifications`);
  }

  generateSchedulePreview(payload: { from: string; to: string; teamId?: string; apply?: boolean; includeExistingAssignments?: boolean }): Observable<any> {
    return this.http.post(`${this.apiBaseUrl}/scheduling/generate`, payload);
  }
}
