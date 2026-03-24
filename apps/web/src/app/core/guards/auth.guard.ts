import { inject } from '@angular/core';
import { CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AppApiService } from '../../shared/services/app-api.service';
import { SessionService } from '../services/session.service';

export const authGuard: CanActivateFn = (_route, state: RouterStateSnapshot) => {
  const api = inject(AppApiService);
  const session = inject(SessionService);
  const router = inject(Router);

  session.rememberRedirectUrl(state.url);

  if (!session.getAccessToken()) {
    session.signOut();
    return router.parseUrl('/auth');
  }

  if (session.isAuthenticated() && !session.needsValidation()) {
    return true;
  }

  return api.me().pipe(
    map((profile) => {
      const token = session.getAccessToken();
      if (!token) {
        session.signOut();
        return router.parseUrl('/auth');
      }

      session.setSession(profile, token);
      return true;
    }),
    catchError(() => {
      session.signOut();
      return of(router.parseUrl('/auth'));
    })
  );
};
