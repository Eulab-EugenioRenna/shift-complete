import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '../services/session.service';

export const onboardingGuard: CanActivateFn = (route) => {
  const session = inject(SessionService);
  const router = inject(Router);
  const user = session.getCurrentUser();
  const allowIncomplete = Boolean(route.data?.['allowIncompleteOnboarding']);

  if (!user) {
    return router.parseUrl('/auth');
  }

  if (user.onboardingCompleted || allowIncomplete || user.role !== 'volunteer') {
    return true;
  }

  return router.parseUrl('/onboarding');
};
