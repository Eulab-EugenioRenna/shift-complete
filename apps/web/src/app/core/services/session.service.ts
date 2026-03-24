import { Injectable, signal } from '@angular/core';
import { UserProfile } from '@shift-complete/shared-types';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private static readonly redirectStorageKey = 'shift.redirectAfterAuth';
  private readonly userSignal = signal<UserProfile | null>(this.restoreSession());
  private readonly validatedSignal = signal(false);

  readonly user = this.userSignal.asReadonly();

  isAuthenticated(): boolean {
    return this.userSignal() !== null && Boolean(this.getAccessToken());
  }

  getAccessToken(): string | null {
    return localStorage.getItem('shift.token');
  }

  rememberRedirectUrl(url: string): void {
    if (!url || url === '/auth') {
      return;
    }

    localStorage.setItem(SessionService.redirectStorageKey, url);
  }

  consumeRedirectUrl(): string | null {
    const url = localStorage.getItem(SessionService.redirectStorageKey);
    if (url) {
      localStorage.removeItem(SessionService.redirectStorageKey);
    }
    return url;
  }

  peekRedirectUrl(): string | null {
    return localStorage.getItem(SessionService.redirectStorageKey);
  }

  clearRedirectUrl(): void {
    localStorage.removeItem(SessionService.redirectStorageKey);
  }

  needsValidation(): boolean {
    return Boolean(this.getAccessToken()) && !this.validatedSignal();
  }

  getCurrentUser(): UserProfile | null {
    return this.userSignal();
  }

  getCurrentRole(): UserProfile['role'] | null {
    return this.userSignal()?.role ?? null;
  }

  hasAnyRole(...roles: UserProfile['role'][]): boolean {
    const role = this.getCurrentRole();
    return Boolean(role && roles.includes(role));
  }

  isAdministrator(): boolean {
    return this.getCurrentRole() === 'administrator';
  }

  isServiceLeader(): boolean {
    return this.getCurrentRole() === 'service_leader';
  }

  isVolunteer(): boolean {
    return this.getCurrentRole() === 'volunteer';
  }

  setSession(user: UserProfile, accessToken: string): void {
    localStorage.setItem('shift.token', accessToken);
    localStorage.setItem('shift.session', JSON.stringify(user));
    this.userSignal.set(user);
    this.validatedSignal.set(true);
  }

  setRefreshToken(refreshToken: string | null): void {
    if (refreshToken) {
      localStorage.setItem('shift.refresh', refreshToken);
      return;
    }

    localStorage.removeItem('shift.refresh');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('shift.refresh');
  }

  signOut(): void {
    localStorage.removeItem('shift.token');
    localStorage.removeItem('shift.refresh');
    localStorage.removeItem('shift.session');
    this.userSignal.set(null);
    this.validatedSignal.set(false);
  }

  private restoreSession(): UserProfile | null {
    const accessToken = localStorage.getItem('shift.token');
    const storedSession = localStorage.getItem('shift.session');
    if (!accessToken) {
      localStorage.removeItem('shift.session');
      return null;
    }

    if (storedSession) {
      return JSON.parse(storedSession) as UserProfile;
    }
    return null;
  }
}
