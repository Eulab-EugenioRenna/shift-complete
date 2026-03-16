import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { onboardingGuard } from './core/guards/onboarding.guard';
import { roleGuard } from './core/guards/role.guard';

export const appRoutes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./core/layout/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        canActivate: [onboardingGuard],
        data: { allowIncompleteOnboarding: true },
        loadComponent: () => import('./features/dashboard/dashboard-page.component').then((m) => m.DashboardPageComponent)
      },
      {
        path: 'calendar',
        canActivate: [onboardingGuard],
        data: { allowIncompleteOnboarding: true },
        loadComponent: () => import('./features/calendar-view/calendar-view-page.component').then((m) => m.CalendarViewPageComponent)
      },
      {
        path: 'events',
        canActivate: [onboardingGuard],
        data: { allowIncompleteOnboarding: true },
        loadComponent: () => import('./features/events/events-page.component').then((m) => m.EventsPageComponent)
      },
      {
        path: 'replacements',
        canActivate: [roleGuard, onboardingGuard],
        data: { roles: ['administrator', 'service_leader'], allowIncompleteOnboarding: true },
        loadComponent: () => import('./features/replacements/replacements-history-page.component').then((m) => m.ReplacementsHistoryPageComponent)
      },
      {
        path: 'teams',
        canActivate: [roleGuard, onboardingGuard],
        data: { roles: ['administrator', 'service_leader'], allowIncompleteOnboarding: true },
        loadComponent: () => import('./features/teams/teams-page.component').then((m) => m.TeamsPageComponent)
      },
      {
        path: 'inventory',
        canActivate: [roleGuard, onboardingGuard],
        data: { roles: ['administrator', 'service_leader'], allowIncompleteOnboarding: true },
        loadComponent: () => import('./features/inventory/inventory-page.component').then((m) => m.InventoryPageComponent)
      },
      {
        path: 'resources',
        canActivate: [onboardingGuard],
        data: { allowIncompleteOnboarding: true },
        loadComponent: () => import('./features/resources/resources-page.component').then((m) => m.ResourcesPageComponent)
      },
      {
        path: 'user',
        canActivate: [onboardingGuard],
        data: { allowIncompleteOnboarding: true },
        loadComponent: () => import('./features/user/user-page.component').then((m) => m.UserPageComponent)
      },
      {
        path: 'settings',
        canActivate: [onboardingGuard],
        data: { allowIncompleteOnboarding: true },
        loadComponent: () => import('./features/settings/settings-page.component').then((m) => m.SettingsPageComponent)
      },
      {
        path: 'admin/users',
        canActivate: [roleGuard, onboardingGuard],
        data: { roles: ['administrator'], allowIncompleteOnboarding: true },
        loadComponent: () => import('./features/admin/admin-users-page.component').then((m) => m.AdminUsersPageComponent)
      },
      {
        path: 'admin/users/:userId',
        canActivate: [roleGuard, onboardingGuard],
        data: { roles: ['administrator'], allowIncompleteOnboarding: true },
        loadComponent: () => import('./features/admin/admin-user-detail-page.component').then((m) => m.AdminUserDetailPageComponent)
      },
      {
        path: 'onboarding',
        loadComponent: () => import('./features/onboarding/onboarding-page.component').then((m) => m.OnboardingPageComponent)
      }
    ]
  },
  {
    path: 'auth',
    loadComponent: () => import('./features/auth/auth-page.component').then((m) => m.AuthPageComponent)
  },
  { path: '**', redirectTo: '' }
];
