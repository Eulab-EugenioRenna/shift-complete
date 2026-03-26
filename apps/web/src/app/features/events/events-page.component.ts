import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { map, of, switchMap, tap } from 'rxjs';
import { TableModule } from 'primeng/table';
import { ReplacementItem } from '@shift-complete/shared-types';
import { ApiErrorService } from '../../core/services/api-error.service';
import { GlobalTeamScopeService } from '../../core/services/global-team-scope.service';
import { SessionService } from '../../core/services/session.service';
import { TeamScopeChipsComponent } from '../../shared/components/team-scope-chips.component';
import { ReportDocument, ReportModalComponent } from '../../shared/components/report-modal.component';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { toIsoDateTime } from '../../core/utils/date-picker.util';
import { AppApiService } from '../../shared/services/app-api.service';
import { LiveNotificationsService } from '../../core/services/live-notifications.service';
import {
  UiChipComponent,
  UiButtonComponent,
  UiBoardColumnComponent,
  UiBoardTileComponent,
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
  UiSurfaceComponent,
  UiToggleComponent,
} from '@shift-complete/ui-kit';

type CalendarEvent = {
  id: string;
  seriesId?: string;
  parentEventId?: string | null;
  title: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  startsAt: string;
  endsAt: string;
  type: string;
  locationValue?: string | null;
  recurrenceRule?: string | null;
  recurrenceTz?: string | null;
  recurrenceUntil?: string | null;
  recurrenceDurationMonths?: number | null;
  recurrenceAutoRenew?: boolean | null;
  recurrenceRenewMonths?: number | null;
  occurrenceStart?: string;
  isOccurrence?: boolean;
  isVirtualOccurrence?: boolean;
  canManageAssignments?: boolean;
  seriesTemplate?: {
    title: string;
    description?: string | null;
    startsAt: string;
    endsAt: string;
    recurrenceRule?: string | null;
    recurrenceTz?: string | null;
    recurrenceUntil?: string | null;
    recurrenceDurationMonths?: number | null;
    recurrenceAutoRenew?: boolean | null;
    recurrenceRenewMonths?: number | null;
    requiredVolunteers?: number;
    slots?: Array<{ teamId: string; dutyId: string; startsAt: string; endsAt: string; required?: boolean; requiredVolunteers?: number }>;
  } | null;
  slots?: Array<{
    id: string;
    dutyId?: string;
    roleName?: string;
    teamId: string;
    teamName?: string;
    startsAt?: string;
    endsAt?: string;
    requiredVolunteers?: number;
    assignments?: Array<{ id: string; assigneeId?: string | null; status: string; replacementApproved?: boolean; assignee?: { id?: string; fullName?: string | null } | null }>; 
  }>;
  assignments?: Array<{ id: string; eventId: string; slotId: string; roleName?: string; team?: string; assignee?: string | null; status: string }>;
};

type AssignmentRecord = NonNullable<NonNullable<CalendarEvent['slots']>[number]['assignments']>[number];

type EventSlotForm = {
  teamId: string | null;
  dutyId: string;
  startsAt: Date | null;
  endsAt: Date | null;
  required: boolean;
  requiredVolunteers: number;
};

type RecurrenceDurationOption = 3 | 6 | 12 | 24;

type EventEditScope = 'single' | 'series';

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
    recommendedEventVolunteers?: number | null;
  }>;
};

type EventFormState = {
  title: string;
  locationValue: string;
  teamId: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  isRecurring: boolean;
  recurrenceFrequency: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  recurrenceDurationMonths: RecurrenceDurationOption;
  recurrenceAutoRenew: boolean;
  recurrenceRenewMonths: RecurrenceDurationOption;
  slots: EventSlotForm[];
};

@Component({
  selector: 'app-events-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    UiChipComponent,
    UiButtonComponent,
    UiBoardColumnComponent,
    UiBoardTileComponent,
    UiConfirmDialogComponent,
    UiFieldComponent,
    UiFilterBarComponent,
    UiInputComponent,
    UiModalComponent,
    UiPageHeaderComponent,
    UiReplacementTimelineCardComponent,
    UiSurfaceComponent,
    UiSelectComponent,
    UiDatePickerComponent,
    UiToggleComponent,
    UiLabelComponent,
    TeamScopeChipsComponent,
    ReportModalComponent,
  ],
  templateUrl: './events-page.component.html',
})
export class EventsPageComponent {
  private readonly api = inject(AppApiService);
  private readonly apiError = inject(ApiErrorService);
  protected readonly live = inject(LiveNotificationsService);
  private readonly feedback = inject(UiFeedbackService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);
  protected readonly teamScope = inject(GlobalTeamScopeService);

