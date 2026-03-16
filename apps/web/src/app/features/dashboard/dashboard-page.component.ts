import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { NotificationItem, ReplacementItem, Role, UserProfile } from '@shift-complete/shared-types';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { AppApiService } from '../../shared/services/app-api.service';
import { ApiErrorService } from '../../core/services/api-error.service';
import { LiveNotificationsService } from '../../core/services/live-notifications.service';
import { SessionService } from '../../core/services/session.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';

const ROLES = {
  ADMINISTRATOR: 'administrator' as Role,
  SERVICE_LEADER: 'service_leader' as Role,
  VOLUNTEER: 'volunteer' as Role,
};

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, RouterLink, CardModule, TagModule, ButtonModule, ProgressBarModule],
  template: `
    <section class="max-w-7xl mx-auto flex flex-col gap-6">
      <header class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between py-2">
        <div>
          <h2 class="text-2xl font-semibold text-slate-800 tracking-tight">My dashboard</h2>
          <p class="mt-1 text-sm text-slate-500" *ngIf="profile() as user">Active session: {{ user.fullName }} • {{ user.role }}</p>
        </div>
        <div class="flex items-center gap-3">
          <p-tag [severity]="live.connected() ? 'success' : 'contrast'" [value]="live.connected() ? 'Realtime online' : 'Realtime offline'"></p-tag>
          <button class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition shadow-sm" (click)="loadData()">
            <i class="pi pi-refresh mr-1 text-xs"></i> Aggiorna
          </button>
        </div>
      </header>

      <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <button type="button" *ngFor="let metric of metrics()" class="bg-white rounded-lg border border-slate-200 shadow-sm p-4 hover:shadow-md transition duration-200 flex flex-col text-left" (click)="openMetric(metric.label)">
          <h3 class="text-sm font-semibold text-slate-700 font-medium flex items-center gap-2">
            <i class="pi pi-chart-pie text-[#4979e6]"></i> {{ metric.label }}
          </h3>
          <div class="mt-3 flex-1">
            <p class="text-3xl font-light tracking-tight text-slate-800">{{ metric.value }}</p>
            <p class="mt-1 text-xs text-slate-500">{{ metric.detail }}</p>
            <div class="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div class="h-full bg-[#4979e6] rounded-full" [style.width.%]="metric.progress"></div>
            </div>
          </div>
        </button>
      </div>

      <div class="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div class="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
             <h3 class="text-lg font-semibold text-slate-800 flex items-center gap-2">
               <i class="pi pi-calendar text-[#4979e6]"></i> Agenda
             </h3>
             <a routerLink="/events" class="pi pi-external-link text-slate-400 cursor-pointer hover:text-[#4979e6] transition text-sm"></a>
          </div>
          <div class="flex-1 overflow-y-auto p-0">
            <button type="button" class="group flex w-full flex-col gap-1 border-b border-slate-100 p-5 hover:bg-slate-50 transition last:border-0 text-left" *ngFor="let item of agenda()" (click)="openEvent(item.id)">
              <div class="flex items-start justify-between">
                <div>
                  <p class="font-medium text-slate-800 tracking-tight">{{ item.title }}</p>
                  <p class="text-sm text-slate-500 mt-1">{{ item.startsAt | date:'fullDate' }} alle {{ item.startsAt | date:'shortTime' }}</p>
                </div>
                 <span class="opacity-0 group-hover:opacity-100 text-[#4979e6] hover:bg-blue-50 px-2 py-1 rounded transition text-sm font-medium flex items-center gap-1 cursor-pointer">
                    Apri
                 </span>
              </div>
              <div class="mt-3 flex items-center gap-2">
                <p-tag [severity]="(item.assignments?.length || 0) > 0 ? 'success' : 'warn'" [value]="(item.assignments?.length || 0) > 0 ? 'Coperto' : 'Assenza'"></p-tag>
                <span class="text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full font-medium border border-slate-200">{{ item.type }}</span>
                <span class="text-xs text-slate-500 font-medium ml-auto">{{ item.slots?.length || 0 }} slots operativi</span>
              </div>
            </button>
            <div class="p-8 text-center text-sm text-slate-500" *ngIf="!agenda().length">
              Nessun evento in programma nei prossimi 7 giorni.
            </div>
          </div>
          <div class="border-t border-slate-100 bg-slate-50 px-5 py-3 flex justify-center">
             <a routerLink="/events" class="text-sm text-[#4979e6] font-medium hover:underline flex items-center gap-1"><i class="pi pi-calendar mr-1 text-xs"></i> Apri workspace eventi</a>
          </div>
        </div>

        <div class="flex flex-col gap-6">
          <div class="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
             <h3 class="text-lg font-semibold text-slate-800 flex items-center gap-2">
               <i class="pi pi-list text-[#4979e6]"></i> Segnali e backlog
             </h3>
               <a routerLink="/events" [queryParams]="{ status: 'open' }" class="pi pi-external-link text-slate-400 cursor-pointer hover:text-[#4979e6] transition text-sm"></a>
          </div>
          <div class="p-0">
            <div class="flex items-start justify-between gap-4 border-b border-slate-100 p-4 hover:bg-slate-50 hover:ring-1 hover:ring-blue-100 transition last:border-0 rounded-md focus-within:ring-1 focus-within:ring-blue-200" *ngFor="let assignment of openWorkItems()">
              <div class="flex items-center gap-3">
                <div class="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-600 border border-orange-200">
                  <i class="pi pi-exclamation-triangle text-xs"></i>
                </div>
                <div>
                  <p class="text-sm font-medium text-slate-800">Slot scoperto: {{ assignment.team || 'Team non assegnato' }}</p>
                  <p class="text-xs text-slate-500 mt-0.5">Ruolo richiesto: {{ assignment.roleName || 'Mansione generica' }}</p>
                </div>
              </div>
               <button type="button" class="text-xs font-medium text-[#4979e6] hover:underline cursor-pointer px-2 py-1" (click)="openAssignment(assignment)">Risolvi</button>
            </div>
            
            <div class="flex items-start justify-between gap-4 border-b border-slate-100 p-4 hover:bg-slate-50 hover:ring-1 hover:ring-blue-100 transition last:border-0 rounded-md focus-within:ring-1 focus-within:ring-blue-200" *ngFor="let notification of notifications()">
              <div class="flex items-center gap-3 w-full">
                <div class="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-[#4979e6] border border-blue-200 shrink-0">
                  <i class="pi pi-bell text-xs"></i>
                </div>
                  <button type="button" class="flex-1 text-left rounded-md px-1 py-1 focus:outline-none focus:ring-2 focus:ring-blue-200" (click)="openNotification(notification)">
                    <p class="text-sm font-medium text-slate-800">{{ notification.subject }}</p>
                    <p class="text-xs text-slate-500 mt-0.5">{{ notification.body }}</p>
                  </button>
                   <button class="text-slate-400 hover:text-slate-600 transition p-1" (click)="markNotificationRead(notification.id)"><i class="pi pi-times text-xs"></i></button>
                </div>
              </div>
            
            <div class="p-8 text-center text-sm text-slate-500" *ngIf="!notifications().length && !openWorkItems().length">
              <i class="pi pi-check-circle text-2xl text-emerald-400 mb-2"></i>
              <p>Nessuna notifica o azione richiesta nel backlog.</p>
            </div>
          </div>
          <div class="border-t border-slate-100 bg-slate-50 px-5 py-3 flex justify-center">
               <a routerLink="/teams" [queryParams]="{ tab: 'requests' }" class="text-sm text-[#4979e6] font-medium hover:underline flex items-center gap-1"><i class="pi pi-list mr-1 text-xs"></i> Gestisci le richieste attive</a>
          </div>
          </div>

          <div class="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
               <h3 class="text-lg font-semibold text-slate-800 flex items-center gap-2">
                 <i class="pi pi-arrow-right-arrow-left text-orange-500"></i> Replacement monitor
               </h3>
               <a routerLink="/replacements" class="pi pi-external-link text-slate-400 cursor-pointer hover:text-[#4979e6] transition text-sm"></a>
            </div>
            <div class="p-0">
              <button type="button" class="flex w-full items-start justify-between gap-4 border-b border-slate-100 p-4 hover:bg-slate-50 transition last:border-0 text-left" *ngFor="let replacement of replacementFeed()" (click)="openReplacement(replacement.id)">
                <div class="flex items-start gap-3">
                  <div class="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border border-orange-200 bg-orange-50 text-orange-600">
                    <i class="pi pi-refresh text-xs"></i>
                  </div>
                  <div>
                    <p class="text-sm font-medium text-slate-800">{{ replacement.assignment?.slot?.event?.title || 'Sostituzione' }}</p>
                    <p class="mt-0.5 text-xs text-slate-500">{{ replacement.requestedBy?.fullName || '-' }} → {{ replacement.replacementAssignee?.fullName || 'da assegnare' }}</p>
                  </div>
                </div>
                <p-tag [severity]="replacement.status === 'APPROVED' ? 'success' : (replacement.status === 'DECLINED' ? 'danger' : 'warn')" [value]="replacement.status"></p-tag>
              </button>
              <div class="p-8 text-center text-sm text-slate-500" *ngIf="!replacementFeed().length">Nessuna sostituzione recente.</div>
            </div>
          </div>
           
          <div class="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div class="flex items-center justify-between px-5 py-4">
               <h3 class="text-lg font-semibold text-slate-800 flex items-center gap-2">
                 <i class="pi pi-wave-pulse text-green-500"></i> Realtime feed
               </h3>
            </div>
            <div class="px-5 pb-5">
              <button type="button" class="flex w-full items-start gap-3 py-2 text-left rounded-md hover:bg-slate-50 transition" *ngFor="let item of live.feed() | slice:0:3" (click)="openLiveItem(item)">
                <div class="mt-1 h-2 w-2 rounded-full bg-green-500 shrink-0"></div>
                <div>
                  <p class="text-sm font-medium text-slate-700">{{ item.type }}</p>
                  <p class="text-xs text-slate-500">{{ item.payload?.notification?.subject || item.payload?.kind || 'Aggiornamento operativo' }}</p>
                </div>
              </button>
              <div class="py-2 text-sm text-slate-500" *ngIf="!live.feed().length">Feed silenzioso.</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `
})
export class DashboardPageComponent {
  private readonly session = inject(SessionService);
  private readonly api = inject(AppApiService);
  private readonly apiError = inject(ApiErrorService);
  private readonly feedback = inject(UiFeedbackService);
  private readonly router = inject(Router);
  protected readonly live = inject(LiveNotificationsService);

