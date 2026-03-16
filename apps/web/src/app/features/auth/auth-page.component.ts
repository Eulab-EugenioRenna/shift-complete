import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UiSelectComponent } from '@shift-complete/ui-kit';
import { AppApiService } from '../../shared/services/app-api.service';
import { AuthApiService } from '../../core/services/auth-api.service';
import { SessionService } from '../../core/services/session.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';

@Component({
  selector: 'app-auth-page',
  standalone: true,
  imports: [CommonModule, FormsModule, UiSelectComponent],
  template: `
    <section class="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,#cfe0ff,transparent_40%),linear-gradient(180deg,#f8fafc_0%,#eef4ff_100%)] px-4 py-12">
      <div class="absolute inset-0 bg-[linear-gradient(120deg,rgba(73,121,230,0.08),transparent_35%,rgba(15,23,42,0.04))]"></div>
      <div class="relative flex w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/90 shadow-[0_24px_80px_rgba(45,76,145,0.18)] backdrop-blur md:flex-row">
        
        <!-- Branding Pane -->
        <div class="flex flex-col justify-center bg-[linear-gradient(180deg,#4979e6_0%,#3156b3_100%)] p-10 md:w-5/12 text-white">
          <div class="mb-6 flex items-center gap-2 text-blue-100">
            <i class="pi pi-briefcase text-2xl"></i>
            <span class="text-xl font-semibold tracking-tight text-white">Shift Complete</span>
          </div>
          <h1 class="text-3xl font-semibold tracking-tight leading-tight">
            Gestione turni, team ed eventi in un unico flusso.
          </h1>
          <p class="mt-4 text-sm leading-relaxed text-blue-100">
            Accesso controllato per amministratore, leader di servizio e volontari, con onboarding e richieste tracciate.
          </p>
          <div class="mt-8 grid gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 text-sm text-blue-50">
            <p class="font-medium text-white">Flusso operativo</p>
            <p>1. Registrazione o login con feedback immediato.</p>
            <p>2. Validazione, ruoli e regole applicati lato backend.</p>
            <p>3. Persistenza, log e notifiche sempre allineati.</p>
          </div>
        </div>

        <!-- Form Pane -->
        <div class="flex flex-col justify-center p-8 md:w-7/12 md:p-10">
          <div class="inline-flex w-fit rounded-full border border-slate-200 bg-slate-100 p-1 text-sm">
            <button type="button" class="rounded-full px-4 py-2 font-medium transition" [class.bg-white]="mode() === 'login'" [class.text-slate-900]="mode() === 'login'" [class.text-slate-500]="mode() !== 'login'" (click)="mode.set('login')">Accesso</button>
            <button type="button" class="rounded-full px-4 py-2 font-medium transition" [class.bg-white]="mode() === 'register'" [class.text-slate-900]="mode() === 'register'" [class.text-slate-500]="mode() !== 'register'" (click)="mode.set('register')">Registrazione</button>
          </div>
          <h2 class="mt-6 text-3xl font-semibold tracking-tight text-slate-900">{{ mode() === 'login' ? 'Accedi al tuo spazio operativo' : 'Crea una richiesta di accesso' }}</h2>
          <p class="mt-2 text-sm leading-relaxed text-slate-500">
            {{ mode() === 'login' ? 'Entra con il tuo account e riprendi i flussi del tuo ruolo.' : 'Invia la richiesta di accesso come volontario o crea il tuo account per iniziare l\'onboarding.' }}
          </p>
          <div class="mt-8 grid gap-5">
            <div class="grid gap-4">
              <input *ngIf="mode() === 'register'" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-[#4979e6] focus:outline-none focus:ring-2 focus:ring-[#4979e6]/20 transition" placeholder="Nome completo" [(ngModel)]="fullName" />
              <input class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-[#4979e6] focus:outline-none focus:ring-1 focus:ring-[#4979e6] transition" placeholder="Email" [(ngModel)]="email" />
              <div class="relative">
                <input class="w-full rounded-md border border-slate-300 px-3 py-2 pr-10 text-sm text-slate-800 placeholder-slate-400 focus:border-[#4979e6] focus:outline-none focus:ring-1 focus:ring-[#4979e6] transition" placeholder="Password" [type]="showPassword() ? 'text' : 'password'" [(ngModel)]="password" />
                <button type="button" class="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition hover:text-[#4979e6]" (click)="showPassword.set(!showPassword())" [attr.aria-label]="showPassword() ? 'Nascondi password' : 'Mostra password'">
                  <i class="pi" [class.pi-eye]="!showPassword()" [class.pi-eye-slash]="showPassword()"></i>
                </button>
              </div>
              <ui-select *ngIf="mode() === 'register'" label="Team richiesto" [options]="teamOptions()" [value]="teamId" (valueChange)="teamId = castString($event)"></ui-select>
              <p class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700" *ngIf="mode() === 'register'">
                Se selezioni un team, la richiesta dovra essere approvata da leader o amministratore prima del login.
              </p>
            </div>

            <div class="grid gap-3 pt-2">
              <button *ngIf="mode() === 'login'" class="w-full rounded-xl bg-[#4979e6] px-4 py-3 font-medium text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-70" (click)="login()" [disabled]="loading()">
                {{ loading() ? 'Accesso in corso...' : 'Entra' }}
              </button>
              <button *ngIf="mode() === 'register'" class="w-full rounded-xl bg-[#4979e6] px-4 py-3 font-medium text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-70" (click)="register()" [disabled]="loading()">
                {{ loading() ? 'Invio richiesta...' : 'Invia richiesta / crea account' }}
              </button>
              <button type="button" class="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition disabled:opacity-70" (click)="toggleMode()" [disabled]="loading()">
                {{ mode() === 'login' ? 'Vuoi registrarti?' : 'Hai gia un account?' }}
              </button>
            </div>

            <p class="text-center text-sm font-medium" [class.text-red-600]="statusType() === 'error'" [class.text-green-600]="statusType() === 'success'" *ngIf="statusMessage()">
              {{ statusMessage() }}
            </p>
            <p class="text-center text-xs text-slate-400" *ngIf="requestHint()">{{ requestHint() }}</p>
          </div>
        </div>
      </div>
    </section>
  `
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
        void this.router.navigateByUrl('/dashboard');
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
}