  protected readonly events = signal<CalendarEvent[]>([]);
  protected readonly teams = signal<TeamOption[]>([]);
  protected readonly replacements = signal<ReplacementItem[]>([]);
  protected readonly selectedEvent = signal<CalendarEvent | null>(null);
  protected readonly selectedUserFilter = signal<string>('');
  protected readonly occurrenceView = signal<'all' | 'series' | 'occurrences'>('all');
  protected readonly selectedSeriesFilter = signal<string>('');
  protected readonly eventLocationFilter = signal<string>('all');
  protected readonly editingEventId = signal<string | null>(null);
  protected readonly editingEventScope = signal<EventEditScope>('single');
  protected readonly editingOccurrenceStart = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly savingEvent = signal(false);
  protected readonly locallyReservedSuggestionIds = signal<string[]>([]);
  protected readonly confirmVisible = signal(false);
  protected readonly pendingConfirm = signal<PendingConfirmAction | null>(null);
  protected readonly reportVisible = signal(false);
  protected eventDialogVisible = false;

  @HostListener('document:keydown.escape', ['$event'])
  protected handleEscape(event: KeyboardEvent): void {
    if (this.eventDialogVisible) {
      this.eventDialogVisible = false;
      event.preventDefault();
      return;
    }

    if (this.confirmVisible()) {
      this.closeConfirm();
      event.preventDefault();
      return;
    }

  }
  protected readonly preferenceCatalog = signal<Array<{ id: string; type: 'shift' | 'competency' | 'location'; value: string; label: string }>>([]);
  protected eventForm: EventFormState = { title: '', locationValue: '', teamId: null, startsAt: null, endsAt: null, isRecurring: false, recurrenceFrequency: 'WEEKLY', recurrenceDurationMonths: 12, recurrenceAutoRenew: true, recurrenceRenewMonths: 12, slots: [] };
  protected replacementReason = '';
  protected readonly replacementAssigneeId = signal<string | null>(null);
  protected readonly draggedVolunteerId = signal<string | null>(null);
  protected readonly dragHoverSlotId = signal<string | null>(null);
  protected readonly teamOptions = computed(() => this.teams().map((team) => ({ label: team.name, value: team.id })));
  protected readonly locationOptions = computed(() => this.preferenceCatalog().filter((item) => item.type === 'location').map((item) => ({ label: item.label, value: item.value })));
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
  protected readonly eventLocationFilterOptions = computed(() => [
    { label: 'Tutti i luoghi', value: 'all' },
    { label: 'Senza luogo specificato', value: 'none' },
    ...this.locationOptions()
  ]);

  protected readonly filteredEvents = computed(() => {
    const userId = this.selectedUserFilter();
    const seriesId = this.selectedSeriesFilter();

    return this.events().filter((event) => {
      const scopedTeamId = this.teamScope.teamId();
      const directTeamId = (event as CalendarEvent & { teamId?: string | null }).teamId;
      const teamMatch = !scopedTeamId || directTeamId === scopedTeamId || (event.slots ?? []).some((slot) => slot.teamId === scopedTeamId);
      const userMatch = !userId || this.eventAssigneeIds(event).includes(userId);
      const seriesMatch = !seriesId || (event.seriesId ?? event.id) === seriesId;
      const occurrenceMatch = this.occurrenceView() === 'all'
        ? true
        : this.occurrenceView() === 'series'
          ? !event.isOccurrence
          : Boolean(event.isOccurrence);
      
      const locationFilter = this.eventLocationFilter();
      const locationMatch = locationFilter === 'all'
        ? true
        : locationFilter === 'none'
          ? !event.locationValue
          : event.locationValue === locationFilter;

      return teamMatch && userMatch && seriesMatch && occurrenceMatch && locationMatch;
    });
  });
  protected readonly selectedEventSlots = computed(() => this.selectedEvent()?.slots ?? []);
  protected readonly availableEventDuties = computed(() => {
    const teamId = this.eventForm.teamId;
    if (!teamId) {
      return [] as Array<{ id: string; name: string; required: boolean; requiredVolunteers: number; recommendedEventVolunteers: number }>;
    }

    const duties = this.teams().find((team) => team.id === teamId)?.duties ?? [];
    return duties.map((duty) => ({
      id: duty.id,
      name: duty.name,
      required: this.eventForm.slots.some((slot) => slot.dutyId === duty.id && slot.required),
      requiredVolunteers: this.eventForm.slots.find((slot) => slot.dutyId === duty.id)?.requiredVolunteers ?? duty.recommendedEventVolunteers ?? 1,
      recommendedEventVolunteers: duty.recommendedEventVolunteers ?? 1,
    }));
  });
  protected readonly canManageEvents = computed(() => this.session.hasAnyRole('administrator', 'service_leader'));
  protected readonly canManageReplacements = computed(() => this.session.hasAnyRole('administrator', 'service_leader'));

