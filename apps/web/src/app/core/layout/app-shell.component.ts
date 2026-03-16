import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import type { Role } from '@shift-complete/shared-types';
import { SessionService } from '../services/session.service';

const ROLES = {
  ADMINISTRATOR: 'administrator' as Role,
  SERVICE_LEADER: 'service_leader' as Role,
  VOLUNTEER: 'volunteer' as Role,
};

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-screen bg-[radial-gradient(circle_at_top,#dbe7ff,transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eef2f8_100%)]">
      <header class="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 shadow-sm backdrop-blur">
        <div class="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div class="flex items-center gap-8">
            <button type="button" class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-slate-300 hover:bg-white" (click)="goToHome()">
              <span class="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#3156b3,#4979e6)] text-white shadow-sm">
                <i class="pi pi-briefcase text-base"></i>
              </span>
              <span>
                <span class="block text-sm font-semibold tracking-tight text-slate-900">Shift Complete</span>
                <span class="block text-[11px] uppercase tracking-[0.22em] text-slate-400">Control Surface</span>
              </span>
            </button>

            <nav class="hidden gap-1 md:flex">
              <a
                *ngFor="let item of navigationItems()"
                [routerLink]="item.path"
                routerLinkActive="bg-slate-950 text-white font-medium shadow-sm"
                class="rounded-xl px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                {{ item.label }}
              </a>
            </nav>
          </div>

          <div class="flex items-center gap-3">
            <div class="hidden items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 md:flex" *ngIf="needsOnboarding()">
              <i class="pi pi-compass text-[10px]"></i>
              Onboarding da completare
            </div>
            <button type="button" class="hidden rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 md:inline-flex" (click)="goToOnboarding()" *ngIf="currentUser()?.role === 'volunteer'">
              Profilo operativo
            </button>
            <button type="button" class="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-2 py-2 transition hover:border-slate-300 hover:bg-slate-50" (click)="goToUserPage()" *ngIf="currentUser() as user">
              <span class="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,#3156b3,#4979e6)] text-sm font-semibold text-white">{{ initials(user.fullName) }}</span>
              <span class="hidden text-right md:block">
                <span class="block text-sm font-medium leading-none text-slate-900">{{ user.fullName }}</span>
                <span class="mt-1 block text-xs text-slate-500">{{ roleLabel(user.role) }}</span>
              </span>
            </button>
            <button type="button" class="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900" (click)="signOut()" title="Esci">
              <i class="pi pi-sign-out text-sm"></i>
            </button>
          </div>
        </div>

        <div class="border-t border-slate-200/80 px-4 py-2 md:hidden">
          <nav class="flex gap-2 overflow-x-auto">
            <a
              *ngFor="let item of navigationItems()"
              [routerLink]="item.path"
              routerLinkActive="bg-slate-950 font-medium text-white"
              class="whitespace-nowrap rounded-xl px-3 py-1.5 text-sm text-slate-600 transition"
            >
              {{ item.label }}
            </a>
          </nav>
        </div>
      </header>

      <main class="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <router-outlet />
      </main>
    </div>
  `
})
export class AppShellComponent {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  protected readonly currentUser = computed(() => this.session.getCurrentUser());
  protected readonly needsOnboarding = computed(() => {
    const user = this.session.getCurrentUser();
    return Boolean(user && user.role === ROLES.VOLUNTEER && !user.onboardingCompleted);
  });

  protected readonly navigationItems = computed(() => {
    const user = this.session.getCurrentUser();
    if (!user) {
      return [];
    }

      const items = [
        { label: 'Dashboard', path: '/dashboard', roles: [ROLES.ADMINISTRATOR, ROLES.SERVICE_LEADER, ROLES.VOLUNTEER] },
        { label: 'Calendario', path: '/calendar', roles: [ROLES.ADMINISTRATOR, ROLES.SERVICE_LEADER, ROLES.VOLUNTEER] },
        { label: 'Eventi', path: '/events', roles: [ROLES.ADMINISTRATOR, ROLES.SERVICE_LEADER, ROLES.VOLUNTEER] },
        { label: 'Sostituzioni', path: '/replacements', roles: [ROLES.ADMINISTRATOR, ROLES.SERVICE_LEADER] },
        { label: 'Team', path: '/teams', roles: [ROLES.ADMINISTRATOR, ROLES.SERVICE_LEADER] },
        { label: 'Inventario', path: '/inventory', roles: [ROLES.ADMINISTRATOR, ROLES.SERVICE_LEADER] },
      { label: 'Utenti', path: '/admin/users', roles: [ROLES.ADMINISTRATOR] },
      { label: 'Risorse', path: '/resources', roles: [ROLES.ADMINISTRATOR, ROLES.SERVICE_LEADER, ROLES.VOLUNTEER] },
      { label: 'Impostazioni', path: '/settings', roles: [ROLES.ADMINISTRATOR, ROLES.SERVICE_LEADER, ROLES.VOLUNTEER] }
    ];

    return items.filter((item) => item.roles.includes(user.role));
  });

  protected signOut(): void {
    this.session.signOut();
    void this.router.navigateByUrl('/auth');
  }

  protected goToOnboarding(): void {
    void this.router.navigateByUrl('/onboarding');
  }

  protected goToHome(): void {
    void this.router.navigateByUrl('/dashboard');
  }

  protected goToUserPage(): void {
    void this.router.navigateByUrl('/user');
  }

  protected initials(fullName: string): string {
    return fullName.split(' ').filter(Boolean).slice(0, 2).map((chunk) => chunk[0]?.toUpperCase() ?? '').join('') || 'SC';
  }

  protected roleLabel(role: Role): string {
    switch (role) {
      case ROLES.ADMINISTRATOR:
        return 'Amministratore';
      case ROLES.SERVICE_LEADER:
        return 'Leader del servizio';
      default:
        return 'Volontario';
    }
  }
}
