import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const appRoutes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./core/layout/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard-page.component').then((m) => m.DashboardPageComponent) },
      { path: 'calendar', loadComponent: () => import('./features/calendar/calendar-page.component').then((m) => m.CalendarPageComponent) },
      { path: 'teams', loadComponent: () => import('./features/teams/teams-page.component').then((m) => m.TeamsPageComponent) },
      { path: 'inventory', loadComponent: () => import('./features/inventory/inventory-page.component').then((m) => m.InventoryPageComponent) },
      { path: 'resources', loadComponent: () => import('./features/resources/resources-page.component').then((m) => m.ResourcesPageComponent) },
      { path: 'settings', loadComponent: () => import('./features/settings/settings-page.component').then((m) => m.SettingsPageComponent) },
      { path: 'onboarding', loadComponent: () => import('./features/onboarding/onboarding-page.component').then((m) => m.OnboardingPageComponent) }
    ]
  },
  {
    path: 'auth',
    loadComponent: () => import('./features/auth/auth-page.component').then((m) => m.AuthPageComponent)
  },
  { path: '**', redirectTo: '' }
];
