import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';

const THEME_STORAGE_KEY = 'shift.theme-preference';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  private readonly preferenceSignal = signal<ThemePreference>(this.restorePreference());
  private readonly systemDarkSignal = signal(this.mediaQuery.matches);

  readonly preference = this.preferenceSignal.asReadonly();
  readonly resolvedTheme = computed<'light' | 'dark'>(() => {
    const preference = this.preferenceSignal();
    if (preference === 'system') {
      return this.systemDarkSignal() ? 'dark' : 'light';
    }
    return preference;
  });

  constructor() {
    this.mediaQuery.addEventListener('change', (event) => {
      this.systemDarkSignal.set(event.matches);
      if (this.preferenceSignal() === 'system') {
        this.applyThemeClass();
      }
    });
    this.applyThemeClass();
  }

  setPreference(preference: ThemePreference): void {
    this.preferenceSignal.set(preference);
    localStorage.setItem(THEME_STORAGE_KEY, preference);
    this.applyThemeClass();
  }

  private restorePreference(): ThemePreference {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
  }

  private applyThemeClass(): void {
    const root = this.document.documentElement;
    const dark = this.resolvedTheme() === 'dark';
    root.classList.toggle('app-dark', dark);
    root.style.colorScheme = dark ? 'dark' : 'light';
  }
}
