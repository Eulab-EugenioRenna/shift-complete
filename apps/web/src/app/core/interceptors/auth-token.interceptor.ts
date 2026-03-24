import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthApiService } from '../services/auth-api.service';
import { SessionService } from '../services/session.service';
import { UiFeedbackService } from '../services/ui-feedback.service';

export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const authApi = inject(AuthApiService);
  const router = inject(Router);
  const session = inject(SessionService);
  const feedback = inject(UiFeedbackService);
  const token = localStorage.getItem('shift.token');
  if (!token) {
    return next(req);
  }

  const authenticatedRequest = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  return next(authenticatedRequest).pipe(
    catchError((error: unknown) => {
      const refreshToken = session.getRefreshToken();
      const isAuthRequest = req.url.includes('/auth/login') || req.url.includes('/auth/register') || req.url.includes('/auth/refresh');
      const isUnauthorized = error instanceof HttpErrorResponse && error.status === 401;

      if (!isUnauthorized || !refreshToken || isAuthRequest) {
        return throwError(() => error);
      }

      return authApi.refreshToken({ refreshToken }).pipe(
        switchMap((response) => {
          session.setSession(response.user, response.accessToken);
          session.setRefreshToken(response.refreshToken ?? refreshToken);

          return next(
            req.clone({
              setHeaders: {
                Authorization: `Bearer ${response.accessToken}`
              }
            })
          );
        }),
        catchError((refreshError) => {
          session.signOut();
          feedback.error('Sessione scaduta', 'Effettua di nuovo l\'accesso per continuare.');
          void router.navigateByUrl('/auth');
          return throwError(() => refreshError);
        })
      );
    })
  );
};
