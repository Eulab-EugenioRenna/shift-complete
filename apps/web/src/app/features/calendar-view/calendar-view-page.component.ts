import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ReplacementItem } from '@shift-complete/shared-types';
import { map, of, switchMap, tap } from 'rxjs';
import { ApiErrorService } from '../../core/services/api-error.service';
import { GlobalTeamScopeService } from '../../core/services/global-team-scope.service';
import { SessionService } from '../../core/services/session.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { fromIsoDateTime, toIsoDateTime } from '../../core/utils/date-picker.util';
import { AppApiService, DutyListItem } from '../../shared/services/app-api.service';
import { LiveNotificationsService } from '../../core/services/live-notifications.service';
import { TeamScopeChipsComponent } from '../../shared/components/team-scope-chips.component';
import {
  UiDialogShellComponent,
  UiLabelComponent,
  UiSelectComponent,
  UiSidebarPanelComponent,
  UiTableShellComponent,
} from '@shift-complete/ui-kit';

type CalendarEvent = {
  id: string;
  seriesId?: string;
  title: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  startsAt: string;
  endsAt: string;
  type: string;
  recurrenceRule?: string | null;
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

type AssignmentRecord = NonNullable<NonNullable<CalendarEvent['slots']>[number]['assignments']>[number];

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

@Component({
  selector: 'app-calendar-view-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    TableModule,
    TagModule,
    UiDialogShellComponent,
    UiSidebarPanelComponent,
    UiSelectComponent,
    UiTableShellComponent,
    UiLabelComponent,
    TeamScopeChipsComponent,
    RouterLink,
  ],
  templateUrl: './calendar-view-page.component.html',
})
export class CalendarViewPageComponent {
  private readonly api = inject(AppApiService);
  private readonly apiError = inject(ApiErrorService);
  protected readonly live = inject(LiveNotificationsService);
  private readonly feedback = inject(UiFeedbackService);
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(SessionService);
  protected readonly teamScope = inject(GlobalTeamScopeService);

