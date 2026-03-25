import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { AvailabilityItem, CreateAvailabilityDto, ReplacementItem, ScheduleApplyScope, SchedulePlanListItem, SchedulePlanResponse, SchedulePreviewRequest, ScheduleSuggestionItem } from '@shift-complete/shared-types';
import { map, of, switchMap, tap } from 'rxjs';
import { ApiErrorService } from '../../core/services/api-error.service';
import { GlobalTeamScopeService } from '../../core/services/global-team-scope.service';
import { SchedulingPreviewDeliveryService } from '../../core/services/scheduling-preview-delivery.service';
import { SessionService } from '../../core/services/session.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { fromIsoDateTime, toIsoDateTime } from '../../core/utils/date-picker.util';
import { AppApiService, DutyListItem } from '../../shared/services/app-api.service';
import { LiveNotificationsService } from '../../core/services/live-notifications.service';
import { TeamScopeChipsComponent } from '../../shared/components/team-scope-chips.component';
import {
  UiBadgeComponent,
  UiBoardColumnComponent,
  UiBoardTileComponent,
  UiButtonComponent,
  UiChipComponent,
  UiConfirmDialogComponent,
  UiDatePickerComponent,
  UiFieldComponent,
  UiFilterBarComponent,
  UiInputComponent,
  UiLabelComponent,
  UiModalComponent,
  UiPageHeaderComponent,
  UiReplacementTimelineCardComponent,
  UiSelectComponent,
  UiSegmentedControlComponent,
  UiSidebarPanelComponent,
  UiSurfaceComponent,
  UiTableShellComponent,
} from '@shift-complete/ui-kit';

type CalendarEvent = {
  id: string;
  seriesId?: string;
  title: string;
  description?: string | null;
  locationValue?: string | null;
  color?: string | null;
  icon?: string | null;
  startsAt: string;
  endsAt: string;
  type: string;
  recurrenceRule?: string | null;
  recurrenceTz?: string | null;
  recurrenceUntil?: string | null;
  recurrenceDurationMonths?: number | null;
  recurrenceAutoRenew?: boolean | null;
  recurrenceRenewMonths?: number | null;
  occurrenceStart?: string;
  isOccurrence?: boolean;
  isVirtualOccurrence?: boolean;
  slots?: Array<{
    id: string;
    dutyId?: string;
    roleName?: string;
    teamId: string;
    teamName?: string;
    assignments?: Array<{ id: string; assigneeId?: string | null; status: string; replacementApproved?: boolean; assignee?: { id?: string; fullName?: string | null } | null }>;
  }>;
  assignments?: Array<{ id: string; eventId: string; slotId: string; roleName?: string; team?: string; assignee?: string | null; status: string }>;
};

type RecurrenceDurationOption = 3 | 6 | 12 | 24;

type AssignmentRecord = NonNullable<NonNullable<CalendarEvent['slots']>[number]['assignments']>[number];

type PendingConfirmAction = {
  title: string;
  message: string;
  detail?: string;
  tone: 'confirm' | 'danger';
  confirmLabel: string;
  icon?: string;
  run: () => void;
};

type TeamOption = {
  id: string;
  name: string;
  description?: string | null;
  members?: Array<{
    id: string;
    fullName: string;
    email: string;
    role: string;
  }>;
  duties?: Array<{
    id: string;
    name: string;
    color?: string | null;
    icon?: string | null;
  }>; 
};

type ScheduleApplyOption = { label: string; value: ScheduleApplyScope };

type AvailabilityForm = {
  userId: string | null;
  teamId: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  reason: string;
};

