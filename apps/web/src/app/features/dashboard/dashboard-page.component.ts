import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { NotificationItem, ReplacementItem, Role, UserProfile } from '@shift-complete/shared-types';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { GlobalTeamScopeService } from '../../core/services/global-team-scope.service';
import { AppApiService } from '../../shared/services/app-api.service';
import { ApiErrorService } from '../../core/services/api-error.service';
import { LiveNotificationsService } from '../../core/services/live-notifications.service';
import { SessionService } from '../../core/services/session.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { TeamScopeChipsComponent } from '../../shared/components/team-scope-chips.component';

const ROLES = {
  ADMINISTRATOR: 'administrator' as Role,
  SERVICE_LEADER: 'service_leader' as Role,
  VOLUNTEER: 'volunteer' as Role,
};

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, RouterLink, CardModule, TagModule, ButtonModule, ProgressBarModule, TeamScopeChipsComponent],
  templateUrl: './dashboard-page.component.html',
})
export class DashboardPageComponent {
  private readonly session = inject(SessionService);
  private readonly api = inject(AppApiService);
  private readonly apiError = inject(ApiErrorService);
  private readonly feedback = inject(UiFeedbackService);
  private readonly router = inject(Router);
  protected readonly live = inject(LiveNotificationsService);
  protected readonly teamScope = inject(GlobalTeamScopeService);
  protected readonly teams = signal<Array<{ id: string; name: string }>>([]);

  protected readonly profile = signal<UserProfile | null>(this.session.getCurrentUser());
  protected readonly notifications = signal<NotificationItem[]>([]);
  private readonly rawEvents = signal<any[]>([]);
  protected readonly events = computed(() => {
    const scopedTeamId = this.teamScope.teamId();
    if (!scopedTeamId) {
      return this.rawEvents();
    }
    return this.rawEvents().filter((event) => (event.slots ?? []).some((slot: any) => slot.teamId === scopedTeamId));
  });
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
  protected readonly teamInsights = computed(() => {
    const teamMap = new Map<string, { name: string; open: number; assigned: number }>();

    for (const event of this.events()) {
      for (const assignment of event.assignments ?? []) {
        const key = assignment.team || 'Senza team';
        if (!teamMap.has(key)) {
          teamMap.set(key, { name: key, open: 0, assigned: 0 });
        }

        const bucket = teamMap.get(key)!;
        if (assignment.status === 'open') {
          bucket.open += 1;
        } else {
          bucket.assigned += 1;
        }
      }
    }

    return Array.from(teamMap.values())
      .sort((left, right) => right.open - left.open || right.assigned - left.assigned)
      .slice(0, 5);
  });

  protected readonly userInsights = computed(() => {
    const userMap = new Map<string, { name: string; assignments: number }>();

    for (const event of this.events()) {
      for (const assignment of event.assignments ?? []) {
        if (!assignment.assignee) {
          continue;
        }

        if (!userMap.has(assignment.assignee)) {
          userMap.set(assignment.assignee, { name: assignment.assignee, assignments: 0 });
        }

        userMap.get(assignment.assignee)!.assignments += 1;
      }
    }

    return Array.from(userMap.values())
      .sort((left, right) => right.assignments - left.assignments)
      .slice(0, 5);
  });

  protected readonly requestSummary = computed(() => {
    const notifications = this.notifications();
    return {
      pendingReplacements: this.replacements().filter((replacement) => replacement.status === 'PENDING').length,
      teamRequests: notifications.filter((notification) => `${notification.subject} ${notification.body}`.toLowerCase().includes('team')).length,
      unreadNotifications: notifications.length,
    };
  });

  protected readonly inventoryHighlights = computed(() => {
    const inventory = this.inventory();
    if (!inventory) {
      return [] as Array<{ label: string; value: string; tone: 'success' | 'warn' | 'danger' | 'info' }>;
    }

    return [
      { label: 'Asset totali', value: String(inventory.assets), tone: 'info' as const },
      { label: 'In prestito', value: String(inventory.checkedOut), tone: 'warn' as const },
      { label: 'In manutenzione', value: String(inventory.maintenanceDue), tone: inventory.maintenanceDue ? 'danger' as const : 'success' as const },
    ];
  });

  protected readonly eventTypeBreakdown = computed(() => {
    const single = this.events().filter((event) => event.type === 'single').length;
    const recurring = this.events().filter((event) => event.type === 'recurring').length;
    return [
      { label: 'Singoli', value: single, width: this.events().length ? Math.round((single / this.events().length) * 100) : 0, tone: 'bg-[#4979e6]' },
      { label: 'Ricorrenti', value: recurring, width: this.events().length ? Math.round((recurring / this.events().length) * 100) : 0, tone: 'bg-emerald-500' },
    ];
  });

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

  protected readonly liveFeedPreview = computed(() =>
    this.live.feed().slice(0, 3).map((item) => ({
      ...item,
      translatedType: this.translateLiveItemType(item.type),
      translatedSubject: this.translateLiveItemSubject(item.payload?.notification?.subject || item.payload?.kind || 'Aggiornamento operativo')
    }))
  );

  constructor() {
    this.live.connect();
    this.loadData();
    if (this.session.hasAnyRole('administrator', 'service_leader')) {
      this.api.teams().subscribe({ next: (teams) => this.teams.set(teams.map((team) => ({ id: team.id, name: team.name }))) });
    }
  }

  loadData(): void {
    this.api.me().subscribe({ next: (profile) => this.profile.set(profile) });
    this.api.notifications().subscribe({ next: (notifications) => this.notifications.set(notifications) });
    this.api.events().subscribe({ next: (events) => this.rawEvents.set(events) });
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

  protected roleLabel(role: Role | undefined): string {
    if (role === ROLES.ADMINISTRATOR) {
      return 'Amministratore';
    }
    if (role === ROLES.SERVICE_LEADER) {
      return 'Responsabile di servizio';
    }
    if (role === ROLES.VOLUNTEER) {
      return 'Volontario';
    }
    return role ?? 'Utente';
  }

  protected eventTypeLabel(type: string | undefined): string {
    if (type === 'single') {
      return 'Singolo';
    }
    if (type === 'recurring') {
      return 'Ricorrente';
    }
    return type ?? 'Evento';
  }

  protected replacementStatusLabel(status: string | undefined): string {
    if (status === 'PENDING') {
      return 'In attesa';
    }
    if (status === 'APPROVED') {
      return 'Approvata';
    }
    if (status === 'DECLINED') {
      return 'Rifiutata';
    }
    return status ?? 'Aggiornata';
  }

  private translateLiveItemType(type: string | undefined): string {
    const normalized = String(type ?? '').toLowerCase();
    if (normalized.includes('notification.created')) {
      return 'Nuova notifica';
    }
    if (normalized.includes('notification.delivery.updated')) {
      return 'Consegna notifica aggiornata';
    }
    if (normalized.includes('resource.transfer.updated')) {
      return 'Trasferimento risorsa aggiornato';
    }
    if (normalized.includes('ai.job.updated')) {
      return 'Job AI aggiornato';
    }
    if (normalized.includes('scheduling.updated')) {
      return 'Pianificazione aggiornata';
    }
    return 'Aggiornamento in tempo reale';
  }

  private translateLiveItemSubject(subject: string): string {
    const normalized = subject.trim().toLowerCase();
    if (normalized === 'team') {
      return 'Team';
    }
    return subject;
  }
}
