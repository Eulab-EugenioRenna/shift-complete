import { Injectable, signal } from '@angular/core';
import { UserProfile } from '@shift-complete/shared-types';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly userSignal = signal<UserProfile | null>(this.restoreSession());

  readonly user = this.userSignal.asReadonly();

  isAuthenticated(): boolean {
    return this.userSignal() !== null;
  }

  getCurrentUser(): UserProfile | null {
    return this.userSignal();
  }

  setSession(user: UserProfile, accessToken: string): void {
    localStorage.setItem('shift.token', accessToken);
    localStorage.setItem('shift.session', JSON.stringify(user));
    this.userSignal.set(user);
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
  }

  private restoreSession(): UserProfile | null {
    const storedSession = localStorage.getItem('shift.session');
    if (storedSession) {
      return JSON.parse(storedSession) as UserProfile;
    }
    return null;
  }
}