  protected readonly events = signal<CalendarEvent[]>([]);
  protected readonly teams = signal<TeamOption[]>([]);
  protected readonly replacements = signal<ReplacementItem[]>([]);
  protected readonly previewSuggestions = signal<any[]>([]);
  protected readonly duties = signal<DutyListItem[]>([]);
  protected readonly selectedEvent = signal<CalendarEvent | null>(null);
  protected readonly assistantReplacement = signal<ReplacementItem | null>(null);
  protected readonly selectedUserFilter = signal<string>('');
  protected readonly occurrenceView = signal<'all' | 'series' | 'occurrences'>('all');
  protected readonly loading = signal(false);
  protected readonly savingEvent = signal(false);
  protected readonly scheduling = signal(false);
  protected readonly selectedDutyOption = signal<Record<string, unknown> | null>(null);
  protected readonly locallyReservedSuggestionIds = signal<string[]>([]);
  protected readonly currentView = signal('month');
  protected readonly calendarCursor = signal(this.startOfDay(new Date()));
  protected previewVisible = false;
  protected assignmentBoardVisible = false;
  protected eventDialogVisible = false;
  protected eventForm = { title: '', startsAt: null as Date | null, endsAt: null as Date | null, teamId: null as string | null, dutyId: '', isRecurring: false, recurrenceFrequency: 'WEEKLY' as 'WEEKLY' | 'MONTHLY' | 'YEARLY' };
  protected replacementReason = '';
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
    Array.from(
      new Map(
        this.teams()
          .flatMap((team) => team.members ?? [])
          .map((member) => [member.id, { label: member.fullName, value: member.id }])
      ).values()
    )
  );
  protected readonly filteredEvents = computed(() => {
    const userId = this.selectedUserFilter();

    return this.events().filter((event) => {
      const scopedTeamId = this.teamScope.teamId();
      const teamMatch = !scopedTeamId || (event.slots ?? []).some((slot) => slot.teamId === scopedTeamId);
      const userMatch = !userId || (event.slots ?? []).some((slot) => (slot.assignments ?? []).some((assignment) => assignment.assigneeId === userId));
      const occurrenceMatch = this.occurrenceView() === 'all'
        ? true
        : this.occurrenceView() === 'series'
          ? !event.isOccurrence
          : Boolean(event.isOccurrence);
      return teamMatch && userMatch && occurrenceMatch;
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

  protected setOccurrenceView(value: unknown): void {
    const normalized = this.castNullable(value);
    if (normalized === 'series' || normalized === 'occurrences') {
      this.occurrenceView.set(normalized);
      return;
    }
    this.occurrenceView.set('all');
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
    this.live.connect();
    this.loadData();
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
      startsAt: now,
      endsAt: end,
      teamId: firstTeam,
      dutyId: '',
      isRecurring: false,
      recurrenceFrequency: 'WEEKLY',
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
      type: this.eventForm.isRecurring ? 'recurring' : 'single',
      startsAt: toIsoDateTime(this.eventForm.startsAt),
      endsAt: toIsoDateTime(this.eventForm.endsAt),
      recurrenceRule: this.eventForm.isRecurring ? `FREQ=${this.eventForm.recurrenceFrequency}` : undefined,
      recurrenceTz: this.eventForm.isRecurring ? 'Europe/Rome' : undefined,
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
    this.api.deleteEvent(eventId).subscribe({
      next: () => {
        this.loadData();
        this.feedback.success('Evento eliminato');
      },
      error: (error) => this.feedback.error('Eliminazione non riuscita', this.apiError.message(error, 'Impossibile eliminare l\'evento.'))
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
    const selectedTeamId = this.selectedEvent()?.slots?.[0]?.teamId ?? this.eventForm.teamId ?? undefined;
    this.scheduling.set(true);
    const now = new Date();
    const to = new Date(now);
    to.setDate(to.getDate() + 30);
    this.api.generateSchedulePreview({ from: now.toISOString(), to: to.toISOString(), teamId: selectedTeamId ?? undefined, apply: true }).subscribe({
      next: (result) => {
        this.previewSuggestions.set(result.suggestions ?? []);
        this.previewVisible = true;
        this.scheduling.set(false);
        this.loadData();
        this.feedback.success('Auto assegnazione completata', `Generate ${result.suggestions?.length ?? 0} proposte operative.`);
      },
      error: (error) => {
        this.scheduling.set(false);
        this.feedback.error('Scheduling non riuscito', this.apiError.message(error, 'Impossibile generare il piano automatico.'));
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
    this.api.resolveReplacement(replacementId, { status: 'APPROVED', replacementAssigneeId: assigneeId || null }).subscribe({
      next: () => {
        const replacement = this.replacements().find((item) => item.id === replacementId) ?? null;
        const replacementAssignee = assigneeId ? this.findMemberById(assigneeId) : null;
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
    });
  }

  protected approveReplacementWithSuggestion(replacement: ReplacementItem): void {
    if (!replacement.suggestedReplacement?.id) {
      return;
    }

    this.api.resolveReplacement(replacement.id, { status: 'APPROVED', replacementAssigneeId: replacement.suggestedReplacement.id }).subscribe({
      next: () => {
        this.locallyReservedSuggestionIds.update((ids) => Array.from(new Set([...ids, replacement.suggestedReplacement!.id])));
        this.patchReplacementState(replacement.id, 'APPROVED', replacement.suggestedReplacement!.id, replacement.suggestedReplacement);
        this.patchAssignmentAssignee(replacement.assignmentId, replacement.suggestedReplacement!.id, replacement.suggestedReplacement!.fullName);
        this.feedback.success('Sostituzione approvata con suggerito');
      },
      error: (error) => this.feedback.error('Conferma non riuscita', this.apiError.message(error, 'Impossibile approvare con il sostituto suggerito.'))
    });
  }

  protected openReplacementAssistant(replacement: ReplacementItem): void {
    this.assistantReplacement.set(replacement);
  }

  protected assistantScoreTone(score: number): 'success' | 'info' | 'warn' {
    if (score >= 80) {
      return 'success';
    }

    if (score >= 60) {
      return 'info';
    }

    return 'warn';
  }

  protected assistantStatusLabel(replacement: ReplacementItem): string {
    if (replacement.status === 'APPROVED') {
      return 'Decisione presa';
    }

    if (replacement.status === 'DECLINED') {
      return 'Richiesta chiusa';
    }

    return 'Decisione richiesta';
  }

  protected assistantCoverageLabel(replacement: ReplacementItem): string {
    return replacement.replacementAssignee?.fullName ? `Copertura: ${replacement.replacementAssignee.fullName}` : 'Copertura da confermare';
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

  protected replacementStatusLabel(status: ReplacementItem['status']): string {
    if (status === 'APPROVED') {
      return 'Approvata';
    }
    if (status === 'DECLINED') {
      return 'Rifiutata';
    }
    return 'In attesa';
  }

  protected assistantRecommendation(replacement: ReplacementItem): string {
    if (replacement.status === 'APPROVED') {
      return replacement.replacementAssignee?.fullName
        ? `La copertura calendario e gia confermata con ${replacement.replacementAssignee.fullName}.`
        : 'La richiesta e approvata: verifica che lo slot riceva il sostituto definitivo.';
    }

    if (replacement.status === 'DECLINED') {
      return 'La richiesta e stata chiusa senza sostituzione: controlla rapidamente lo slot per evitare buchi di copertura.';
    }

    if (replacement.suggestedReplacement?.fullName) {
      return `Per proteggere la copertura dello slot, ${replacement.suggestedReplacement.fullName} e la prima scelta da confermare.`;
    }

    return 'Non c e un suggerimento automatico forte: verifica disponibilita e conflitti direttamente dal calendario.';
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
    this.assistantReplacement.update((item) =>
      item?.id === replacementId
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
}
