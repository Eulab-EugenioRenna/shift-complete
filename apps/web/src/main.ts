import { bootstrapApplication } from '@angular/platform-browser';
import { LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { provideRouter, withEnabledBlockingInitialNavigation } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import localeIt from '@angular/common/locales/it';
import { AppComponent } from './app/app.component';
import { appRoutes } from './app/app.routes';
import { authTokenInterceptor } from './app/core/interceptors/auth-token.interceptor';

registerLocaleData(localeIt);

bootstrapApplication(AppComponent, {
  providers: [
    { provide: LOCALE_ID, useValue: 'it-IT' },
    provideRouter(appRoutes, withEnabledBlockingInitialNavigation()),
    provideAnimationsAsync(),
    provideHttpClient(withInterceptors([authTokenInterceptor])),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: '.app-dark'
        }
      },
      ripple: true
    }),
    provideServiceWorker('ngsw-worker.js', {
      enabled: true,
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
}).catch((error) => console.error(error));
