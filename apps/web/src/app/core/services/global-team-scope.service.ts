import { Injectable, computed, signal } from '@angular/core';

const STORAGE_KEY = 'shift.team-scope';

@Injectable({ providedIn: 'root' })
export class GlobalTeamScopeService {
  private readonly teamIdSignal = signal<string>(this.restore());

  readonly teamId = this.teamIdSignal.asReadonly();
  readonly hasSelection = computed(() => Boolean(this.teamIdSignal()));

  setTeam(teamId: string | null | undefined): void {
    const normalized = teamId ?? '';
    this.teamIdSignal.set(normalized);
    if (normalized) {
      localStorage.setItem(STORAGE_KEY, normalized);
      return;
    }

    localStorage.removeItem(STORAGE_KEY);
  }

  clear(): void {
    this.setTeam('');
  }

  matches(teamId: string | null | undefined): boolean {
    const selected = this.teamIdSignal();
    return !selected || selected === (teamId ?? '');
  }

  private restore(): string {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  }
}
