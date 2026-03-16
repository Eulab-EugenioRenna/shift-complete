import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Role } from '@shift-complete/shared-types';
import { SessionService } from '../services/session.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-screen px-4 py-4 md:px-6 md:py-6">
      <div class="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[280px_1fr]">
        <aside class="shell-card p-5">
          <div class="mb-8">
            <p class="text-xs uppercase tracking-[0.3em] text-slate-500">Shift Complete</p>
            <h1 class="mt-2 text-3xl font-semibold text-slate-900">Operations cockpit</h1>
            <div class="mt-4 rounded-2xl bg-slate-900 p-4 text-white" *ngIf="currentUser() as user">
              <p class="text-sm uppercase tracking-[0.2em] text-slate-400">{{ user.role }}</p>
              <p class="mt-1 font-medium">{{ user.fullName }}</p>
              <p class="text-xs text-slate-400">{{ user.email }}</p>
            </div>
          </div>
          <nav class="grid gap-2">
            <a
              *ngFor="let item of navigationItems()"
              [routerLink]="item.path"
              routerLinkActive="bg-slate-900 text-white"
              class="rounded-2xl px-4 py-3 text-slate-700 transition"
            >
              {{ item.label }}
            </a>
          </nav>
          <button class="mt-8 w-full rounded-2xl border border-slate-200 px-4 py-3 text-left text-slate-700" (click)="signOut()">
            Esci
          </button>
        </aside>
        <main class="shell-card p-4 md:p-6">
          <router-outlet />
        </main>
      </div>
    </div>
  `
})
export class AppShellComponent {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  protected readonly currentUser = computed(() => this.session.getCurrentUser());

  protected readonly navigationItems = computed(() => {
    const user = this.session.getCurrentUser();
    if (!user) {
      return [];
    }

    const items = [
      { label: 'Dashboard', path: '/dashboard', roles: [Role.ADMINISTRATOR, Role.SERVICE_LEADER, Role.VOLUNTEER] },
      { label: 'Calendario', path: '/calendar', roles: [Role.ADMINISTRATOR, Role.SERVICE_LEADER, Role.VOLUNTEER] },
      { label: 'Team', path: '/teams', roles: [Role.ADMINISTRATOR, Role.SERVICE_LEADER] },
      { label: 'Inventario', path: '/inventory', roles: [Role.ADMINISTRATOR, Role.SERVICE_LEADER] },
      { label: 'Risorse', path: '/resources', roles: [Role.ADMINISTRATOR, Role.SERVICE_LEADER, Role.VOLUNTEER] },
      { label: 'Impostazioni', path: '/settings', roles: [Role.ADMINISTRATOR, Role.SERVICE_LEADER, Role.VOLUNTEER] }
    ];

    return items.filter((item) => item.roles.includes(user.role));
  });

  signOut(): void {
    this.session.signOut();
    void this.router.navigateByUrl('/auth');
  }
}