  protected readonly profile = signal<UserProfile | null>(this.session.getCurrentUser());
  protected readonly notifications = signal<NotificationItem[]>([]);
  protected readonly events = signal<any[]>([]);
  protected readonly inventory = signal<{ assets: number; checkedOut: number; maintenanceDue: number } | null>(null);
  protected readonly replacements = signal<ReplacementItem[]>([]);

  protected readonly metrics = computed(() => {
    const role = this.profile()?.role;
    const notificationCount = this.notifications().length;
    const events = this.events();
    const now = new Date();
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + 7);
    const upcomingEvents = events.filter((event) => {
      const startsAt = new Date(event.startsAt);
      return startsAt >= now && startsAt <= nextWeek;
    });
    const assignments = events.flatMap((event) => event.assignments ?? []);
    const openAssignments = assignments.filter((assignment) => assignment.status === 'open').length;
    const coveredAssignments = Math.max(assignments.length - openAssignments, 0);
    const coverage = assignments.length ? Math.round((coveredAssignments / assignments.length) * 100) : 100;
    const replacements = this.replacements();
    const pendingReplacements = replacements.filter((replacement) => replacement.status === 'PENDING').length;
    const recoveredCoverage = replacements.filter((replacement) => replacement.status === 'APPROVED' && replacement.replacementAssigneeId).length;
    const inventory = this.inventory();
    if (role === ROLES.VOLUNTEER) {
      const myAssignments = assignments.filter((assignment) => assignment.assignee === this.profile()?.fullName);
      return [
        { label: 'Turni assegnati', value: String(myAssignments.length), detail: `${upcomingEvents.length} eventi in agenda`, progress: Math.min(myAssignments.length * 18, 100) },
        { label: 'Conferme richieste', value: String(notificationCount), detail: 'azioni personali in coda', progress: 35 },
        { label: 'Documenti utili', value: String(notificationCount + 4), detail: 'briefing e checklist recenti', progress: 74 },
        { label: 'Disponibilita', value: this.profile()?.onboardingCompleted ? '100%' : '65%', detail: this.profile()?.onboardingCompleted ? 'profilo pronto' : 'onboarding da completare', progress: this.profile()?.onboardingCompleted ? 100 : 65 }
      ];
    }

    if (role === ROLES.SERVICE_LEADER) {
      return [
        { label: 'Eventi del servizio', value: String(upcomingEvents.length), detail: `${events.length} nel periodo caricato`, progress: Math.min(upcomingEvents.length * 12, 100) },
        { label: 'Copertura ruoli', value: `${coverage}%`, detail: `${openAssignments} slot vacanti`, progress: coverage },
        { label: 'Sostituzioni aperte', value: String(pendingReplacements), detail: `${recoveredCoverage} coperture recuperate`, progress: Math.min(pendingReplacements * 20, 100) },
        { label: 'Volontari attivi', value: String(new Set(assignments.map((assignment) => assignment.assignee).filter(Boolean)).size), detail: 'copertura team attiva', progress: 73 }
      ];
    }

    return [
      { label: 'Eventi attivi', value: String(events.length), detail: `${upcomingEvents.length} nei prossimi 7 giorni`, progress: Math.min(events.length * 8, 100) },
      { label: 'Copertura ruoli', value: `${coverage}%`, detail: `${openAssignments} slot scoperti`, progress: coverage },
      { label: 'Sostituzioni aperte', value: String(pendingReplacements), detail: `${recoveredCoverage} coperture recuperate`, progress: Math.min((pendingReplacements + recoveredCoverage) * 12, 100) },
      { label: 'Inventario pronto', value: `${inventory ? Math.max(0, 100 - inventory.maintenanceDue * 10) : 84}%`, detail: `${inventory?.maintenanceDue ?? 0} strumenti da revisionare`, progress: inventory ? Math.max(0, 100 - inventory.maintenanceDue * 10) : 84 }
    ];
  });

  protected readonly replacementFeed = computed(() => this.replacements().slice(0, 5));

  protected readonly agenda = computed(() =>
    this.events()
      .slice()
      .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime())
      .slice(0, 6)
  );

  protected readonly openWorkItems = computed(() => {
    const items = this.events().flatMap((event) => event.assignments ?? []);
    return items.filter((assignment) => assignment.status === 'open').slice(0, 6);
  });

  constructor() {
    this.live.connect();
    this.loadData();
  }

  loadData(): void {
    this.api.me().subscribe({ next: (profile) => this.profile.set(profile) });
    this.api.notifications().subscribe({ next: (notifications) => this.notifications.set(notifications) });
    this.api.events().subscribe({ next: (events) => this.events.set(events) });
    this.api.inventorySummary().subscribe({ next: (summary) => this.inventory.set(summary) });
    this.api.replacements().subscribe({ next: (replacements) => this.replacements.set(replacements) });
  }

  markNotificationRead(notificationId: string): void {
    this.api.markNotificationRead(notificationId).subscribe({
      next: () => {
        this.notifications.update((items) => items.filter((item) => item.id !== notificationId));
        this.feedback.success('Notifica archiviata');
      },
      error: (error) => this.feedback.error('Operazione non riuscita', this.apiError.message(error, 'Impossibile aggiornare la notifica.'))
    });
  }

  openEvent(eventId: string): void {
    void this.router.navigate(['/events'], { queryParams: { eventId } });
  }

  openAssignment(assignment: { eventId?: string; team?: string; roleName?: string }): void {
    void this.router.navigate(['/events'], {
      queryParams: {
        eventId: assignment.eventId || undefined,
        team: assignment.team || undefined,
        role: assignment.roleName || undefined,
      },
    });
  }

  openMetric(label: string): void {
    const key = label.toLowerCase();
    if (key.includes('sostituz')) {
      void this.router.navigate(['/replacements']);
      return;
    }
    if (key.includes('copertura') || key.includes('eventi') || key.includes('turni')) {
      void this.router.navigate(['/events']);
      return;
    }
    if (key.includes('inventario')) {
      void this.router.navigate(['/inventory']);
      return;
    }
    if (key.includes('volontari')) {
      void this.router.navigate(['/teams']);
      return;
    }
    void this.router.navigate(['/dashboard']);
  }

  openReplacement(replacementId: string): void {
    void this.router.navigate(['/replacements'], { queryParams: { replacementId } });
  }

  openLiveItem(item: { type: string; payload: any }): void {
    const notificationLink = item.payload?.notification?.link;
    if (notificationLink) {
      void this.router.navigateByUrl(notificationLink);
      return;
    }

    const kind = String(item.payload?.kind || item.type || '').toLowerCase();
    if (kind.includes('notification.created')) {
      this.openNotification(item.payload?.notification);
      return;
    }

    void this.router.navigate(['/events']);
  }

  openNotification(notification: NotificationItem): void {
    if (notification.link) {
      void this.router.navigateByUrl(notification.link);
      return;
    }

    const text = `${notification.subject} ${notification.body}`.toLowerCase();
    if (text.includes('sostituz')) {
      void this.router.navigate(['/replacements']);
      return;
    }

    if (text.includes('team') || text.includes('iscrizion') || text.includes('inserimento')) {
      void this.router.navigate(['/teams'], { queryParams: { tab: 'requests' } });
      return;
    }

    void this.router.navigate(['/events']);
  }
}
