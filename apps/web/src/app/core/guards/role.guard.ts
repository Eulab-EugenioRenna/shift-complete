import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import type { Role } from '@shift-complete/shared-types';
import { SessionService } from '../services/session.service';

export const roleGuard: CanActivateFn = (route) => {
  const session = inject(SessionService);
  const router = inject(Router);
  const user = session.getCurrentUser();
  const allowedRoles = (route.data?.['roles'] as Role[] | undefined) ?? [];

  if (!user) {
    return router.parseUrl('/auth');
  }

  if (!allowedRoles.length || allowedRoles.includes(user.role)) {
    return true;
  }

  return router.parseUrl('/dashboard');
};
