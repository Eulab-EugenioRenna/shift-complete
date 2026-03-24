import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UiButtonComponent, UiInputComponent, UiLabelComponent, UiSelectComponent } from '@shift-complete/ui-kit';
import { finalize } from 'rxjs';
import { AppApiService } from '../../shared/services/app-api.service';
import { AuthApiService } from '../../core/services/auth-api.service';
import { SessionService } from '../../core/services/session.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';

@Component({
  selector: 'app-auth-page',
  standalone: true,
  imports: [CommonModule, FormsModule, UiButtonComponent, UiInputComponent, UiLabelComponent, UiSelectComponent],
  templateUrl: './auth-page.component.html',
})
export class AuthPageComponent {
  private readonly authApi = inject(AuthApiService);
  private readonly api = inject(AppApiService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly feedback = inject(UiFeedbackService);

  protected fullName = '';
  protected email = 'admin@shift.local';
  protected password = 'ChangeMe123!';
  protected teamId = '';
  protected readonly mode = signal<'login' | 'register'>('login');
  protected readonly showPassword = signal(false);
  protected readonly loading = signal(false);
  protected readonly statusMessage = signal('');
  protected readonly statusType = signal<'success' | 'error'>('success');
  protected readonly teamOptions = signal<Array<{ label: string; value: string }>>([]);
  protected readonly requestHint = computed(() => this.teamId ? 'Richiesta collegata al team selezionato.' : 'Senza team, l\'utente potra completare l\'onboarding subito dopo il login.');

  constructor() {
    this.authApi.availableTeams().subscribe({
      next: (teams) => this.teamOptions.set(teams.map((team) => ({ label: team.name, value: team.id }))),
    });

    this.restoreValidSession();
  }

  protected castString(value: unknown): string {
    return value ? String(value) : '';
  }

  protected toggleMode(): void {
    this.mode.set(this.mode() === 'login' ? 'register' : 'login');
    this.statusMessage.set('');
  }

  login(): void {
    const validationError = this.validateLogin();
    if (validationError) {
      this.statusType.set('error');
      this.statusMessage.set(validationError);
      this.feedback.error('Controlla i dati di accesso', validationError);
      return;
    }

    this.loading.set(true);
    this.statusMessage.set('');
    this.authApi.login({ email: this.email, password: this.password }).subscribe({
      next: (response) => {
        this.session.setSession(response.user, response.accessToken);
        this.session.setRefreshToken(response.refreshToken ?? null);
        this.feedback.success('Accesso completato', `Bentornato ${response.user.fullName}.`);
        const redirectUrl = this.session.consumeRedirectUrl() ?? '/dashboard';
        void this.router.navigateByUrl(redirectUrl);
      },
      error: (error: { message?: string }) => {
        this.statusType.set('error');
        this.statusMessage.set(error?.message ?? 'Login non riuscito');
        this.feedback.error('Accesso non riuscito', error?.message ?? 'Verifica email e password.');
        this.loading.set(false);
      },
      complete: () => this.loading.set(false)
    });
  }

  register(): void {
    const validationError = this.validateRegister();
    if (validationError) {
      this.statusType.set('error');
      this.statusMessage.set(validationError);
      this.feedback.error('Controlla la richiesta', validationError);
      return;
    }

    this.loading.set(true);
    this.statusMessage.set('');
    this.authApi.register({ fullName: this.fullName, email: this.email, password: this.password, teamId: this.teamId || undefined }).subscribe({
      next: (response) => {
        this.statusType.set('success');
        this.statusMessage.set(response.pendingApproval ? 'Richiesta inviata al leader del team. Attendi approvazione.' : 'Registrazione completata. Effettua il login.');
        this.feedback.success('Richiesta registrata', response.message);
        if (!response.pendingApproval) {
          this.mode.set('login');
        }
      },
      error: (error: { message?: string }) => {
        this.statusType.set('error');
        this.statusMessage.set(error?.message ?? 'Registrazione non riuscita');
        this.feedback.error('Registrazione non riuscita', error?.message ?? 'Controlla i dati inseriti e riprova.');
      },
      complete: () => this.loading.set(false)
    });
  }

  private validateLogin(): string | null {
    if (!this.email.trim()) {
      return 'Inserisci l\'email.';
    }
    if (!this.password.trim()) {
      return 'Inserisci la password.';
    }
    return null;
  }

  private validateRegister(): string | null {
    if (!this.fullName.trim()) {
      return 'Inserisci il nome completo.';
    }
    if (!this.email.trim()) {
      return 'Inserisci l\'email.';
    }
    if (this.password.trim().length < 6) {
      return 'La password deve avere almeno 6 caratteri.';
    }
    return null;
  }

  private restoreValidSession(): void {
    if (!this.session.getAccessToken()) {
      return;
    }

    if (this.session.isAuthenticated() && !this.session.needsValidation()) {
      const redirectUrl = this.session.consumeRedirectUrl() ?? '/dashboard';
      void this.router.navigateByUrl(redirectUrl);
      return;
    }

    this.loading.set(true);
    this.api.me()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (profile) => {
          const token = this.session.getAccessToken();
          if (!token) {
            this.session.signOut();
            return;
          }

          this.session.setSession(profile, token);
          const redirectUrl = this.session.consumeRedirectUrl() ?? '/dashboard';
          void this.router.navigateByUrl(redirectUrl);
        },
        error: () => {
          this.session.signOut();
          void this.router.navigateByUrl('/auth');
        }
      });
  }
}
