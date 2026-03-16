import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthApiService } from '../../core/services/auth-api.service';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-auth-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="mx-auto flex min-h-screen max-w-5xl items-center px-4 py-12">
      <div class="shell-card grid w-full gap-8 overflow-hidden md:grid-cols-2">
        <div class="bg-slate-950 p-8 text-white">
          <p class="text-sm uppercase tracking-[0.3em] text-amber-400">Accesso</p>
          <h1 class="mt-4 text-4xl font-semibold">Gestione turni, team ed eventi in un unico flusso.</h1>
          <p class="mt-4 text-slate-300">Login per amministratore, leader di servizio e volontari. Onboarding guidato dopo la registrazione.</p>
        </div>
        <div class="p-8">
          <h2 class="text-2xl font-semibold text-slate-900">Accedi o registrati</h2>
          <div class="mt-6 grid gap-4">
            <input class="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Nome completo" [(ngModel)]="fullName" />
            <input class="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Email" [(ngModel)]="email" />
            <input class="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Password" type="password" [(ngModel)]="password" />
            <button class="rounded-2xl bg-orange-600 px-4 py-3 font-medium text-white" (click)="login()" [disabled]="loading()">
              {{ loading() ? 'Accesso...' : 'Entra' }}
            </button>
            <button class="rounded-2xl border border-slate-200 px-4 py-3 font-medium text-slate-700" (click)="register()" [disabled]="loading()">
              Crea account volontario
            </button>
            <p class="text-sm" [class.text-red-700]="statusType() === 'error'" [class.text-emerald-700]="statusType() === 'success'" *ngIf="statusMessage()">
              {{ statusMessage() }}
            </p>
          </div>
        </div>
      </div>
    </section>
  `
})
export class AuthPageComponent {
  private readonly authApi = inject(AuthApiService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  protected fullName = '';
  protected email = 'admin@shift.local';
  protected password = 'ChangeMe123!';
  protected readonly loading = signal(false);
  protected readonly statusMessage = signal('');
  protected readonly statusType = signal<'success' | 'error'>('success');

  login(): void {
    this.loading.set(true);
    this.statusMessage.set('');
    this.authApi.login(this.email, this.password).subscribe({
      next: (response) => {
        this.session.setSession(response.user, response.accessToken);
        void this.router.navigateByUrl('/dashboard');
      },
      error: () => {
        this.statusType.set('error');
        this.statusMessage.set('Login non riuscito');
        this.loading.set(false);
      },
      complete: () => this.loading.set(false)
    });
  }

  register(): void {
    this.loading.set(true);
    this.statusMessage.set('');
    this.authApi.register(this.fullName, this.email, this.password).subscribe({
      next: () => {
        this.statusType.set('success');
        this.statusMessage.set('Registrazione completata. Effettua il login.');
      },
      error: () => {
        this.statusType.set('error');
        this.statusMessage.set('Registrazione non riuscita');
      },
      complete: () => this.loading.set(false)
    });
  }
}
