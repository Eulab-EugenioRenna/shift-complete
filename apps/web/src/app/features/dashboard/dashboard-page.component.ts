import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Role } from '@shift-complete/shared-types';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { AppApiService } from '../../shared/services/app-api.service';
import { LiveNotificationsService } from '../../core/services/live-notifications.service';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, CardModule, TagModule, ButtonModule, ProgressBarModule],
  template: `
    <section class="grid gap-6">
      <header class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p class="text-sm uppercase tracking-[0.3em] text-orange-600">Dashboard</p>
          <h2 class="text-3xl font-semibold text-slate-900">Controllo operativo per turni, coperture e criticita.</h2>
          <p class="mt-2 text-sm text-slate-500" *ngIf="profile() as user">Sessione attiva: {{ user.fullName }} • {{ user.role }}</p>
        </div>
        <div class="flex items-center gap-3">
          <p-tag [severity]="live.connected() ? 'success' : 'contrast'" [value]="live.connected() ? 'Realtime online' : 'Realtime offline'"></p-tag>
          <button pButton type="button" label="Aggiorna dashboard" icon="pi pi-refresh" severity="contrast" [outlined]="true"></button>
        </div>
      </header>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <p-card *ngFor="let metric of metrics()" styleClass="metric-tile border-0 shadow-none">
          <ng-template pTemplate="header">
            <div class="px-5 pt-5 text-sm text-slate-500">{{ metric.label }}</div>
          </ng-template>
          <div class="px-1 pb-1">
            <p class="text-4xl font-semibold">{{ metric.value }}</p>
            <p class="mt-3 text-sm text-slate-700">{{ metric.detail }}</p>
            <p-progressBar class="mt-4" [value]="metric.progress"></p-progressBar>
          </div>
        </p-card>
      </div>

      <div class="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <p-card styleClass="metric-tile border-0 shadow-none min-h-80">
          <ng-template pTemplate="title">Trend copertura turni</ng-template>
          <ng-template pTemplate="subtitle">KPI e andamento visivo mensile</ng-template>
          <div class="mt-6 grid h-56 grid-cols-12 items-end gap-2">
            <div class="rounded-t-xl bg-slate-900" style="height:48%"></div>
            <div class="rounded-t-xl bg-slate-900" style="height:65%"></div>
            <div class="rounded-t-xl bg-slate-900" style="height:54%"></div>
            <div class="rounded-t-xl bg-orange-600" style="height:78%"></div>
            <div class="rounded-t-xl bg-slate-900" style="height:82%"></div>
            <div class="rounded-t-xl bg-slate-900" style="height:69%"></div>
            <div class="rounded-t-xl bg-teal-700" style="height:88%"></div>
            <div class="rounded-t-xl bg-slate-900" style="height:72%"></div>
            <div class="rounded-t-xl bg-slate-900" style="height:67%"></div>
            <div class="rounded-t-xl bg-orange-600" style="height:85%"></div>
            <div class="rounded-t-xl bg-slate-900" style="height:90%"></div>
            <div class="rounded-t-xl bg-slate-900" style="height:76%"></div>
          </div>
        </p-card>

        <p-card styleClass="metric-tile border-0 shadow-none">
          <ng-template pTemplate="title">Notifiche recenti</ng-template>
          <div class="grid gap-3">
            <div class="rounded-2xl border border-slate-200 p-4" *ngFor="let notification of notifications()">
              <div class="flex items-center justify-between gap-3">
                <p class="font-medium">{{ notification.subject }}</p>
                <p-tag severity="info" value="in-app"></p-tag>
              </div>
              <p class="mt-2 text-sm text-slate-500">{{ notification.body }}</p>
            </div>
            <div class="rounded-2xl border border-dashed border-slate-300 p-4" *ngFor="let item of live.feed() | slice:0:2">
              <p class="font-medium">Evento realtime</p>
              <p class="mt-2 text-sm text-slate-500">{{ item.type }}</p>
            </div>
            <p class="text-sm text-slate-500" *ngIf="!notifications().length && !live.feed().length">Nessuna notifica disponibile.</p>
          </div>
        </p-card>
      </div>
    </section>
  `
})
export class DashboardPageComponent {
  private readonly session = inject(SessionService);
  private readonly api = inject(AppApiService);
  protected readonly live = inject(LiveNotificationsService);

  protected readonly profile = signal<any | null>(this.session.getCurrentUser());
  protected readonly notifications = signal<any[]>([]);

  protected readonly metrics = computed(() => {
    const role = this.profile()?.role;
    const notificationCount = this.notifications().length;
    if (role === Role.VOLUNTEER) {
      return [
        { label: 'Turni assegnati', value: '6', detail: '2 questa settimana', progress: 60 },
        { label: 'Conferme richieste', value: String(notificationCount), detail: 'azioni personali in coda', progress: 35 },
        { label: 'Documenti utili', value: '14', detail: 'briefing e checklist', progress: 74 },
        { label: 'Disponibilita', value: '92%', detail: 'profilo aggiornato', progress: 92 }
      ];
    }

    if (role === Role.SERVICE_LEADER) {
      return [
        { label: 'Eventi del servizio', value: '18', detail: '3 da confermare', progress: 66 },
        { label: 'Copertura ruoli', value: '89%', detail: '4 slot vacanti', progress: 89 },
        { label: 'Sostituzioni aperte', value: String(notificationCount), detail: 'richieste recenti', progress: 42 },
        { label: 'Volontari attivi', value: '27', detail: '4 onboarding incompleti', progress: 73 }
      ];
    }

    return [
      { label: 'Eventi attivi', value: '48', detail: '+12% sul mese', progress: 68 },
      { label: 'Copertura ruoli', value: '91%', detail: '6 slot scoperti', progress: 91 },
      { label: 'Sostituzioni aperte', value: String(notificationCount), detail: '3 urgenti', progress: 31 },
      { label: 'Inventario pronto', value: '84%', detail: '5 strumenti da revisionare', progress: 84 }
    ];
  });

  constructor() {
    this.live.connect();
    this.api.me().subscribe({ next: (profile) => this.profile.set(profile) });
    this.api.notifications().subscribe({ next: (notifications) => this.notifications.set(notifications) });
  }
}