  protected resetFilters(): void {
    this.selectedUserFilter.set('');
    this.selectedSeriesFilter.set('');
    this.occurrenceView.set('all');
    this.eventLocationFilter.set('all');
  }
  protected readonly eventReport = computed<ReportDocument | null>(() => {
    const event = this.selectedEvent();
    if (!event) {
      return null;
    }

    const slots = event.slots ?? [];
    const assignments = slots.flatMap((slot) => slot.assignments ?? []);
    const coveredSlots = slots.filter((slot) => (slot.assignments?.length ?? 0) >= (slot.requiredVolunteers ?? 1)).length;
    const openSlots = slots.length - coveredSlots;
    const location = this.catalogLabel('location', (event as { locationValue?: string | null }).locationValue) || 'Non assegnata';
    const uniqueVolunteers = this.eventAssigneeIds(event).length;
    const requiredVolunteers = slots.reduce((total, slot) => total + (slot.requiredVolunteers ?? 1), 0);
    const pendingReplacements = assignments.filter((assignment) => this.replacementForAssignment(assignment.id)?.status === 'PENDING').length;

    return {
      eyebrow: 'Report evento',
      title: event.title,
      subtitle: `Quadro operativo dell'evento ${this.eventDisplayLabel(event).toLowerCase()} con copertura, slot e sostituzioni.`,
      fileName: this.reportFileName(`evento-${event.title}`),
      generatedAt: this.formatDateTime(new Date().toISOString()),
      sections: [
        {
          title: 'Panoramica',
          metrics: [
            { label: 'Slot', value: String(slots.length) },
            { label: 'Slot coperti', value: String(coveredSlots) },
            { label: 'Volontari coinvolti', value: `${uniqueVolunteers}/${requiredVolunteers}` },
            { label: 'Sostituzioni aperte', value: String(pendingReplacements) },
          ],
          facts: [
            { label: 'Finestra operativa', value: `${this.formatDateTime(event.startsAt)} - ${this.formatDateTime(event.endsAt)}` },
            { label: 'Tipo', value: this.eventDisplayLabel(event) },
            { label: 'Luogo', value: location },
            { label: 'Note', value: event.description || 'Nessuna nota operativa registrata.' },
          ],
          note: openSlots > 0 ? `${openSlots} slot risultano ancora scoperti o senza assegnazione attiva.` : 'Tutti gli slot risultano coperti nel momento della generazione.',
        },
        {
          title: 'Copertura slot',
          description: 'Vista sintetica di team, mansione e presidio corrente.',
          table: {
            columns: ['Team', 'Mansione', 'Fascia', 'Assegnati', 'Stato'],
            rows: slots.map((slot) => [
              slot.teamName || 'Team',
              slot.roleName || 'Mansione',
              `${this.formatTime(slot.startsAt || event.startsAt)} - ${this.formatTime(slot.endsAt || event.endsAt)}`,
              (slot.assignments ?? []).map((assignment) => assignment.assignee?.fullName || 'Aperto').join('\n') || 'Nessuna assegnazione',
               `${slot.assignments?.length ?? 0}/${slot.requiredVolunteers ?? 1}`,
             ]),
          },
        },
        {
          title: 'Sostituzioni e anomalie',
          description: 'Richieste replacement collegate alle assegnazioni dell evento.',
          table: {
            columns: ['Volontario', 'Mansione', 'Stato', 'Replacement'],
            rows: assignments.length
              ? assignments.map((assignment) => {
                  const replacement = this.replacementForAssignment(assignment.id);
                  return [
                    assignment.assignee?.fullName || 'Aperto',
                    slots.find((slot) => (slot.assignments ?? []).some((item) => item.id === assignment.id))?.roleName || 'Mansione',
                    assignment.status,
                    replacement ? `${this.replacementStatusLabel(replacement.status)}${replacement.reason ? ` - ${replacement.reason}` : ''}` : 'Nessuna',
                  ];
                })
              : [['Nessuna assegnazione', '-', '-', '-']],
          },
        },
      ],
    };
  });
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
  protected readonly occurrenceViewOptions = [
    { label: 'Tutto', value: 'all' },
    { label: 'Serie', value: 'series' },
    { label: 'Occorrenze', value: 'occurrences' },
  ];
  protected slotDutyOptions(teamId: string | null): Array<{ label: string; value: string }> {
    if (!teamId) {
      return [];
    }

    return (this.teams().find((team) => team.id === teamId)?.duties ?? []).map((duty) => ({ label: duty.name, value: duty.id }));
  }