@Component({
  selector: 'app-calendar-view-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    UiBadgeComponent,
    UiBoardColumnComponent,
    UiBoardTileComponent,
    UiButtonComponent,
    UiChipComponent,
    UiConfirmDialogComponent,
    UiDatePickerComponent,
    UiFieldComponent,
    UiFilterBarComponent,
    UiInputComponent,
    UiSidebarPanelComponent,
    UiModalComponent,
    UiPageHeaderComponent,
    UiReplacementTimelineCardComponent,
    UiSelectComponent,
    UiSegmentedControlComponent,
    UiSurfaceComponent,
    UiTableShellComponent,
    UiLabelComponent,
    TeamScopeChipsComponent,
    RouterLink,
  ],
  templateUrl: './calendar-view-page.component.html',
})
export class CalendarViewPageComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(AppApiService);
  private readonly apiError = inject(ApiErrorService);
  protected readonly live = inject(LiveNotificationsService);
  private readonly schedulingDelivery = inject(SchedulingPreviewDeliveryService);
  private readonly feedback = inject(UiFeedbackService);
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(SessionService);
  protected readonly teamScope = inject(GlobalTeamScopeService);

  protected readonly events = signal<CalendarEvent[]>([]);
  protected readonly teams = signal<TeamOption[]>([]);
  protected readonly replacements = signal<ReplacementItem[]>([]);
  protected readonly previewSuggestions = signal<ScheduleSuggestionItem[]>([]);
  protected readonly planningSummary = signal<SchedulePlanResponse['summary'] | null>(null);
  protected readonly planningHistory = signal<SchedulePlanListItem[]>([]);
  protected readonly operationalAvailability = signal<AvailabilityItem[]>([]);
  protected readonly duties = signal<DutyListItem[]>([]);
  protected readonly preferenceCatalog = signal<Array<{ id: string; type: 'shift' | 'competency' | 'location'; value: string; label: string }>>([]);
  protected readonly selectedEvent = signal<CalendarEvent | null>(null);
  protected readonly selectedUserFilter = signal<string>('');
  protected readonly occurrenceView = signal<'all' | 'series' | 'occurrences'>('all');
  protected readonly selectedSeriesFilter = signal<string>('');
  protected readonly eventTypeFilter = signal<'all' | 'event' | 'meeting'>('all');
  protected readonly eventLocationFilter = signal<string>('all');
  protected readonly loading = signal(false);
  protected readonly savingEvent = signal(false);
  protected readonly scheduling = signal(false);
  protected readonly savingAvailability = signal(false);
  protected readonly selectedDutyOption = signal<Record<string, unknown> | null>(null);
  protected readonly locallyReservedSuggestionIds = signal<string[]>([]);
  protected readonly confirmVisible = signal(false);
  protected readonly pendingConfirm = signal<PendingConfirmAction | null>(null);
  protected readonly currentView = signal('month');
  protected readonly calendarCursor = signal(this.startOfDay(new Date()));
  protected readonly selectedApplyScope = signal<ScheduleApplyScope>('event');
  protected readonly selectedManualAssignments = signal<Record<string, string>>({});
  protected readonly currentPlanId = signal<string | null>(null);
  protected readonly pendingPlanningJobId = signal<string | null>(null);
  protected readonly planningHistoryFilter = signal<'all' | 'preview' | 'applied' | 'invalidated'>('all');
  protected previewVisible = false;
  protected assignmentBoardVisible = false;
  protected eventDialogVisible = false;
  protected availabilityDialogVisible = false;
  protected eventForm = { title: '', locationValue: '' as string, startsAt: null as Date | null, endsAt: null as Date | null, teamId: null as string | null, dutyId: '', isRecurring: false, recurrenceFrequency: 'WEEKLY' as 'WEEKLY' | 'MONTHLY' | 'YEARLY', recurrenceDurationMonths: 12 as RecurrenceDurationOption, recurrenceAutoRenew: true, recurrenceRenewMonths: 12 as RecurrenceDurationOption };
  protected replacementReason = '';
  protected availabilityForm: AvailabilityForm = { userId: null, teamId: null, startsAt: null, endsAt: null, reason: '' };
  protected readonly replacementAssigneeId = signal<string | null>(null);
  protected readonly draggedVolunteerId = signal<string | null>(null);
  protected readonly dragHoverSlotId = signal<string | null>(null);
  protected readonly viewOptions = [
    { label: 'Mese', value: 'month' },
    { label: 'Settimana', value: 'week' },
    { label: 'Agenda', value: 'agenda' },
  ];
  protected readonly weekdayLabels = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
  protected readonly occurrenceViewOptions = [
    { label: 'Tutto', value: 'all' },
    { label: 'Serie', value: 'series' },
    { label: 'Occorrenze', value: 'occurrences' },
  ];
  protected readonly recurrenceOptions = [
    { label: 'Settimanale', value: 'WEEKLY' },
    { label: 'Mensile', value: 'MONTHLY' },
    { label: 'Annuale', value: 'YEARLY' },
  ];
  protected readonly recurrenceDurationOptions = [
    { label: '3 mesi', value: 3 },
    { label: '6 mesi', value: 6 },
    { label: '1 anno', value: 12 },
    { label: '2 anni', value: 24 },
  ];
  protected readonly applyScopeOptions: ScheduleApplyOption[] = [
    { label: 'Evento', value: 'event' },
    { label: 'Mese', value: 'month' },
    { label: 'Ciclo', value: 'cycle' },
    { label: 'Anno', value: 'year' },
    { label: 'Tutto', value: 'all' },
  ];

  protected readonly teamOptions = computed(() => this.teams().map((team) => ({ label: team.name, value: team.id })));
  protected readonly dutyOptions = computed(() =>
    this.duties().map((duty) => ({
      label: duty.name,
      value: duty.id,
      teamId: duty.teamId,
      icon: duty.icon,
      color: duty.color,
    }))
  );
  protected readonly selectableUsers = computed(() =>
    [
      { label: 'Tutti gli utenti', value: '' },
      ...Array.from(
        new Map(
          this.teams()
            .flatMap((team) => team.members ?? [])
            .map((member) => [member.id, { label: member.fullName, value: member.id }])
        ).values()
      )
    ]
  );
  protected readonly seriesOptions = computed(() =>
    Array.from(
      new Map(
        this.events()
          .filter((event) => event.type === 'recurring' && !event.isOccurrence)
          .map((event) => [event.seriesId ?? event.id, { label: event.title, value: event.seriesId ?? event.id }])
      ).values()
    ).sort((left, right) => left.label.localeCompare(right.label, 'it'))
  );
  protected readonly locationOptions = computed(() => this.preferenceCatalog().filter((item) => item.type === 'location').map((item) => ({ label: item.label, value: item.value })));
  protected readonly eventTypeFilterOptions = [
    { label: 'Tutti (Eventi e Riunioni)', value: 'all' },
    { label: 'Eventi', value: 'event' },
    { label: 'Riunioni', value: 'meeting' },
  ];
  protected readonly eventLocationFilterOptions = computed(() => [
    { label: 'Tutti i luoghi', value: 'all' },
    { label: 'Senza luogo specificato', value: 'none' },
    ...this.locationOptions()
  ]);
  protected readonly assignablePeople = computed(() =>
    Array.from(
      new Map(
        this.teams()
          .flatMap((team) => team.members ?? [])
          .map((member) => [member.id, { label: member.fullName, value: member.id }])
      ).values()
    )
  );
  protected readonly filteredPlanningHistory = computed(() => {
    const filter = this.planningHistoryFilter();
    return this.planningHistory().filter((plan) => {
      if (filter === 'invalidated') {
        return Boolean(plan.invalidatedAt);
      }
      if (filter === 'applied') {
        return Boolean(plan.applyScope) && !plan.invalidatedAt;
      }
      if (filter === 'preview') {
        return !plan.applyScope && !plan.invalidatedAt;
      }
      return true;
    });
  });
  protected readonly filteredEvents = computed(() => {
    const userId = this.selectedUserFilter();
    const seriesId = this.selectedSeriesFilter();

    return this.events().filter((event) => {
      const scopedTeamId = this.teamScope.teamId();
      const teamMatch = !scopedTeamId || (event.slots ?? []).some((slot) => slot.teamId === scopedTeamId);
      const userMatch = !userId || this.eventAssigneeIds(event).includes(userId);
      const seriesMatch = !seriesId || (event.seriesId ?? event.id) === seriesId;
      const occurrenceMatch = this.occurrenceView() === 'all'
        ? true
        : this.occurrenceView() === 'series'
          ? !event.isOccurrence
          : Boolean(event.isOccurrence);

      const typeFilter = this.eventTypeFilter();
      const typeMatch = typeFilter === 'all'
        ? true
        : typeFilter === 'meeting'
          ? event.type === 'MEETING'
          : event.type !== 'MEETING';

      const locationFilter = this.eventLocationFilter();
      const locationMatch = locationFilter === 'all'
        ? true
        : locationFilter === 'none'
          ? !event.locationValue
          : event.locationValue === locationFilter;

      return teamMatch && userMatch && seriesMatch && occurrenceMatch && typeMatch && locationMatch;
    });
  });
  protected readonly eventsByDate = computed(() => {
    const grouped: Record<string, CalendarEvent[]> = {};
    for (const event of this.filteredEvents()) {
      const key = this.dateKey(new Date(event.startsAt));
      grouped[key] ??= [];
      grouped[key].push(event);
    }
    return grouped;
  });
  protected readonly monthTitle = computed(() =>
    this.formatMonthYear(this.calendarCursor())
  );
  protected readonly monthRangeLabel = computed(() => {
    const cursor = this.calendarCursor();
    return `Distribuzione eventi e copertura di ${this.formatMonthYear(cursor)} · ${this.visibleMonthEventCount()} eventi visibili`;
  });
  protected readonly weekTitle = computed(() => {
    const weekStart = this.startOfWeek(this.calendarCursor());
    const weekEnd = this.addDays(weekStart, 6);
    return `${weekStart.getDate()} ${this.formatMonthShort(weekStart)} - ${weekEnd.getDate()} ${this.formatMonthShort(weekEnd)}`;
  });
  protected readonly weekRangeLabel = computed(() => `Panoramica operativa dei 7 giorni correnti · ${this.visibleWeekEventCount()} eventi visibili`);
  protected readonly monthCells = computed(() => {
    const monthStart = this.startOfMonth(this.calendarCursor());
    const gridStart = this.startOfWeek(monthStart);
    return Array.from({ length: 42 }, (_, index) => {
      const date = this.addDays(gridStart, index);
      const key = this.dateKey(date);
      return {
        date,
        dayNumber: date.getDate(),
        inCurrentMonth: date.getMonth() === monthStart.getMonth(),
        isToday: this.isSameDate(date, new Date()),
        events: this.eventsByDate()[key] ?? [],
      };
    });
  });
  protected readonly weekDays = computed(() => {
    const weekStart = this.startOfWeek(this.calendarCursor());
    return Array.from({ length: 7 }, (_, index) => {
      const date = this.addDays(weekStart, index);
      return {
        date,
        dayNumber: date.getDate(),
        monthLabel: this.formatMonthShort(date),
        events: this.eventsByDate()[this.dateKey(date)] ?? [],
      };
    });
  });
  protected readonly selectedEventSlots = computed(() => this.selectedEvent()?.slots ?? []);
  protected reasonTone(reason: string): 'success' | 'warn' | 'neutral' {
    return reason.includes(':+') ? 'success' : reason.includes(':-') ? 'warn' : 'neutral';
  }

  protected planningCoverageTone(status: ScheduleSuggestionItem['coverageStatus']): 'success' | 'warn' | 'info' | 'neutral' {
    if (status === 'covered') {
      return 'success';
    }
    if (status === 'manual' || status === 'suggested') {
      return 'info';
    }
    return 'warn';
  }

  protected planningCoverageLabel(status: ScheduleSuggestionItem['coverageStatus']): string {
    if (status === 'covered') {
      return 'Coperto';
    }
    if (status === 'manual') {
      return 'Scelta manuale';
    }
    if (status === 'suggested') {
      return 'Proposto';
    }
    return 'Scoperto';
  }

  protected selectedPlanningAssignee(slotId: string): string {
    return this.selectedManualAssignments()[slotId] ?? '';
  }

  protected planningCandidateOptions(item: ScheduleSuggestionItem): Array<{ label: string; value: string }> {
    return (item.candidates ?? []).map((candidate) => ({ label: candidate.fullName, value: candidate.id }));
  }

  protected loadPlan(planId: string): void {
    this.scheduling.set(true);
    this.api.schedulingPlan(planId).subscribe({
      next: (result) => {
        this.currentPlanId.set(result.planId ?? planId);
        this.previewSuggestions.set(result.suggestions ?? []);
        this.planningSummary.set(result.summary ?? null);
        this.previewVisible = true;
        this.scheduling.set(false);
        this.loadPlanningHistory(result.anchorEventId || undefined);
        this.feedback.success('Piano caricato');
      },
      error: (error) => {
        this.scheduling.set(false);
        this.feedback.error('Piano non disponibile', this.apiError.message(error, 'Impossibile caricare il piano selezionato.'));
      }
    });
  }

  protected cycleSummaryLabel(item: ScheduleSuggestionItem): string {
    return `Ciclo ${item.cycleNumber} · passo ${item.cycleIndex}/${item.cycleLength}`;
  }

  protected planDriftTone(item: ScheduleSuggestionItem): 'success' | 'warn' | 'info' {
    if (item.drift?.status === 'changed') {
      return 'warn';
    }
    if (item.drift?.status === 'missing') {
      return 'info';
    }
    return 'success';
  }

  protected planDriftLabel(item: ScheduleSuggestionItem): string {
    if (item.drift?.status === 'changed') {
      return `Reale: ${item.drift.currentAssigneeName || 'assegnazione diversa'}`;
    }
    if (item.drift?.status === 'missing') {
      return 'Non ancora applicato nel reale';
    }
    return 'Allineato al reale';
  }

  protected updateApplyScope(value: unknown): void {
    const normalized = this.castNullable(value);
    if (normalized === 'month' || normalized === 'cycle' || normalized === 'year' || normalized === 'all') {
      this.selectedApplyScope.set(normalized);
      return;
    }

    this.selectedApplyScope.set('event');
  }

  protected updatePlanningHistoryFilter(value: unknown): void {
    const normalized = this.castNullable(value);
    if (normalized === 'preview' || normalized === 'applied' || normalized === 'invalidated') {
      this.planningHistoryFilter.set(normalized);
      return;
    }

    this.planningHistoryFilter.set('all');
  }

  protected updatePlanningSelection(slotId: string, value: unknown): void {
    const assigneeId = this.castNullable(value);
    this.selectedManualAssignments.update((current) => {
      const next = { ...current };
      if (assigneeId) {
        next[slotId] = assigneeId;
      } else {
        delete next[slotId];
      }
      return next;
    });
  }

  protected readonly sortedEvents = computed(() =>
    [...this.filteredEvents()].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
  );

  protected membersForTeam(teamId: string): Array<{ id: string; fullName: string; email: string; role: string }> {
    return this.teams().find((team) => team.id === teamId)?.members ?? [];
  }

  protected isTargetSlot(slot: { teamName?: string; roleName?: string }): boolean {
    const params = this.route.snapshot.queryParamMap;
    const teamName = params.get('team');
    const roleName = params.get('role');
    return Boolean((!teamName || slot.teamName === teamName) && (!roleName || slot.roleName === roleName) && (teamName || roleName));
  }

  protected memberOptionsForTeam(teamId: string): Array<{ label: string; value: string }> {
    return this.membersForTeam(teamId).map((member) => ({ label: member.fullName, value: member.id }));
  }

  protected castNullable(value: unknown): string | null {
    return value ? String(value) : null;
  }

  protected castString(value: unknown): string {
    return value == null ? '' : String(value);
  }

  protected setEventTypeFilter(value: unknown): void {
    const normalized = this.castString(value);
    if (normalized === 'event' || normalized === 'meeting' || normalized === 'all') {
      this.eventTypeFilter.set(normalized);
    }
  }

  protected setOccurrenceView(value: unknown): void {
    const normalized = this.castNullable(value);
    if (normalized === 'series' || normalized === 'occurrences') {
      this.occurrenceView.set(normalized);
      return;
    }
    this.occurrenceView.set('all');
  }

  protected resetFilters(): void {
    this.selectedUserFilter.set('');
    this.selectedSeriesFilter.set('');
    this.occurrenceView.set('all');
    this.eventTypeFilter.set('all');
    this.eventLocationFilter.set('all');
  }

  protected navigateCalendar(direction: -1 | 1): void {
    if (this.currentView() === 'month') {
      this.calendarCursor.update((current) => this.addMonths(current, direction));
      return;
    }

    if (this.currentView() === 'week') {
      this.calendarCursor.update((current) => this.addDays(current, direction * 7));
    }
  }

  protected jumpCalendarToToday(): void {
    this.calendarCursor.set(this.startOfDay(new Date()));
  }

  private dateKey(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private startOfWeek(date: Date): Date {
    const normalized = this.startOfDay(date);
    const day = normalized.getDay() || 7;
    normalized.setDate(normalized.getDate() - day + 1);
    return normalized;
  }

  private addDays(date: Date, amount: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + amount);
    return next;
  }

  private addMonths(date: Date, amount: number): Date {
    const next = new Date(date);
    next.setMonth(next.getMonth() + amount, 1);
    return next;
  }

  private isSameDate(left: Date, right: Date): boolean {
    return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
  }

  private formatMonthYear(date: Date): string {
    return new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(date);
  }

  private formatMonthShort(date: Date): string {
    return new Intl.DateTimeFormat('it-IT', { month: 'short' }).format(date).replace('.', '');
  }

  private eventsInCurrentMonth(): CalendarEvent[] {
    const cursor = this.calendarCursor();
    return this.filteredEvents().filter((event) => {
      const date = new Date(event.startsAt);
      return date.getMonth() === cursor.getMonth() && date.getFullYear() === cursor.getFullYear();
    });
  }

  private eventsInCurrentWeek(): CalendarEvent[] {
    const start = this.startOfWeek(this.calendarCursor());
    const end = this.addDays(start, 7);
    return this.filteredEvents().filter((event) => {
      const date = new Date(event.startsAt);
      return date >= start && date < end;
    });
  }

  protected readonly visibleMonthEventCount = computed(() => this.eventsInCurrentMonth().length);
  protected readonly visibleWeekEventCount = computed(() => this.eventsInCurrentWeek().length);

  constructor() {
    this.destroyRef.onDestroy(() => this.schedulingDelivery.stopTracking(this.pendingPlanningJobId()));
    this.live.connect();
    this.api.userPreferenceCatalog().subscribe({ next: (items) => this.preferenceCatalog.set(items) });
    this.loadData();
    effect(() => {
      const item = this.live.feed()[0];
      if (!item) {
        return;
      }

      if (['events.changed', 'assignments.changed', 'replacements.changed', 'availability.changed', 'stats.changed', 'planner.invalidated'].includes(item.type)) {
        this.loadData();
      }
    });
    this.route.queryParamMap.subscribe(() => {
      this.applyRouteContext(this.events());
    });
  }

  isEventFormValid(): boolean {
    return Boolean(this.eventForm.title.trim() && this.eventForm.startsAt && this.eventForm.endsAt && this.eventForm.teamId && this.eventForm.dutyId.trim() && this.eventForm.startsAt < this.eventForm.endsAt);
  }

  openEventDialog(): void {
    const now = new Date();
    const end = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const firstTeam = this.teams()[0]?.id ?? null;
    this.eventForm = {
      title: '',
      locationValue: '',
      startsAt: now,
      endsAt: end,
      teamId: firstTeam,
      dutyId: '',
      isRecurring: false,
      recurrenceFrequency: 'WEEKLY',
      recurrenceDurationMonths: 12,
      recurrenceAutoRenew: true,
      recurrenceRenewMonths: 12,
    };
    this.selectedDutyOption.set(null);
    if (firstTeam) {
      this.loadDuties(firstTeam);
    }
    this.eventDialogVisible = true;
  }

  onTeamChange(teamId: unknown): void {
    this.eventForm.teamId = String(teamId || '');
    this.eventForm.dutyId = '';
    this.selectedDutyOption.set(null);
    if (this.eventForm.teamId) {
      this.loadDuties(this.eventForm.teamId);
    }
  }

  onDutySelected(option: unknown): void {
    const selected = (option as Record<string, unknown> | null) ?? null;
    this.selectedDutyOption.set(selected);
    this.eventForm.dutyId = String(selected?.['value'] ?? '');
  }

  saveEvent(): void {
    if (!this.isEventFormValid()) {
      this.feedback.error('Evento non valido', 'Completa titolo, intervallo, team e mansione.');
      return;
    }

    this.savingEvent.set(true);
    this.api.createEvent({
      title: this.eventForm.title.trim(),
      locationValue: this.eventForm.locationValue || undefined,
      type: this.eventForm.isRecurring ? 'recurring' : 'single',
      startsAt: toIsoDateTime(this.eventForm.startsAt),
      endsAt: toIsoDateTime(this.eventForm.endsAt),
      recurrenceRule: this.eventForm.isRecurring ? `FREQ=${this.eventForm.recurrenceFrequency}` : undefined,
      recurrenceTz: this.eventForm.isRecurring ? 'Europe/Rome' : undefined,
      recurrenceDurationMonths: this.eventForm.isRecurring ? this.eventForm.recurrenceDurationMonths : undefined,
      recurrenceAutoRenew: this.eventForm.isRecurring ? this.eventForm.recurrenceAutoRenew : undefined,
      recurrenceRenewMonths: this.eventForm.isRecurring ? this.eventForm.recurrenceRenewMonths : undefined,
      slots: [
        {
          teamId: this.eventForm.teamId!,
          dutyId: this.eventForm.dutyId.trim(),
          startsAt: toIsoDateTime(this.eventForm.startsAt),
          endsAt: toIsoDateTime(this.eventForm.endsAt),
          required: true,
        },
      ],
    }).subscribe({
      next: () => {
        this.eventDialogVisible = false;
        this.savingEvent.set(false);
        this.loadData();
        this.feedback.success('Evento creato', 'Evento, slot e copertura iniziale sono stati sincronizzati.');
      },
      error: (error) => {
        this.savingEvent.set(false);
        this.feedback.error('Creazione evento non riuscita', this.apiError.message(error, 'Impossibile creare l\'evento.'));
      }
    });
  }

  renameEvent(eventId: string, title: string): void {
    if (!title.trim()) {
      return;
    }
    this.api.updateEvent(eventId, { title: title.trim() }).subscribe({
      next: () => {
        this.loadData();
        this.feedback.success('Evento aggiornato');
      },
      error: (error) => this.feedback.error('Aggiornamento non riuscito', this.apiError.message(error, 'Impossibile aggiornare l\'evento.'))
    });
  }

  deleteEvent(eventId: string): void {
    const event = this.events().find((item) => item.id === eventId);
    this.openConfirm({
      title: 'Eliminare evento?',
      message: `L evento ${event?.title || 'selezionato'} verra rimosso dal calendario.`,
      detail: event ? `Data: ${event.startsAt}` : 'Usa danger per eliminazioni definitive nel calendario.',
      tone: 'danger',
      confirmLabel: 'Elimina evento',
      icon: 'pi pi-trash',
      run: () => this.api.deleteEvent(eventId).subscribe({
        next: () => {
          this.loadData();
          this.feedback.success('Evento eliminato');
        },
        error: (error) => this.feedback.error('Eliminazione non riuscita', this.apiError.message(error, 'Impossibile eliminare l\'evento.'))
      })
    });
  }

  selectEvent(event: CalendarEvent): void {
    this.selectedEvent.set(event);
  }

  openAssignmentBoard(): void {
    const selected = this.selectedEvent() ?? this.events()[0] ?? null;
    if (!selected) {
      return;
    }

    this.materializeEventIfNeeded(selected).subscribe({
      next: (event) => {
        this.selectedEvent.set(event);
        this.assignmentBoardVisible = true;
      },
      error: (error) => this.feedback.error('Materializzazione non riuscita', this.apiError.message(error, 'Impossibile preparare l\'occorrenza selezionata.'))
    });
  }

  startDragging(volunteerId: string): void {
    this.draggedVolunteerId.set(volunteerId);
  }

  finishDragging(): void {
    this.draggedVolunteerId.set(null);
    this.dragHoverSlotId.set(null);
  }

  setDragHoverSlot(slotId: string): void {
    if (!this.draggedVolunteerId()) {
      return;
    }
    this.dragHoverSlotId.set(slotId);
  }

  clearDragHoverSlot(slotId: string): void {
    if (this.dragHoverSlotId() === slotId) {
      this.dragHoverSlotId.set(null);
    }
  }

  allowDrop(event: DragEvent, slotId?: string): void {
    event.preventDefault();
    if (slotId && this.draggedVolunteerId()) {
      this.dragHoverSlotId.set(slotId);
    }
  }

  dropVolunteer(slotId: string): void {
    if (!this.draggedVolunteerId()) {
      return;
    }

    const selected = this.selectedEvent();
    if (!selected) {
      this.finishDragging();
      return;
    }

    const assigneeId = this.draggedVolunteerId()!;
    const previousSlot = this.selectedEventSlots().find((item) => item.id === slotId);

    this.materializeEventIfNeeded(selected).subscribe({
      next: (event) => {
        this.selectedEvent.set(event);
        const slot = (event.slots ?? []).find((item) => item.id === slotId)
          ?? (event.slots ?? []).find((item) => item.teamId === previousSlot?.teamId && item.dutyId === previousSlot?.dutyId);
        const assignee = slot ? this.membersForTeam(slot.teamId).find((member) => member.id === assigneeId) ?? null : null;
        if (!slot) {
          this.finishDragging();
          this.feedback.error('Slot non disponibile', 'Impossibile trovare lo slot materializzato per questa occorrenza.');
          return;
        }

        this.dragHoverSlotId.set(slot.id);
        this.api.assignVolunteer({ slotId: slot.id, assigneeId, status: 'assigned' }).subscribe({
          next: (assignment) => {
            this.finishDragging();
            if (assignee) {
              this.patchAssignedVolunteer(slot.id, {
                id: assignment.id,
                assigneeId,
                status: assignment.status,
                replacementApproved: false,
                assignee: {
                  id: assignee.id,
                  fullName: assignee.fullName,
                },
              }, assignee.fullName);
            }
            this.feedback.success('Volontario assegnato');
          },
          error: (error) => {
            this.finishDragging();
            this.feedback.error('Assegnazione non riuscita', this.apiError.message(error, 'Impossibile assegnare il volontario allo slot.'));
          }
        });
      },
      error: (error) => {
        this.finishDragging();
        this.feedback.error('Materializzazione non riuscita', this.apiError.message(error, 'Impossibile preparare l\'occorrenza selezionata.'));
      }
    });
  }

  autoAssign(): void {
    const selected = this.selectedEvent();
    if (!selected) {
      this.feedback.error('Seleziona un evento', 'Auto assegna funziona solo sull evento attualmente selezionato.');
      return;
    }

    this.scheduling.set(true);
    this.runPlanningPreview(this.createPlanningRequest(selected), 'Proposta generata');
  }

  protected rerunPlanning(): void {
    const selected = this.selectedEvent();
    if (!selected) {
      return;
    }

    this.scheduling.set(true);
    this.runPlanningPreview(this.createPlanningRequest(selected), 'Planning ricalcolato con le scelte manuali');
  }

  protected applyPlanning(): void {
    const selected = this.selectedEvent();
    if (!selected) {
      return;
    }

    this.scheduling.set(true);
    this.api.applySchedulePlan({
      ...this.createPlanningRequest(selected),
      planId: this.currentPlanId() ?? undefined,
      applyScope: this.selectedApplyScope(),
    }).subscribe({
      next: (result) => {
        this.currentPlanId.set(result.planId ?? this.currentPlanId());
        this.previewSuggestions.set(result.suggestions ?? []);
        this.planningSummary.set(result.summary ?? null);
        this.previewVisible = true;
        this.scheduling.set(false);
        this.selectedManualAssignments.set({});
        this.loadData();
        this.feedback.success('Planning applicato', `Applicazione completata su scope ${this.selectedApplyScope()}.`);
      },
      error: (error) => {
        this.scheduling.set(false);
        this.feedback.error('Applicazione non riuscita', this.apiError.message(error, 'Impossibile applicare il piano.'));
      }
    });
  }

  protected openAvailabilityDialog(): void {
    const selected = this.selectedEvent();
    const firstSlot = selected?.slots?.[0] ?? null;
    this.availabilityForm = {
      userId: null,
      teamId: firstSlot?.teamId ?? null,
      startsAt: selected ? new Date(selected.startsAt) : new Date(),
      endsAt: selected ? new Date(selected.endsAt) : new Date(Date.now() + 2 * 60 * 60 * 1000),
      reason: '',
    };
    this.availabilityDialogVisible = true;
  }

  protected saveAvailability(): void {
    if (!this.availabilityForm.userId || !this.availabilityForm.startsAt || !this.availabilityForm.endsAt || this.availabilityForm.startsAt >= this.availabilityForm.endsAt) {
      this.feedback.error('Assenza non valida', 'Seleziona persona e intervallo valido.');
      return;
    }

    this.savingAvailability.set(true);
    const payload: CreateAvailabilityDto = {
      teamId: this.availabilityForm.teamId ?? undefined,
      type: 'UNAVAILABLE',
      startsAt: toIsoDateTime(this.availabilityForm.startsAt),
      endsAt: toIsoDateTime(this.availabilityForm.endsAt),
      reason: this.availabilityForm.reason.trim() || undefined,
    };

    this.api.createAvailability(payload, this.availabilityForm.userId).subscribe({
      next: () => {
        this.savingAvailability.set(false);
        this.availabilityDialogVisible = false;
        this.loadOperationalAvailability();
        this.feedback.success('Assenza registrata', 'La nuova indisponibilita sara considerata nei prossimi calcoli.');
      },
      error: (error) => {
        this.savingAvailability.set(false);
        this.feedback.error('Assenza non salvata', this.apiError.message(error, 'Impossibile salvare l assenza.'));
      }
    });
  }

  requestReplacement(assignmentId: string): void {
    if (this.hasPendingReplacement(assignmentId)) {
      return;
    }

    const assignment = this.findAssignmentById(assignmentId);

    this.api.createReplacement({ assignmentId, reason: this.replacementReason.trim() || undefined }).subscribe({
      next: (replacement) => {
        this.replacementReason = '';
        this.patchRequestedReplacement(replacement, assignment);
        this.feedback.success('Richiesta sostituzione inviata');
      },
      error: (error) => this.feedback.error('Richiesta non inviata', this.apiError.message(error, 'Impossibile richiedere la sostituzione.'))
    });
  }

  protected assignReplacement(slotId: string): void {
    const assigneeId = this.replacementAssigneeId();
    if (!assigneeId) {
      this.feedback.error('Selezione mancante', 'Seleziona un sostituto prima di procedere.');
      return;
    }

    const selected = this.selectedEvent();
    if (!selected) {
      return;
    }
    const previousSlot = this.selectedEventSlots().find((item) => item.id === slotId);

    this.materializeEventIfNeeded(selected).subscribe({
      next: (event) => {
        this.selectedEvent.set(event);
        const slot = (event.slots ?? []).find((item) => item.id === slotId)
          ?? (event.slots ?? []).find((item) => item.teamId === previousSlot?.teamId && item.dutyId === previousSlot?.dutyId);
        const assignee = slot ? this.membersForTeam(slot.teamId).find((member) => member.id === assigneeId) ?? null : null;
        if (!slot) {
          this.feedback.error('Slot non disponibile', 'Impossibile trovare lo slot materializzato per il sostituto.');
          return;
        }

        this.api.assignVolunteer({ slotId: slot.id, assigneeId, status: 'assigned' }).subscribe({
          next: (assignment) => {
            this.replacementAssigneeId.set(null);
            if (assignee) {
              this.patchAssignedVolunteer(slot.id, {
                id: assignment.id,
                assigneeId,
                status: assignment.status,
                replacementApproved: false,
                assignee: {
                  id: assignee.id,
                  fullName: assignee.fullName,
                },
              }, assignee.fullName);
            }
            this.feedback.success('Sostituto assegnato allo slot');
          },
          error: (error) => this.feedback.error('Assegnazione non riuscita', this.apiError.message(error, 'Impossibile assegnare il sostituto.'))
        });
      },
      error: (error) => this.feedback.error('Materializzazione non riuscita', this.apiError.message(error, 'Impossibile preparare l\'occorrenza selezionata.'))
    });
  }

  protected resolveApprovedReplacement(replacementId: string): void {
    const assigneeId = this.replacementAssigneeId();
    if (!assigneeId) {
      this.feedback.error('Selezione mancante', 'Seleziona un sostituto prima di approvare la richiesta.');
      return;
    }
    const replacement = this.replacements().find((item) => item.id === replacementId) ?? null;
    const replacementAssignee = assigneeId ? this.findMemberById(assigneeId) : null;
    this.openConfirm({
      title: 'Confermare sostituto?',
      message: `La sostituzione verra confermata${replacementAssignee?.fullName ? ` con ${replacementAssignee.fullName}` : ''}.`,
      detail: `Evento: ${replacement?.assignment?.slot?.event?.title || 'Sostituzione'} · Team: ${replacement?.assignment?.slot?.team?.name || 'Team'}`,
      tone: 'confirm',
      confirmLabel: 'Conferma sostituto',
      icon: 'pi pi-check-circle',
      run: () => this.api.resolveReplacement(replacementId, { status: 'APPROVED', replacementAssigneeId: assigneeId || null }).subscribe({
        next: () => {
          if (assigneeId) {
            this.locallyReservedSuggestionIds.update((ids) => Array.from(new Set([...ids, assigneeId])));
          }
          this.patchReplacementState(replacementId, 'APPROVED', assigneeId, replacementAssignee);
          if (replacement?.assignmentId && assigneeId) {
            this.patchAssignmentAssignee(replacement.assignmentId, assigneeId, replacementAssignee?.fullName ?? replacement.replacementAssignee?.fullName ?? 'Sostituto');
          }
          this.replacementAssigneeId.set(null);
          this.feedback.success('Sostituzione confermata');
        },
        error: (error) => this.feedback.error('Conferma non riuscita', this.apiError.message(error, 'Impossibile confermare il sostituto.'))
      })
    });
  }

  protected approveReplacementWithSuggestion(replacement: ReplacementItem): void {
    if (!replacement.suggestedReplacement?.id) {
      return;
    }

    this.openConfirm({
      title: 'Approvare con suggerito?',
      message: `La copertura verra approvata con ${replacement.suggestedReplacement.fullName}.`,
      detail: `Score suggerito: ${replacement.suggestedReplacement.score} · ${replacement.assignment?.slot?.event?.title || 'Sostituzione'}`,
      tone: 'confirm',
      confirmLabel: 'Approva con suggerito',
      icon: 'pi pi-sparkles',
      run: () => this.api.resolveReplacement(replacement.id, { status: 'APPROVED', replacementAssigneeId: replacement.suggestedReplacement!.id }).subscribe({
        next: () => {
          this.locallyReservedSuggestionIds.update((ids) => Array.from(new Set([...ids, replacement.suggestedReplacement!.id])));
          this.patchReplacementState(replacement.id, 'APPROVED', replacement.suggestedReplacement!.id, replacement.suggestedReplacement);
          this.patchAssignmentAssignee(replacement.assignmentId, replacement.suggestedReplacement!.id, replacement.suggestedReplacement!.fullName);
          this.feedback.success('Sostituzione approvata con suggerito');
        },
        error: (error) => this.feedback.error('Conferma non riuscita', this.apiError.message(error, 'Impossibile approvare con il sostituto suggerito.'))
      })
    });
  }

  protected confirmPendingAction(): void {
    const action = this.pendingConfirm();
    if (!action) {
      return;
    }

    this.confirmVisible.set(false);
    action.run();
  }

  protected closeConfirm(): void {
    this.confirmVisible.set(false);
    this.pendingConfirm.set(null);
  }

  private openConfirm(config: PendingConfirmAction): void {
    this.pendingConfirm.set(config);
    this.confirmVisible.set(true);
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

  protected eventTypeTone(type: string | undefined): 'neutral' | 'info' | 'success' | 'warn' {
    if (type === 'recurring') {
      return 'success';
    }
    if (type === 'single') {
      return 'neutral';
    }
    return 'neutral';
  }

  protected eventDisplayTone(event: CalendarEvent): 'neutral' | 'info' | 'success' | 'warn' {
    if (event.isOccurrence) {
      return 'info';
    }

    return this.eventTypeTone(event.type);
  }

  protected eventDisplayLabel(event: CalendarEvent): string {
    if (event.isOccurrence) {
      return 'Occorrenza';
    }

    if (event.type === 'recurring') {
      return 'Serie';
    }

    return this.eventTypeLabel(event.type);
  }

  protected calendarEventClasses(event: CalendarEvent): string {
    if (event.isOccurrence) {
      return 'border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100';
    }

    if (event.type === 'recurring') {
      return 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100';
    }

    return 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100';
  }

  protected replacementStatusLabel(status: ReplacementItem['status']): string {
    if (status === 'APPROVED') {
      return 'Approvata';
    }
    if (status === 'DECLINED') {
      return 'Rifiutata';
    }
    return 'In attesa';
  }

  canRequestReplacement(assignment: { id: string; assignee?: { id?: string | null } | null }): boolean {
    const currentUserId = this.session.getCurrentUser()?.id;
    return Boolean(currentUserId && assignment.assignee?.id === currentUserId);
  }

  hasPendingReplacement(assignmentId: string): boolean {
    return this.replacements().some((replacement) => replacement.assignmentId === assignmentId && replacement.status === 'PENDING');
  }

  replacementForAssignment(assignmentId: string): ReplacementItem | null {
    return this.replacements().find((replacement) => replacement.assignmentId === assignmentId) ?? null;
  }

  replacementTone(status: ReplacementItem['status']): 'success' | 'warn' | 'info' {
    if (status === 'APPROVED') {
      return 'success';
    }

    if (status === 'DECLINED') {
      return 'warn';
    }

    return 'info';
  }

  private loadData(): void {
    this.loading.set(true);
    this.api.events().subscribe({
      next: (events) => {
        this.events.set(events);
        this.applyRouteContext(events);
        if (this.selectedEvent()) {
          const fresh = events.find((event) => event.id === this.selectedEvent()?.id);
          this.selectedEvent.set(fresh ?? null);
        }
      },
      error: (error) => this.feedback.error('Eventi non caricati', this.apiError.message(error, 'Impossibile recuperare gli eventi.'))
    });
    this.api.teams().subscribe({
      next: (teams) => {
        this.teams.set(teams as unknown as TeamOption[]);
        const activeTeamId = this.eventForm.teamId ?? teams[0]?.id;
        if (activeTeamId) {
          this.loadDuties(activeTeamId);
        }
      },
      error: (error) => this.feedback.error('Team non caricati', this.apiError.message(error, 'Impossibile recuperare i team.'))
    });
    this.api.replacements().subscribe({
      next: (items) => {
        this.replacements.set(items);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.feedback.error('Sostituzioni non caricate', this.apiError.message(error, 'Impossibile recuperare le sostituzioni.'));
      }
    });
    this.loadOperationalAvailability();
    this.loadPlanningHistory(this.selectedEvent()?.seriesId ?? this.selectedEvent()?.id ?? undefined);
  }

  private createPlanningRequest(event: CalendarEvent): SchedulePreviewRequest {
    return {
      from: event.startsAt,
      to: this.resolvePlanningWindowEnd(event),
      eventId: event.seriesId ?? event.id,
      occurrenceStart: event.isOccurrence ? (event.occurrenceStart ?? event.startsAt) : undefined,
      scope: event.isOccurrence ? 'single' : event.type === 'recurring' ? 'series' : 'single',
      includeExistingAssignments: true,
      manualSelections: Object.entries(this.selectedManualAssignments()).map(([slotId, assigneeId]) => ({ slotId, assigneeId })),
    };
  }

  private resolvePlanningWindowEnd(event: CalendarEvent): string {
    const end = new Date(event.startsAt);
    end.setFullYear(end.getFullYear() + 1);
    return end.toISOString();
  }

  private runPlanningPreview(payload: SchedulePreviewRequest, successMessage: string): void {
    this.api.generateSchedulePreview(payload).subscribe({
      next: (result) => {
        this.scheduling.set(false);
        if (result.status === 'queued' && result.jobId) {
          this.pendingPlanningJobId.set(result.jobId);
          this.feedback.success('Scheduling avviato', 'Calcolo pesante inviato in background. Aggiorno la preview appena pronta.');
          this.schedulingDelivery.trackJob({
            jobId: result.jobId,
            onCompleted: (jobResult) => this.applyPlanningResult(jobResult, payload.eventId, successMessage),
            onFailed: (message) => {
              this.pendingPlanningJobId.set(null);
              this.feedback.error('Scheduling non riuscito', message);
            },
          });
          return;
        }

        this.applyPlanningResult(result, payload.eventId, successMessage);
      },
      error: (error) => {
        this.scheduling.set(false);
        this.feedback.error('Scheduling non riuscito', this.apiError.message(error, 'Impossibile generare il piano automatico.'));
      }
    });
  }

  private applyPlanningResult(result: SchedulePlanResponse, eventId: string | undefined, successMessage: string): void {
    this.pendingPlanningJobId.set(null);
    this.schedulingDelivery.stopTracking(result.jobId ?? null);
    this.currentPlanId.set(result.planId ?? null);
    this.previewSuggestions.set(result.suggestions ?? []);
    this.planningSummary.set(result.summary ?? null);
    this.previewVisible = true;
    this.loadPlanningHistory(eventId);
    this.feedback.success(successMessage, `Generate ${result.summary?.slots ?? result.suggestions?.length ?? 0} proposte operative.`);
  }


  private loadOperationalAvailability(): void {
    this.api.availability().subscribe({
      next: (items) => this.operationalAvailability.set(items),
      error: () => this.operationalAvailability.set([]),
    });
  }

  private loadPlanningHistory(eventId?: string): void {
    this.api.schedulingPlans(eventId).subscribe({
      next: (plans) => this.planningHistory.set(plans),
      error: () => this.planningHistory.set([]),
    });
  }

  private loadDuties(teamId: string): void {
    this.api.duties(teamId).subscribe({
      next: (duties) => this.duties.set(duties),
      error: (error) => this.feedback.error('Mansioni non caricate', this.apiError.message(error, 'Impossibile recuperare le mansioni del team.'))
    });
  }

  private applyRouteContext(events: CalendarEvent[]): void {
    const params = this.route.snapshot.queryParamMap;
    const eventId = params.get('eventId');
    const teamName = params.get('team');
    const roleName = params.get('role');
    const status = params.get('status');

    if (status === 'open') {
      this.currentView.set('agenda');
    }

    let target = eventId ? events.find((event) => event.id === eventId) ?? null : null;
    if (!target && (teamName || roleName || status)) {
      target = events.find((event) =>
        (event.assignments ?? []).some((assignment: any) =>
          (!teamName || assignment.team === teamName) &&
          (!roleName || assignment.roleName === roleName) &&
          (!status || assignment.status === status)
        )
      ) ?? null;
    }

    if (target) {
      this.selectedEvent.set(target);
      this.currentView.set('agenda');
    }
  }

  private patchReplacementState(
    replacementId: string,
    status: ReplacementItem['status'],
    replacementAssigneeId: string | null,
    replacementAssignee: NonNullable<ReplacementItem['replacementAssignee']> | NonNullable<ReplacementItem['suggestedReplacement']> | null
  ): void {
    const resolvedAt = new Date().toISOString();
    this.replacements.update((items) =>
      items.map((item) =>
        item.id === replacementId
          ? {
              ...item,
              status,
              resolvedAt,
              replacementAssigneeId: replacementAssigneeId ?? item.replacementAssigneeId,
              replacementAssignee: replacementAssigneeId
                ? replacementAssignee
                  ? {
                      id: replacementAssignee.id,
                      fullName: replacementAssignee.fullName,
                      email: replacementAssignee.email,
                    }
                  : item.replacementAssignee
                : item.replacementAssignee,
            }
          : item
      )
    );
  }

  private patchAssignmentAssignee(assignmentId: string, assigneeId: string, fullName: string): void {
    this.events.update((events) =>
      events.map((event) => ({
        ...event,
        slots: event.slots?.map((slot) => ({
          ...slot,
          assignments: slot.assignments?.map((assignment) =>
            assignment.id === assignmentId
              ? {
                  ...assignment,
                  assigneeId,
                  status: 'assigned',
                  replacementApproved: true,
                  assignee: {
                    id: assigneeId,
                    fullName,
                  },
                }
              : assignment
          ),
        })),
        assignments: event.assignments?.map((assignment) =>
          assignment.id === assignmentId
            ? {
                ...assignment,
                status: 'assigned',
                assignee: fullName,
              }
            : assignment
        ),
      }))
    );

    const selectedEvent = this.selectedEvent();
    if (selectedEvent) {
      this.selectedEvent.set(this.events().find((event) => event.id === selectedEvent.id) ?? selectedEvent);
    }
  }

  private patchAssignedVolunteer(slotId: string, assignment: AssignmentRecord, fullName: string): void {
    this.events.update((events) =>
      events.map((event) => ({
        ...event,
        slots: event.slots?.map((slot) =>
          slot.id === slotId
            ? {
                ...slot,
                assignments: this.upsertSlotAssignment(slot.assignments ?? [], assignment),
              }
            : slot
        ),
        assignments: event.assignments?.some((item) => item.id === assignment.id)
          ? event.assignments.map((item) =>
              item.id === assignment.id
                ? {
                    ...item,
                    assignee: fullName,
                    status: assignment.status,
                  }
                : item
            )
          : [
              ...(event.assignments ?? []),
              {
                id: assignment.id,
                eventId: event.id,
                slotId,
                roleName: event.slots?.find((slot) => slot.id === slotId)?.roleName,
                team: event.slots?.find((slot) => slot.id === slotId)?.teamName,
                assignee: fullName,
                status: assignment.status,
              },
            ],
      }))
    );

    const selectedEvent = this.selectedEvent();
    if (selectedEvent) {
      this.selectedEvent.set(this.events().find((event) => event.id === selectedEvent.id) ?? selectedEvent);
    }
  }

  private upsertSlotAssignment(assignments: AssignmentRecord[], assignment: AssignmentRecord): AssignmentRecord[] {
    return assignments.some((item) => item.id === assignment.id)
      ? assignments.map((item) => (item.id === assignment.id ? assignment : item))
      : [...assignments, assignment];
  }

  private findAssignmentById(assignmentId: string): { event: CalendarEvent; slot: NonNullable<CalendarEvent['slots']>[number]; assignment: AssignmentRecord } | null {
    for (const event of this.events()) {
      for (const slot of event.slots ?? []) {
        const assignment = (slot.assignments ?? []).find((item) => item.id === assignmentId);
        if (assignment) {
          return { event, slot, assignment };
        }
      }
    }

    return null;
  }

  private patchRequestedReplacement(replacement: ReplacementItem, context: { event: CalendarEvent; slot: NonNullable<CalendarEvent['slots']>[number]; assignment: AssignmentRecord } | null): void {
    this.replacements.update((items) => [replacement, ...items]);

    if (!context) {
      return;
    }

    const selectedEvent = this.selectedEvent();
    if (selectedEvent) {
      this.selectedEvent.set(this.events().find((event) => event.id === selectedEvent.id) ?? selectedEvent);
    }
  }

  private findMemberById(memberId: string): NonNullable<TeamOption['members']>[number] | null {
    return this.teams()
      .flatMap((team) => team.members ?? [])
      .find((member) => member.id === memberId) ?? null;
  }

  private eventAssigneeIds(event: CalendarEvent): string[] {
    const fromSlots = (event.slots ?? []).flatMap((slot) =>
      (slot.assignments ?? []).map((assignment) => assignment.assigneeId).filter((assigneeId): assigneeId is string => Boolean(assigneeId))
    );
    const members = this.teams().flatMap((team) => team.members ?? []);
    const fromAssignments = (event.assignments ?? [])
      .map((assignment) => members.find((member) => member.fullName === assignment.assignee)?.id ?? null)
      .filter((assigneeId): assigneeId is string => Boolean(assigneeId));

    return Array.from(new Set([...fromSlots, ...fromAssignments]));
  }

  private materializeEventIfNeeded(event: CalendarEvent) {
    if (!event.isVirtualOccurrence || !event.seriesId || !event.occurrenceStart) {
      return of(event);
    }

    return this.api.updateEvent(event.seriesId, {
      editMode: 'single',
      occurrenceStart: event.occurrenceStart,
    }).pipe(
      switchMap(() => this.api.events()),
      tap((events) => {
        this.events.set(events);
        this.applyRouteContext(events);
      }),
      map((events) => events.find((item: CalendarEvent) => item.seriesId === event.seriesId && item.occurrenceStart === event.occurrenceStart && !item.isVirtualOccurrence) ?? event)
    );
  }

  protected updateRecurrenceDuration(value: unknown): void {
    const numeric = Number(value);
    this.eventForm.recurrenceDurationMonths = [3, 6, 12, 24].includes(numeric) ? numeric as RecurrenceDurationOption : 12;
  }

  protected updateRecurrenceRenewDuration(value: unknown): void {
    const numeric = Number(value);
    this.eventForm.recurrenceRenewMonths = [3, 6, 12, 24].includes(numeric) ? numeric as RecurrenceDurationOption : 12;
  }
}
