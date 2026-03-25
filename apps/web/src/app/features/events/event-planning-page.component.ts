import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ScheduleApplyScope, SchedulePlanListItem, SchedulePlanResponse, SchedulePreviewRequest, ScheduleSuggestionItem } from '@shift-complete/shared-types';
import { UiButtonComponent, UiLabelComponent, UiPageHeaderComponent, UiSelectComponent, UiSurfaceComponent, UiTableShellComponent } from '@shift-complete/ui-kit';
import { ApiErrorService } from '../../core/services/api-error.service';
import { SchedulingPreviewDeliveryService } from '../../core/services/scheduling-preview-delivery.service';
import { UiFeedbackService } from '../../core/services/ui-feedback.service';
import { AppApiService } from '../../shared/services/app-api.service';

type PlanningEvent = {
  id: string;
  seriesId?: string;
  title: string;
  startsAt: string;
  endsAt: string;
  type: string;
  isOccurrence?: boolean;
  occurrenceStart?: string;
  slots?: Array<{ id: string; teamName?: string; roleName?: string }>;
};

@Component({
  selector: 'app-event-planning-page',
  standalone: true,
  imports: [CommonModule, UiButtonComponent, UiLabelComponent, UiPageHeaderComponent, UiSelectComponent, UiSurfaceComponent, UiTableShellComponent],
  templateUrl: './event-planning-page.component.html',
})
export class EventPlanningPageComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(AppApiService);
  private readonly apiError = inject(ApiErrorService);
  private readonly feedback = inject(UiFeedbackService);
  private readonly schedulingDelivery = inject(SchedulingPreviewDeliveryService);

  protected readonly event = signal<PlanningEvent | null>(null);
  protected readonly previewSuggestions = signal<ScheduleSuggestionItem[]>([]);
  protected readonly planningSummary = signal<SchedulePlanResponse['summary'] | null>(null);
  protected readonly planningHistory = signal<SchedulePlanListItem[]>([]);
  protected readonly selectedApplyScope = signal<ScheduleApplyScope>('event');
  protected readonly selectedManualAssignments = signal<Record<string, string>>({});
  protected readonly currentPlanId = signal<string | null>(null);
  protected readonly pendingPlanningJobId = signal<string | null>(null);
  protected readonly scheduling = signal(false);

  protected readonly applyScopeOptions = [
    { label: 'Evento', value: 'event' },
    { label: 'Mese', value: 'month' },
    { label: 'Ciclo', value: 'cycle' },
    { label: 'Anno', value: 'year' },
    { label: 'Tutto', value: 'all' },
  ];

  protected readonly summaryCards = computed(() => {
    const summary = this.planningSummary();
    if (!summary) {
      return [] as Array<{ label: string; value: string; tone: 'neutral' | 'info' | 'success' | 'warn' }>;
    }

    return [
      { label: 'Slot', value: String(summary.slots), tone: 'neutral' as const },
      { label: 'Coperti', value: String(summary.covered), tone: 'success' as const },
      { label: 'Proposti', value: String(summary.proposed), tone: 'info' as const },
      { label: 'Scoperti', value: String(summary.open), tone: 'warn' as const },
    ];
  });

  protected readonly openSuggestions = computed(() => this.previewSuggestions().filter((item) => item.coverageStatus === 'open'));
  protected readonly manualSuggestions = computed(() => this.previewSuggestions().filter((item) => item.coverageStatus === 'manual'));
  protected readonly suggestedSuggestions = computed(() => this.previewSuggestions().filter((item) => item.coverageStatus === 'suggested'));
  protected readonly appliedSuggestions = computed(() => this.previewSuggestions().filter((item) => item.coverageStatus === 'covered'));

  constructor() {
    this.destroyRef.onDestroy(() => this.schedulingDelivery.stopTracking(this.pendingPlanningJobId()));

    effect(() => {
      const eventId = this.route.snapshot.paramMap.get('eventId');
      if (eventId) {
        this.loadEvent(eventId);
      }
    });
  }

  protected rerunPlanning(): void {
    const event = this.event();
    if (!event) {
      return;
    }

    this.scheduling.set(true);
    this.runPlanningPreview(this.createPlanningRequest(event), 'Planning ricalcolato con le scelte manuali');
  }

  protected applyPlanning(): void {
    const event = this.event();
    if (!event) {
      return;
    }

    this.scheduling.set(true);
    this.api.applySchedulePlan({
      ...this.createPlanningRequest(event),
      planId: this.currentPlanId() ?? undefined,
      applyScope: this.selectedApplyScope(),
    }).subscribe({
      next: (result) => {
        this.currentPlanId.set(result.planId ?? this.currentPlanId());
        this.previewSuggestions.set(result.suggestions ?? []);
        this.planningSummary.set(result.summary ?? null);
        this.scheduling.set(false);
        this.selectedManualAssignments.set({});
        this.loadPlanningHistory(event.seriesId ?? event.id);
        this.feedback.success('Planning applicato', `Applicazione completata su scope ${this.selectedApplyScope()}.`);
      },
      error: (error) => {
        this.scheduling.set(false);
        this.feedback.error('Applicazione non riuscita', this.apiError.message(error, 'Impossibile applicare il piano.'));
      }
    });
  }

  protected updatePlanningSelection(slotId: string, value: unknown): void {
    const assigneeId = value ? String(value) : null;
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

  protected selectedPlanningAssignee(slotId: string): string {
    return this.selectedManualAssignments()[slotId] ?? '';
  }

  protected updateApplyScope(value: unknown): void {
    const normalized = value ? String(value) : 'event';
    if (normalized === 'month' || normalized === 'cycle' || normalized === 'year' || normalized === 'all') {
      this.selectedApplyScope.set(normalized);
      return;
    }
    this.selectedApplyScope.set('event');
  }

  protected planningCandidateOptions(item: ScheduleSuggestionItem): Array<{ label: string; value: string }> {
    return (item.candidates ?? []).map((candidate) => ({ label: candidate.fullName, value: candidate.id }));
  }

  protected hasManualOverride(slotId: string): boolean {
    return Boolean(this.selectedManualAssignments()[slotId]);
  }

  protected selectedOrSuggestedAssignee(item: ScheduleSuggestionItem): string {
    return this.selectedPlanningAssignee(item.slotId) || item.assigneeName || 'Nessuna proposta';
  }

  protected planningCoverageTone(status: ScheduleSuggestionItem['coverageStatus']): 'success' | 'warn' | 'info' | 'neutral' {
    if (status === 'covered') return 'success';
    if (status === 'manual' || status === 'suggested') return 'info';
    return 'warn';
  }

  protected planningCoverageLabel(status: ScheduleSuggestionItem['coverageStatus']): string {
    if (status === 'covered') return 'Coperto';
    if (status === 'manual') return 'Scelta manuale';
    if (status === 'suggested') return 'Proposto';
    return 'Scoperto';
  }

  protected reasonTone(reason: string): 'success' | 'warn' | 'neutral' {
    return reason.includes(':+') ? 'success' : reason.includes(':-') ? 'warn' : 'neutral';
  }

  protected cycleSummaryLabel(item: ScheduleSuggestionItem): string {
    return `Ciclo ${item.cycleNumber} · passo ${item.cycleIndex}/${item.cycleLength}`;
  }

  protected openHistoryPlan(planId: string): void {
    this.scheduling.set(true);
    this.api.schedulingPlan(planId).subscribe({
      next: (result) => {
        this.currentPlanId.set(result.planId ?? planId);
        this.previewSuggestions.set(result.suggestions ?? []);
        this.planningSummary.set(result.summary ?? null);
        this.scheduling.set(false);
        this.feedback.success('Piano caricato');
      },
      error: (error) => {
        this.scheduling.set(false);
        this.feedback.error('Piano non disponibile', this.apiError.message(error, 'Impossibile caricare il piano selezionato.'));
      }
    });
  }

  protected backToEvents(): void {
    const event = this.event();
    this.router.navigate(['/events'], { queryParams: event ? { eventId: event.id } : undefined });
  }

  private loadEvent(eventId: string): void {
    this.api.events().subscribe({
      next: (events) => {
        const target = events.find((event) => event.id === eventId || event.seriesId === eventId) ?? null;
        if (!target) {
          this.feedback.error('Evento non trovato', 'Impossibile aprire la pagina di auto assegnazione.');
          this.router.navigate(['/events']);
          return;
        }

        this.event.set(target);
        this.loadPlanningHistory(target.seriesId ?? target.id);
      },
      error: (error) => this.feedback.error('Evento non disponibile', this.apiError.message(error, 'Impossibile recuperare l evento.')),
    });
  }

  private createPlanningRequest(event: PlanningEvent): SchedulePreviewRequest {
    const end = new Date(event.startsAt);
    end.setFullYear(end.getFullYear() + 1);
    return {
      from: event.startsAt,
      to: end.toISOString(),
      eventId: event.seriesId ?? event.id,
      occurrenceStart: event.isOccurrence ? (event.occurrenceStart ?? event.startsAt) : undefined,
      scope: event.isOccurrence ? 'single' : event.type === 'recurring' ? 'series' : 'single',
      includeExistingAssignments: true,
      manualSelections: Object.entries(this.selectedManualAssignments()).map(([slotId, assigneeId]) => ({ slotId, assigneeId })),
    };
  }

  private runPlanningPreview(payload: SchedulePreviewRequest, successMessage: string): void {
    this.api.generateSchedulePreview(payload).subscribe({
      next: (result) => {
        this.scheduling.set(false);
        if (result.status === 'queued' && result.jobId) {
          this.pendingPlanningJobId.set(result.jobId);
          this.feedback.success('Scheduling avviato', 'Calcolo pesante inviato in background. Aggiorno la pagina appena pronta.');
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
    this.loadPlanningHistory(eventId);
    this.feedback.success(successMessage, `Generate ${result.summary?.slots ?? result.suggestions?.length ?? 0} proposte operative.`);
  }

  private loadPlanningHistory(eventId?: string): void {
    this.api.schedulingPlans(eventId).subscribe({
      next: (plans) => this.planningHistory.set(plans),
      error: () => this.planningHistory.set([]),
    });
  }
}