  protected updateEventTeam(teamId: string): void {
    this.eventForm = {
      ...this.eventForm,
      teamId,
      slots: this.createSlotsForTeam(teamId, this.eventForm.startsAt, this.eventForm.endsAt),
    };
  }

  protected toggleDutyRequired(dutyId: string, required: boolean): void {
    this.eventForm.slots = this.eventForm.slots.map((slot) =>
      slot.dutyId === dutyId ? { ...slot, required } : slot
    );
  }

  protected updateDutyRequiredVolunteers(dutyId: string, value: string): void {
    const parsed = Number(value);
    const requiredVolunteers = Number.isFinite(parsed) ? Math.max(1, Math.min(99, Math.floor(parsed))) : 1;
    this.eventForm.slots = this.eventForm.slots.map((slot) =>
      slot.dutyId === dutyId ? { ...slot, requiredVolunteers } : slot
    );
  }

  protected slotCoverage(slot: { assignments?: Array<unknown>; requiredVolunteers?: number }): string {
    return `${slot.assignments?.length || 0}/${slot.requiredVolunteers ?? 1}`;
  }

  protected slotCoverageTone(slot: { assignments?: Array<unknown>; requiredVolunteers?: number }): 'success' | 'warn' | 'info' {
    const assigned = slot.assignments?.length || 0;
    const required = slot.requiredVolunteers ?? 1;
    if (assigned >= required) {
      return 'success';
    }
    return assigned > 0 ? 'info' : 'warn';
  }

  protected slotCoverageLabel(slot: { assignments?: Array<unknown>; requiredVolunteers?: number }): string {
    const assigned = slot.assignments?.length || 0;
    const required = slot.requiredVolunteers ?? 1;
    if (assigned >= required) {
      return 'coperto';
    }
    return assigned > 0 ? 'parziale' : 'vacante';
  }

  protected canAssignMoreVolunteers(slot: { assignments?: Array<unknown>; requiredVolunteers?: number }): boolean {
    return (slot.assignments?.length || 0) < (slot.requiredVolunteers ?? 1);
  }

  protected totalRequiredVolunteers(event: CalendarEvent | null | undefined): number {
    return event?.slots?.reduce((total, slot) => total + (slot.requiredVolunteers ?? 1), 0) ?? 0;
  }

  private createEmptySlot(startsAt: Date | null, endsAt: Date | null): EventSlotForm {
    const defaultTeamId = this.teams()[0]?.id ?? null;
    const defaultDutyId = this.slotDutyOptions(defaultTeamId)[0]?.value ?? '';

    return {
      teamId: defaultTeamId,
      dutyId: defaultDutyId,
      startsAt,
      endsAt,
      required: true,
      requiredVolunteers: 1,
    };
  }

