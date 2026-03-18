import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import type { Role } from '@shift-complete/shared-types';
import { SpotlightSearchComponent } from '../../shared/components/spotlight-search.component';
import { SessionService } from '../services/session.service';
import { SpotlightSearchService } from '../services/spotlight-search.service';
import { ThemePreference, ThemeService } from '../services/theme.service';

const ROLES = {
  ADMINISTRATOR: 'administrator' as Role,
  SERVICE_LEADER: 'service_leader' as Role,
  VOLUNTEER: 'volunteer' as Role,
};

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, SpotlightSearchComponent],
  templateUrl: './app-shell.component.html'
})
export class AppShellComponent {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly spotlight = inject(SpotlightSearchService);
  protected readonly theme = inject(ThemeService);

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

  protected openSpotlight(): void {
    this.spotlight.openSpotlight();
  }

  protected themeLabel(): string {
    const preference = this.theme.preference();
    return preference === 'system' ? 'Sistema' : preference === 'dark' ? 'Scuro' : 'Chiaro';
  }

  protected setTheme(preference: ThemePreference): void {
    this.theme.setPreference(preference);
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

  protected hasCenteredNavigation(): boolean {
    return this.navigationItems().length > 0;
  }
}