  private createSlotsForTeam(teamId: string | null, startsAt: Date | null, endsAt: Date | null): EventSlotForm[] {
    const duties = this.slotDutyOptions(teamId);
    if (!duties.length) {
      return [this.createEmptySlot(startsAt, endsAt)];
    }

    return duties.map((duty) => ({
      teamId,
      dutyId: duty.value,
      startsAt,
      endsAt,
      required: true,
      requiredVolunteers: this.teams().find((team) => team.id === teamId)?.duties?.find((teamDuty) => teamDuty.id === duty.value)?.recommendedEventVolunteers ?? 1,
    }));
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

  protected canEditOccurrence(event: CalendarEvent): boolean {
    return this.canManageEvents() && Boolean(event.id);
  }

  protected canEditSeries(event: CalendarEvent): boolean {
    return this.canManageEvents() && event.type === 'recurring' && Boolean(event.seriesId);
  }

  protected editActionLabel(event: CalendarEvent): string {
    return event.type === 'recurring' ? 'Modifica occorrenza' : 'Modifica evento';
  }

  protected deleteActionLabel(event: CalendarEvent): string {
    return event.type === 'recurring' ? 'Elimina occorrenza' : 'Elimina evento';
  }

  protected castNullable(value: unknown): string | null {
    return value ? String(value) : null;
  }

  protected castString(value: unknown): string {
    return value ? String(value) : '';
  }

  protected setSeriesFilter(value: unknown): void {
    this.selectedSeriesFilter.set(this.castNullable(value) ?? '');
  }

  protected setOccurrenceView(value: unknown): void {
    const normalized = this.castNullable(value);
    if (normalized === 'series' || normalized === 'occurrences') {
      this.occurrenceView.set(normalized);
      return;
    }
    this.occurrenceView.set('all');
  }

  protected updateRecurrenceFrequency(value: unknown): void {
    const normalized = this.castNullable(value);
    if (normalized === 'MONTHLY' || normalized === 'YEARLY') {
      this.eventForm.recurrenceFrequency = normalized;
      return;
    }

    this.eventForm.recurrenceFrequency = 'WEEKLY';
  }

  protected updateRecurrenceDuration(value: unknown): void {
    const numeric = Number(value);
    if ([3, 6, 12, 24].includes(numeric)) {
      this.eventForm.recurrenceDurationMonths = numeric as RecurrenceDurationOption;
      if (!this.eventForm.recurrenceAutoRenew) {
        this.eventForm.recurrenceRenewMonths = numeric as RecurrenceDurationOption;
      }
      return;
    }

    this.eventForm.recurrenceDurationMonths = 12;
  }

  protected updateRecurrenceRenewDuration(value: unknown): void {
    const numeric = Number(value);
    this.eventForm.recurrenceRenewMonths = [3, 6, 12, 24].includes(numeric) ? numeric as RecurrenceDurationOption : 12;
  }

  constructor() {
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
    const requiredSlots = this.eventForm.slots.filter((slot) => slot.required);
    return Boolean(
      this.eventForm.title.trim() &&
      this.eventForm.teamId &&
      this.eventForm.startsAt &&
      this.eventForm.endsAt &&
      this.eventForm.startsAt < this.eventForm.endsAt &&
      requiredSlots.length &&
      requiredSlots.every((slot) =>
        slot.teamId &&
        slot.dutyId.trim() &&
        slot.requiredVolunteers > 0
      )
    );
  }

  openEventDialog(): void {
    if (!this.canManageEvents()) {
      return;
    }
    const now = new Date();
    const end = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    this.eventForm = {
      title: '',
      locationValue: '',
      teamId: this.teams()[0]?.id ?? null,
      startsAt: now,
      endsAt: end,
      isRecurring: false,
      recurrenceFrequency: 'WEEKLY',
      recurrenceDurationMonths: 12,
      recurrenceAutoRenew: true,
      recurrenceRenewMonths: 12,
      slots: this.createSlotsForTeam(this.teams()[0]?.id ?? null, now, end),
    };
    this.editingEventId.set(null);
    this.editingEventScope.set('single');
    this.editingOccurrenceStart.set(null);
    this.eventDialogVisible = true;
  }

  protected openEditEvent(event: CalendarEvent, scope: EventEditScope = 'single'): void {
    if (!this.canManageEvents()) {
      return;
    }
    const source = scope === 'series' && event.seriesTemplate ? event.seriesTemplate : event;
    const sourceSlots = scope === 'series' && event.seriesTemplate?.slots ? event.seriesTemplate.slots : (event.slots ?? []);
    const teamId = sourceSlots[0]?.teamId ?? null;
    const baseSlots = this.createSlotsForTeam(teamId, new Date(source.startsAt), new Date(source.endsAt));
    this.editingEventId.set(scope === 'series' && event.seriesId ? event.seriesId : event.id);
    this.editingEventScope.set(scope);
    this.editingOccurrenceStart.set(scope === 'single' ? event.occurrenceStart ?? event.startsAt : null);
    this.eventForm = {
      title: source.title,
      locationValue: (source as any).locationValue ?? '',
      teamId,
      startsAt: new Date(source.startsAt),
      endsAt: new Date(source.endsAt),
      isRecurring: scope === 'series' ? true : event.type === 'recurring',
      recurrenceFrequency: this.frequencyFromRule(scope === 'series' ? source.recurrenceRule : event.recurrenceRule),
      recurrenceDurationMonths: this.normalizeRecurrenceMonths(source.recurrenceDurationMonths ?? event.recurrenceDurationMonths),
      recurrenceAutoRenew: (source.recurrenceAutoRenew ?? event.recurrenceAutoRenew ?? true) !== false,
      recurrenceRenewMonths: this.normalizeRecurrenceMonths(source.recurrenceRenewMonths ?? event.recurrenceRenewMonths ?? source.recurrenceDurationMonths ?? event.recurrenceDurationMonths),
      slots: baseSlots.map((slot) => ({
        ...slot,
        required: sourceSlots.some((sourceSlot: any) => sourceSlot.dutyId === slot.dutyId),
        requiredVolunteers: sourceSlots.find((sourceSlot: any) => sourceSlot.dutyId === slot.dutyId)?.requiredVolunteers ?? slot.requiredVolunteers,
      })),
    };
    if (!this.eventForm.slots.length && teamId) {
      this.eventForm.slots = this.createSlotsForTeam(this.eventForm.teamId, this.eventForm.startsAt, this.eventForm.endsAt);
    }
    this.eventDialogVisible = true;
  }

  saveEvent(): void {
    if (!this.canManageEvents()) {
      return;
    }
    if (!this.isEventFormValid()) {
      this.feedback.error('Evento non valido', 'Completa titolo, intervallo, team e mansione.');
      return;
    }

    const editingEventId = this.editingEventId();
    this.savingEvent.set(true);
    const payload = {
      title: this.eventForm.title.trim(),
      locationValue: this.eventForm.locationValue || undefined,
      type: (this.eventForm.isRecurring ? 'recurring' : 'single') as 'recurring' | 'single',
      startsAt: toIsoDateTime(this.eventForm.startsAt),
      endsAt: toIsoDateTime(this.eventForm.endsAt),
      recurrenceRule: this.eventForm.isRecurring ? `FREQ=${this.eventForm.recurrenceFrequency}` : undefined,
      recurrenceTz: this.eventForm.isRecurring ? 'Europe/Rome' : undefined,
      recurrenceDurationMonths: this.eventForm.isRecurring ? this.eventForm.recurrenceDurationMonths : undefined,
      recurrenceAutoRenew: this.eventForm.isRecurring ? this.eventForm.recurrenceAutoRenew : undefined,
      recurrenceRenewMonths: this.eventForm.isRecurring ? this.eventForm.recurrenceRenewMonths : undefined,
      slots: this.eventForm.slots
        .filter((slot) => slot.required)
        .map((slot) => ({
        teamId: slot.teamId!,
        dutyId: slot.dutyId.trim(),
        startsAt: toIsoDateTime(this.eventForm.startsAt),
        endsAt: toIsoDateTime(this.eventForm.endsAt),
        required: slot.required,
        requiredVolunteers: slot.requiredVolunteers,
      })),
    };

    const request = editingEventId
      ? this.api.updateEvent(editingEventId, {
          ...payload,
          editMode: this.editingEventScope() as 'single' | 'series',
          occurrenceStart: this.editingEventScope() === 'single' ? (this.editingOccurrenceStart() ?? undefined) : undefined,
        })
      : this.api.createEvent(payload);

    request.subscribe({
      next: () => {
        this.eventDialogVisible = false;
        this.editingEventId.set(null);
        this.editingOccurrenceStart.set(null);
        this.savingEvent.set(false);
        this.loadData();
        this.feedback.success(editingEventId ? 'Evento aggiornato' : 'Evento creato', editingEventId ? 'Le modifiche evento sono state sincronizzate.' : 'Evento, slot e copertura iniziale sono stati sincronizzati.');
      },
      error: (error) => {
        this.savingEvent.set(false);
        this.feedback.error(editingEventId ? 'Aggiornamento evento non riuscito' : 'Creazione evento non riuscita', this.apiError.message(error, 'Impossibile salvare l\'evento.'));
      }
    });
  }

  protected requestSaveEventConfirmation(): void {
    if (!this.isEventFormValid()) {
      this.saveEvent();
      return;
    }

    if (!this.editingEventId()) {
      this.saveEvent();
      return;
    }

    const isSeries = this.editingEventScope() === 'series';
    this.openConfirm({
      title: isSeries ? 'Confermare modifica serie?' : 'Confermare modifica occorrenza?',
      message: isSeries
        ? 'Le modifiche verranno applicate alla serie ricorrente selezionata.'
        : 'Le modifiche verranno applicate solo all occorrenza selezionata.',
      detail: `Evento: ${this.eventForm.title.trim() || 'Evento'} · Inizio: ${this.eventForm.startsAt?.toISOString() || '-'}`,
      tone: 'confirm',
      confirmLabel: isSeries ? 'Salva serie' : 'Salva occorrenza',
      icon: 'pi pi-check-circle',
      run: () => this.saveEvent(),
    });
  }

  renameEvent(eventId: string, title: string): void {
    if (!this.canManageEvents()) {
      return;
    }
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

  deleteEvent(event: CalendarEvent, scope: EventEditScope = 'single'): void {
    if (!this.canManageEvents()) {
      return;
    }
    const targetId = scope === 'series' && event.seriesId ? event.seriesId : event.id;
    this.openConfirm({
      title: scope === 'series' ? 'Eliminare serie?' : 'Eliminare occorrenza?',
      message: scope === 'series'
        ? `La serie ${event.title} verra rimossa con tutte le sue ricorrenze.`
        : `L occorrenza di ${event.title} verra rimossa dal calendario operativo.`,
      detail: scope === 'series'
        ? 'Usa danger per eliminazioni strutturali che impattano piu eventi.'
        : `Data: ${event.startsAt}`,
      tone: 'danger',
      confirmLabel: scope === 'series' ? 'Elimina serie' : 'Elimina occorrenza',
      icon: 'pi pi-trash',
      run: () => this.api.deleteEvent(targetId, {
        mode: scope,
        occurrenceStart: scope === 'single' ? (event.occurrenceStart ?? event.startsAt) : undefined,
      }).subscribe({
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
    this.selectEvent(selected);
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
    if (!this.canManageEvents()) {
      this.finishDragging();
      return;
    }
    if (!this.draggedVolunteerId()) {
      return;
    }

    const selected = this.selectedEvent();
    if (!selected) {
      this.finishDragging();
      return;
    }
    const previousSlot = this.selectedEventSlots().find((item) => item.id === slotId);
    const assigneeId = this.draggedVolunteerId()!;

    this.materializeEventIfNeeded(selected).subscribe({
      next: (event) => {
        this.selectedEvent.set(event);
        const slot = this.resolveMaterializedSlot(event, slotId, previousSlot);
        const assignee = slot ? this.membersForTeam(slot.teamId).find((member) => member.id === assigneeId) ?? null : null;
        if (!slot) {
          this.finishDragging();
          this.feedback.error('Slot non disponibile', 'Impossibile trovare lo slot materializzato per questa occorrenza.');
          return;
        }

        if (!this.canAssignMoreVolunteers(slot)) {
          this.finishDragging();
          this.feedback.error('Slot completo', 'La mansione ha gia raggiunto il numero richiesto di volontari.');
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

  protected frequencyFromRule(rule?: string | null): 'WEEKLY' | 'MONTHLY' | 'YEARLY' {
    if (rule?.includes('FREQ=MONTHLY')) {
      return 'MONTHLY';
    }

    if (rule?.includes('FREQ=YEARLY') || rule?.includes('FREQ=ANNUALLY')) {
      return 'YEARLY';
    }

    return 'WEEKLY';
  }

  autoAssign(): void {
    if (!this.canManageEvents()) {
      return;
    }
    const selected = this.selectedEvent();
    if (!selected) {
      this.feedback.error('Seleziona un evento', 'Auto assegna funziona solo sull evento attualmente selezionato.');
      return;
    }

    this.router.navigate(['/events', selected.id, 'planning']);
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
    if (!this.canManageReplacements()) {
      return;
    }
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
        const slot = this.resolveMaterializedSlot(event, slotId, previousSlot);
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
    if (!this.canManageReplacements()) {
      return;
    }
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
    if (!this.canManageReplacements()) {
      return;
    }
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

  protected replacementStatusLabel(status: ReplacementItem['status']): string {
    if (status === 'APPROVED') {
      return 'Approvata';
    }
    if (status === 'DECLINED') {
      return 'Rifiutata';
    }
    return 'In attesa';
  }

  protected coverageStatusLabel(status: string): string {
    if (status === 'covered') {
      return 'Coperto';
    }
    if (status === 'suggested') {
      return 'Suggerito';
    }
    return 'Da coprire';
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

  protected openEventReport(): void {
    if (!this.selectedEvent()) {
      return;
    }

    this.reportVisible.set(true);
  }

  private loadData(): void {
    this.loading.set(true);
    this.api.events().subscribe({
      next: (events) => {
        this.events.set(events as CalendarEvent[]);
        this.applyRouteContext(events as CalendarEvent[]);
        if (this.selectedEvent()) {
          const fresh = (events as CalendarEvent[]).find((event) => event.id === this.selectedEvent()?.id);
          this.selectedEvent.set(fresh ?? null);
        }
      },
      error: (error) => this.feedback.error('Eventi non caricati', this.apiError.message(error, 'Impossibile recuperare gli eventi.'))
    });
    this.api.teams().subscribe({
      next: (teams) => {
        this.teams.set(teams as unknown as TeamOption[]);
        if (!this.eventForm.slots.length) {
          this.eventForm.slots = this.createSlotsForTeam(this.eventForm.teamId, this.eventForm.startsAt, this.eventForm.endsAt);
          return;
        }

        const defaultTeamId = teams[0]?.id ?? null;
        const normalizedTeamId = this.eventForm.teamId ?? this.eventForm.slots[0]?.teamId ?? defaultTeamId;
        this.eventForm.teamId = normalizedTeamId;
        this.eventForm.slots = this.eventForm.slots.map((slot) => {
          const availableDuties = (teams.find((team) => team.id === normalizedTeamId)?.duties ?? []);
          const normalizedDutyId = availableDuties.some((duty) => duty.id === slot.dutyId)
            ? slot.dutyId
            : (availableDuties[0]?.id ?? '');

          return {
            ...slot,
            teamId: normalizedTeamId,
            dutyId: normalizedDutyId,
            requiredVolunteers: Math.max(1, slot.requiredVolunteers ?? 1),
          };
        });
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

  private applyRouteContext(events: CalendarEvent[]): void {
    const params = this.route.snapshot.queryParamMap;
    const eventId = params.get('eventId');
    const teamName = params.get('team');
    const roleName = params.get('role');
    const status = params.get('status');

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
    const fromAssignments = (event.assignments ?? [])
      .map((assignment) => {
        const matchedMember = this.teams()
          .flatMap((team) => team.members ?? [])
          .find((member) => member.fullName === assignment.assignee);
        return matchedMember?.id ?? null;
      })
      .filter((assigneeId): assigneeId is string => Boolean(assigneeId));

    return Array.from(new Set([...fromSlots, ...fromAssignments]));
  }

  private materializeEventIfNeeded(event: CalendarEvent) {
    if (!event.isVirtualOccurrence || !event.seriesId || !event.occurrenceStart) {
      return of(event);
    }

    const updateObs = this.api.updateEvent(event.seriesId, { editMode: 'single', occurrenceStart: event.occurrenceStart });

    return updateObs.pipe(
      switchMap(() => this.api.events()),
      tap((events) => {
        this.events.set(events as CalendarEvent[]);
        this.applyRouteContext(events as CalendarEvent[]);
      }),
      map((events) => (events as CalendarEvent[]).find((item: CalendarEvent) => item.seriesId === event.seriesId && item.occurrenceStart === event.occurrenceStart && !item.isVirtualOccurrence && item.type === event.type) ?? event)
    );
  }

  private resolveMaterializedSlot(
    event: CalendarEvent,
    slotId: string,
    previousSlot?: NonNullable<CalendarEvent['slots']>[number],
  ) {
    const slots = event.slots ?? [];
    return slots.find((item) => item.id === slotId)
      ?? slots.find((item) =>
        item.teamId === previousSlot?.teamId
        && item.dutyId === previousSlot?.dutyId
        && item.startsAt === previousSlot?.startsAt
        && item.endsAt === previousSlot?.endsAt
      )
      ?? slots.find((item) =>
        item.teamId === previousSlot?.teamId
        && item.dutyId === previousSlot?.dutyId
      )
      ?? slots.find((item) =>
        item.teamName === previousSlot?.teamName
        && item.roleName === previousSlot?.roleName
      )
      ?? null;
  }

  protected recurrenceDurationLabel(event: CalendarEvent): string {
    if (!event.recurrenceDurationMonths) {
      return '1 anno';
    }
    if (event.recurrenceDurationMonths === 12) {
      return '1 anno';
    }
    return `${event.recurrenceDurationMonths} mesi`;
  }

  private normalizeRecurrenceMonths(value: number | null | undefined): RecurrenceDurationOption {
    if (value === 3 || value === 6 || value === 24) {
      return value;
    }
    return 12;
  }

  private catalogLabel(type: 'shift' | 'competency' | 'location', value?: string | null): string {
    if (!value) {
      return '';
    }

    return this.preferenceCatalog().find((item) => item.type === type && item.value === value)?.label ?? value;
  }

  private formatDateTime(value?: string | null): string {
    if (!value) {
      return '-';
    }

    return new Intl.DateTimeFormat('it-IT', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  private formatTime(value?: string | null): string {
    if (!value) {
      return '-';
    }

    return new Intl.DateTimeFormat('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  private reportFileName(value: string): string {
    return `${value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'report'}.pdf`;
  }
}
