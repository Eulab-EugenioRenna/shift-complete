import { ForbiddenException, Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { Role } from '@prisma/client';
import { toJsonValue } from '../../common/utils/json.util';
import { PrismaService } from '../../database/prisma.service';
import { BackgroundJobsService } from '../jobs/background-jobs.service';
import { QueueService } from '../queue/queue.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { GenerateScheduleDto } from './dto/generate-schedule.dto';
import { EventsService } from '../events/events.service';
import { SchedulingCacheService } from './scheduling-cache.service';

type ManualSelection = {
  slotId: string;
  assigneeId: string;
};

type SchedulingSlot = {
  id: string;
  teamId: string;
  startsAt: Date;
  endsAt: Date;
  requiredVolunteers: number;
  assignments: Array<{ id?: string; assigneeId: string | null; status?: string }>;
  duty: { id: string; name: string };
  team: { name: string };
  event: { id: string; title: string; startsAt: Date; endsAt: Date };
};

type Candidate = {
  id: string;
  fullName: string;
  score: number;
  reasons: string[];
};

type Suggestion = {
  slotId: string;
  slotDemandKey: string;
  slotDemandIndex: number;
  eventId: string;
  eventTitle: string;
  teamId: string;
  teamName: string;
  dutyId: string;
  roleName: string;
  startsAt: Date;
  endsAt: Date;
  coverageStatus: 'covered' | 'suggested' | 'manual' | 'open';
  strategy: string;
  assigneeId: string | null;
  assigneeName?: string | null;
  score?: number | null;
  reasons?: string[];
  candidates?: Candidate[];
  cycleKey: string;
  cycleIndex: number;
  cycleLength: number;
  cycleNumber: number;
  selectionSource: 'existing' | 'suggested' | 'manual' | 'open';
  existingAssignmentId?: string | null;
  existingAssigneeId?: string | null;
  existingAssigneeName?: string | null;
  drift?: {
    status: 'match' | 'changed' | 'missing';
    currentAssigneeId?: string | null;
    currentAssigneeName?: string | null;
  };
};

type CycleState = {
  order: string[];
  pointer: number;
  completedTurns: number;
};

type PlanRecord = {
  id: string;
  anchorEventId: string;
  anchorEventTitle: string;
  invalidatedAt: Date | null;
  invalidationReason: string | null;
    items: Array<{
      id: string;
      slotId: string;
      slotDemandKey: string;
      slotDemandIndex: number;
      eventId: string;
    eventTitle: string;
    teamId: string;
    teamName: string;
    dutyId: string;
    roleName: string;
    startsAt: Date;
    endsAt: Date;
    coverageStatus: string;
    strategy: string;
    assigneeId: string | null;
    assigneeName: string | null;
    score: number | null;
    reasons: unknown;
    candidates: unknown;
    cycleKey: string;
    cycleIndex: number;
    cycleLength: number;
    cycleNumber: number;
    selectionSource: string;
    existingAssignmentId: string | null;
    existingAssigneeId: string | null;
    existingAssigneeName: string | null;
      drift?: {
        status: 'match' | 'changed' | 'missing';
        currentAssigneeId?: string | null;
        currentAssigneeName?: string | null;
      };
  }>;
  summary: unknown;
  criteria: unknown;
};

@Injectable()
export class SchedulingService {
  private readonly logger = new Logger(SchedulingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
    @Inject(forwardRef(() => EventsService))
    private readonly eventsService: EventsService,
    private readonly queueService: QueueService,
    private readonly backgroundJobsService: BackgroundJobsService,
    private readonly schedulingCacheService: SchedulingCacheService,
  ) {}

  async generatePreview(payload: GenerateScheduleDto, actorId: string, actorRole: Role, options?: { allowAsync?: boolean }) {
    const startedAt = Date.now();
    if (payload.planId) {
      const persistedPlan = await this.prisma.schedulingPlan.findUnique({
        where: { id: payload.planId },
        include: { items: { orderBy: { startsAt: 'asc' } } },
      } as any) as unknown as PlanRecord | null;
      if (persistedPlan) {
        return this.toPersistedResponse(persistedPlan, 'Planning preview loaded');
      }
    }

    const requestHash = await this.schedulingCacheService.buildPreviewHash(payload, actorId, actorRole);
    const cachedResponse = await this.schedulingCacheService.getPreview<ReturnType<SchedulingService['toResponse']>>(requestHash);
    if (cachedResponse) {
      await this.schedulingCacheService.incrementMetric('preview_cache_hits');
      this.logger.log(`preview cache hit hash=${requestHash.slice(0, 8)} durationMs=${Date.now() - startedAt}`);
      return {
        ...cachedResponse,
        status: 'completed' as const,
        cacheHit: true,
        message: 'Planning preview loaded from cache',
      };
    }

    await this.schedulingCacheService.incrementMetric('preview_cache_misses');

    if (await this.shouldQueuePreview(payload, options?.allowAsync !== false)) {
      const activeJobId = await this.schedulingCacheService.getActiveJobId(requestHash);
      if (activeJobId) {
        await this.schedulingCacheService.incrementMetric('preview_queue_dedup_hits');
        this.logger.log(`preview queue dedup hash=${requestHash.slice(0, 8)} jobId=${activeJobId}`);
        return this.toQueuedResponse(activeJobId, 'Planning preview already queued');
      }

      const runtimeSettings = await this.loadSchedulingRuntimeSettings();

      const backgroundJob = await this.backgroundJobsService.create({
        kind: 'scheduling_preview' as any,
        userId: actorId,
        entityType: 'schedulePreview',
        entityId: payload.eventId,
        payload: {
          eventId: payload.eventId ?? null,
          from: payload.from,
          to: payload.to,
          scope: payload.scope ?? 'single',
        },
      });

      await this.schedulingCacheService.setActiveJobId(requestHash, backgroundJob.id);
      await this.queueService.schedulingQueue.add('scheduling-preview', {
        jobId: backgroundJob.id,
        actorId,
        actorRole,
        requestHash,
        payload,
      }, {
        attempts: runtimeSettings.retryCount,
      });

      this.logger.log(`preview queued hash=${requestHash.slice(0, 8)} jobId=${backgroundJob.id} retries=${runtimeSettings.retryCount}`);
      await this.schedulingCacheService.incrementMetric('preview_queued');

      this.realtimeGateway.broadcastSchedulingUpdate({
        kind: 'scheduling.preview.queued',
        actorId,
        jobId: backgroundJob.id,
        eventId: payload.eventId ?? null,
      });

      return this.toQueuedResponse(backgroundJob.id, 'Planning preview queued');
    }

    const computedResponse = await this.computePreview(payload, actorId, actorRole);
    await this.schedulingCacheService.setPreview(requestHash, computedResponse);
    await this.schedulingCacheService.incrementMetric('preview_completed');
    await this.schedulingCacheService.addMetricValue('preview_duration_total_ms', Date.now() - startedAt);
    await this.schedulingCacheService.incrementMetric('preview_duration_samples');
    this.logger.log(`preview computed hash=${requestHash.slice(0, 8)} durationMs=${Date.now() - startedAt} slots=${computedResponse.summary.slots}`);
    return {
      ...computedResponse,
      status: 'completed' as const,
      cacheHit: false,
    };
  }

  async clearQueuedPreview(requestHash: string): Promise<void> {
    await this.schedulingCacheService.clearActiveJobId(requestHash);
  }

  async recordMetric(name: string, amount = 1): Promise<void> {
    await this.schedulingCacheService.incrementMetric(name, amount);
  }

  private async computePreview(payload: GenerateScheduleDto, actorId: string, actorRole: Role) {

    const manualSelections = this.normalizeSelections(payload.manualSelections);
    const slots = await this.loadSlots(payload, actorId, actorRole);
    const suggestions = await this.buildPlan(slots, manualSelections, payload.includeExistingAssignments !== false);
    const savedPlan = await this.savePlan(payload, actorId, suggestions, null);

    await this.recordAudit('scheduling.preview.generated', actorId, payload.eventId ?? 'range', {
      payload,
      suggestions: suggestions.length,
      planId: savedPlan.id,
    });

    this.realtimeGateway.broadcastSchedulingUpdate({
      kind: 'scheduling.preview.generated',
      actorId,
      teamId: null,
      suggestions: suggestions.length,
      applied: false,
    });

    return this.toResponse(savedPlan.id, payload.eventId ?? '', suggestions, 'Planning preview generated', savedPlan.invalidatedAt ?? null);
  }

  async applyPlan(payload: GenerateScheduleDto & { applyScope: 'event' | 'month' | 'cycle' | 'year' | 'all' }, actorId: string, actorRole: Role) {
    const manualSelections = this.normalizeSelections(payload.manualSelections);
    const slots = await this.loadSlots(payload, actorId, actorRole);
    const suggestions = await this.buildPlan(slots, manualSelections, true);
    const selectedEventId = payload.eventId ?? suggestions[0]?.eventId ?? '';
    const anchor = suggestions.find((item) => item.eventId === selectedEventId) ?? suggestions[0] ?? null;

    if (!anchor) {
      return this.toResponse(null, selectedEventId, suggestions, 'No planning items available');
    }

    const appliedSuggestions = suggestions.filter((item) => this.matchesApplyScope(item, anchor, payload.applyScope));

    for (const suggestion of appliedSuggestions) {
      if (!suggestion.assigneeId || suggestion.coverageStatus === 'open') {
        continue;
      }

      const existingAssignmentId = suggestion.existingAssignmentId ?? null;
      if (existingAssignmentId) {
        await this.prisma.assignment.update({
          where: { id: existingAssignmentId },
          data: {
            assigneeId: suggestion.assigneeId,
            status: 'assigned',
            autoAssigned: false,
          },
        } as any);
        continue;
      }

      await this.prisma.assignment.create({
        data: {
          slotId: suggestion.slotId,
          assigneeId: suggestion.assigneeId,
          status: 'assigned',
          autoAssigned: false,
        },
      } as any);
    }

    let planId: string | null = payload.planId ?? null;
    if (planId) {
      await this.prisma.schedulingPlan.update({
        where: { id: planId },
        data: {
          applyScope: payload.applyScope,
        },
      } as any);
      await this.prisma.schedulingPlanItem.updateMany({
        where: {
          planId,
          slotId: { in: appliedSuggestions.map((item) => item.slotId) },
        },
        data: {
          appliedAt: new Date(),
          appliedScope: payload.applyScope,
        },
      } as any);
    } else {
      const savedPlan = await this.savePlan(payload, actorId, suggestions, payload.applyScope);
      planId = savedPlan.id;
      await this.prisma.schedulingPlanItem.updateMany({
        where: {
          planId,
          slotId: { in: appliedSuggestions.map((item) => item.slotId) },
        },
        data: {
          appliedAt: new Date(),
          appliedScope: payload.applyScope,
        },
      } as any);
    }

    await this.recordAudit('scheduling.plan.applied', actorId, selectedEventId || 'range', {
      payload,
      appliedSuggestions: appliedSuggestions.length,
      planId,
    });

    this.realtimeGateway.broadcastSchedulingUpdate({
      kind: 'scheduling.plan.applied',
      actorId,
      teamId: null,
      suggestions: appliedSuggestions.length,
      applied: true,
      applyScope: payload.applyScope,
    });

    return this.toResponse(planId, selectedEventId, suggestions, 'Planning applied', null, null, payload.eventId ? await this.lookupEventTitle(payload.eventId) : undefined);
  }

  async listPlans(actorId: string, actorRole: Role, eventId?: string) {
    const where = {
      anchorEventId: eventId ?? undefined,
      actorId: actorRole === Role.administrator ? undefined : actorId,
    } as any;

    const plans = await this.prisma.schedulingPlan.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 20,
    } as any);

    return plans.map((plan: any) => ({
      id: plan.id,
      anchorEventId: plan.anchorEventId,
      anchorEventTitle: plan.anchorEventTitle,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
      invalidatedAt: plan.invalidatedAt?.toISOString() ?? null,
      invalidationReason: plan.invalidationReason ?? null,
      scope: plan.scope,
      applyScope: plan.applyScope ?? null,
      summary: this.readSummary(plan.summary),
    }));
  }

  async getPlan(planId: string, actorId: string, actorRole: Role) {
    const plan = await this.prisma.schedulingPlan.findUnique({
      where: { id: planId },
      include: { items: { orderBy: { startsAt: 'asc' } } },
    } as any) as unknown as PlanRecord | null;

    if (!plan) {
      throw new ForbiddenException('Piano non trovato');
    }

    if (actorRole !== Role.administrator) {
      const owner = await this.prisma.schedulingPlan.findUnique({ where: { id: planId }, select: { actorId: true } } as any);
      if (owner?.actorId && owner.actorId !== actorId) {
        throw new ForbiddenException('Piano non disponibile');
      }
    }

    return this.toPersistedResponse(plan, 'Planning loaded');
  }

  async invalidatePlansForEvent(eventId: string, reason: string) {
    await this.prisma.schedulingPlan.updateMany({
      where: {
        invalidatedAt: null,
        OR: [
          { anchorEventId: eventId },
          { items: { some: { eventId } } },
        ],
      },
      data: {
        invalidatedAt: new Date(),
        invalidationReason: reason,
      },
    } as any);
    await this.schedulingCacheService.bumpNamespaceVersion();
  }

  async invalidatePlansForWindow(payload: { reason: string; teamIds?: string[]; startsAt?: Date; endsAt?: Date }) {
    const teamIds = payload.teamIds?.filter(Boolean) ?? [];
    await this.prisma.schedulingPlan.updateMany({
      where: {
        invalidatedAt: null,
        items: {
          some: {
            ...(teamIds.length ? { teamId: { in: teamIds } } : {}),
            ...(payload.startsAt ? { endsAt: { gt: payload.startsAt } } : {}),
            ...(payload.endsAt ? { startsAt: { lt: payload.endsAt } } : {}),
          },
        },
      },
      data: {
        invalidatedAt: new Date(),
        invalidationReason: payload.reason,
      },
    } as any);
    await this.schedulingCacheService.bumpNamespaceVersion();
  }

  private async loadSlots(payload: GenerateScheduleDto, actorId: string, actorRole: Role): Promise<SchedulingSlot[]> {
    if (actorRole === Role.service_leader) {
      const event = payload.eventId
        ? await this.prisma.event.findUnique({
            where: { id: payload.eventId },
            include: {
              slots: {
                select: {
                  team: {
                    select: {
                      leaderId: true,
                    },
                  },
                },
              },
            },
          } as any)
        : null;

      const leaderScopedEvent = event as any;
      const hasForbiddenSlot = Boolean(leaderScopedEvent?.slots?.some((slot: any) => slot.team?.leaderId !== actorId));
      if (hasForbiddenSlot) {
        throw new ForbiddenException('Il leader puo generare solo per i team presenti nei propri eventi');
      }
    }

    const slots = await this.eventsService.prepareSlotsForScheduling(payload) as unknown as SchedulingSlot[];
    return [...slots].sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());
  }

  private async buildPlan(slots: SchedulingSlot[], manualSelections: Map<string, string>, includeExistingAssignments: boolean): Promise<Suggestion[]> {
    const grouped = new Map<string, SchedulingSlot[]>();
    for (const slot of slots) {
      const cycleKey = `${slot.teamId}:${slot.duty.id}`;
      grouped.set(cycleKey, [...(grouped.get(cycleKey) ?? []), slot]);
    }

    const suggestions: Suggestion[] = [];
    for (const [cycleKey, cycleSlots] of grouped.entries()) {
      const sortedSlots = [...cycleSlots].sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());
      const cycleState = await this.buildCycleState(sortedSlots[0].teamId, sortedSlots[0].duty.id, sortedSlots[0].startsAt);
      const cycleLength = Math.max(cycleState.order.length, 1);

      for (const slot of sortedSlots) {
        const existingAssignments = slot.assignments.filter((assignment) => Boolean(assignment.assigneeId));
        const reservedAssigneeIds = new Set(existingAssignments.map((assignment) => assignment.assigneeId).filter((value): value is string => Boolean(value)));
        const requiredVolunteers = Math.max(slot.requiredVolunteers ?? 1, existingAssignments.length, 1);

        for (let demandIndex = 0; demandIndex < requiredVolunteers; demandIndex += 1) {
          const slotDemandKey = `${slot.id}:${demandIndex + 1}`;
          const existingAssignment = existingAssignments[demandIndex] ?? null;
          const manualAssigneeId = manualSelections.get(slotDemandKey) ?? manualSelections.get(slot.id) ?? null;
          const rankedCandidates = await this.rankCandidates(slot, cycleState, manualAssigneeId);
          const candidatePool = rankedCandidates.filter((candidate) => !reservedAssigneeIds.has(candidate.id) || candidate.id === manualAssigneeId);
          const chosenCandidate = manualAssigneeId
            ? candidatePool.find((candidate) => candidate.id === manualAssigneeId) ?? null
            : candidatePool[0] ?? null;

          let coverageStatus: Suggestion['coverageStatus'] = 'open';
          let selectionSource: Suggestion['selectionSource'] = 'open';
          let assigneeId: string | null = null;
          let assigneeName: string | null = null;
          let score: number | null = null;
          let reasons: string[] = [];
          let strategy = 'no-candidate';

          if (existingAssignment && includeExistingAssignments && !manualAssigneeId) {
            coverageStatus = 'covered';
            selectionSource = 'existing';
            assigneeId = existingAssignment.assigneeId ?? null;
            assigneeName = await this.lookupUserName(existingAssignment.assigneeId ?? null);
            strategy = 'keep-existing';
            reasons = ['existing-assignment'];
            this.advanceCycle(cycleState, assigneeId);
          } else if (chosenCandidate) {
            coverageStatus = manualAssigneeId ? 'manual' : 'suggested';
            selectionSource = manualAssigneeId ? 'manual' : 'suggested';
            assigneeId = chosenCandidate.id;
            assigneeName = chosenCandidate.fullName;
            score = chosenCandidate.score;
            reasons = chosenCandidate.reasons;
            strategy = manualAssigneeId ? 'manual-override' : `cycle-score:${chosenCandidate.score}`;
            this.advanceCycle(cycleState, assigneeId);
            reservedAssigneeIds.add(assigneeId);
          }

          suggestions.push({
            slotId: slot.id,
            slotDemandKey,
            slotDemandIndex: demandIndex + 1,
            eventId: slot.event.id,
            eventTitle: slot.event.title,
            teamId: slot.teamId,
            teamName: slot.team.name,
            dutyId: slot.duty.id,
            roleName: slot.duty.name,
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            coverageStatus,
            strategy,
            assigneeId,
            assigneeName,
            score,
            reasons,
            candidates: candidatePool.slice(0, 3),
            cycleKey,
            cycleIndex: cycleState.pointer + 1,
            cycleLength,
            cycleNumber: cycleState.completedTurns + 1,
            selectionSource,
            existingAssignmentId: existingAssignment?.id ?? null,
            existingAssigneeId: existingAssignment?.assigneeId ?? null,
            existingAssigneeName: existingAssignment?.assigneeId ? await this.lookupUserName(existingAssignment.assigneeId) : null,
            drift: {
              status: !existingAssignment && !assigneeId ? 'match' : existingAssignment?.assigneeId === assigneeId ? 'match' : existingAssignment ? 'changed' : 'missing',
              currentAssigneeId: existingAssignment?.assigneeId ?? null,
              currentAssigneeName: existingAssignment?.assigneeId ? await this.lookupUserName(existingAssignment.assigneeId) : null,
            },
          });
        }
      }
    }

    return suggestions.sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());
  }

  private async buildCycleState(teamId: string, dutyId: string, from: Date): Promise<CycleState> {
    const namespaceVersion = await this.schedulingCacheService.currentNamespaceVersion();
    const cacheKey = this.schedulingCacheService.buildAuxiliaryHash({
      teamId,
      dutyId,
      from: from.toISOString(),
      namespaceVersion,
    });
    const cachedState = await this.schedulingCacheService.getCycleState<CycleState>(cacheKey);
    if (cachedState) {
      await this.schedulingCacheService.incrementMetric('cycle_state_cache_hits');
      return cachedState;
    }

    await this.schedulingCacheService.incrementMetric('cycle_state_cache_misses');

    const memberships = await this.prisma.teamMembership.findMany({
      where: { teamId },
      include: {
        duties: true,
        user: {
          include: {
            settings: true,
          },
        },
      },
    } as any) as any[];

    const eligibleMembers = memberships
      .filter((membership) => membership.user?.role === Role.volunteer)
      .filter((membership) => {
        const dutyIds = (membership.duties ?? []).map((item: any) => item.dutyId);
        return dutyIds.length === 0 || dutyIds.includes(dutyId);
      })
      .map((membership) => membership.user);

    const order = eligibleMembers
      .map((user) => ({
        id: user.id,
        fullName: user.fullName,
      }))
      .sort((left, right) => left.fullName.localeCompare(right.fullName, 'it'))
      .map((user) => user.id);

    const recentAssignments = await this.prisma.assignment.findMany({
      where: {
        assigneeId: { not: null },
        slot: {
          teamId,
          dutyId,
          startsAt: { lt: from },
        },
      },
      include: {
        replacements: {
          where: { status: 'APPROVED' },
          include: {
            replacementAssignee: true,
          },
        },
        slot: {
          select: {
            startsAt: true,
          },
        },
      },
      orderBy: {
        slot: {
          startsAt: 'asc',
        },
      },
    } as any) as any[];

    let pointer = 0;
    let completedTurns = 0;
    for (const assignment of recentAssignments) {
      const effectiveAssigneeId = assignment.replacements?.[0]?.replacementAssigneeId ?? assignment.assigneeId;
      if (!effectiveAssigneeId) {
        continue;
      }

      const index = order.indexOf(effectiveAssigneeId);
      if (index === -1) {
        continue;
      }

      pointer = (index + 1) % Math.max(order.length, 1);
      if (index === order.length - 1) {
        completedTurns += 1;
      }

      if (assignment.replacements?.length) {
        pointer = (index + 1) % Math.max(order.length, 1);
      }
    }

    const cycleState = {
      order,
      pointer,
      completedTurns,
    };

    await this.schedulingCacheService.setCycleState(cacheKey, cycleState);
    return cycleState;
  }

  private async rankCandidates(slot: SchedulingSlot, cycleState: CycleState, pinnedAssigneeId: string | null): Promise<Candidate[]> {
    const namespaceVersion = await this.schedulingCacheService.currentNamespaceVersion();
    const cacheKey = this.schedulingCacheService.buildAuxiliaryHash({
      slotId: slot.id,
      teamId: slot.teamId,
      dutyId: slot.duty.id,
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
      pinnedAssigneeId,
      cyclePointer: cycleState.pointer,
      cycleOrder: cycleState.order,
      namespaceVersion,
    });
    const cachedPool = await this.schedulingCacheService.getCandidatePool<Candidate[]>(cacheKey);
    if (cachedPool) {
      await this.schedulingCacheService.incrementMetric('candidate_pool_cache_hits');
      return cachedPool;
    }

    await this.schedulingCacheService.incrementMetric('candidate_pool_cache_misses');

    const memberships = await this.prisma.teamMembership.findMany({
      where: {
        teamId: slot.teamId,
        user: {
          role: Role.volunteer,
        },
      },
      include: {
        duties: true,
        user: {
          include: {
            settings: true,
            assignments: {
              include: {
                slot: {
                  include: {
                    duty: true,
                    team: true,
                  },
                },
              },
            },
          },
        },
      },
    } as any) as any[];

    const ranked: Candidate[] = [];
    for (const membership of memberships) {
      const dutyIds = (membership.duties ?? []).map((item: any) => item.dutyId);
      if (dutyIds.length && !dutyIds.includes(slot.duty.id)) {
        continue;
      }

      const candidate = membership.user;
      const hasConflict = candidate.assignments.some((assignment: any) => {
        const sameDay = new Date(assignment.slot.startsAt).toDateString() === slot.startsAt.toDateString();
        const overlap = assignment.slot.endsAt > slot.startsAt && assignment.slot.startsAt < slot.endsAt;
        return sameDay || overlap;
      });
      if (hasConflict) {
        continue;
      }

      const unavailable = await (this.prisma as any).availability.findFirst({
        where: {
          userId: candidate.id,
          type: 'UNAVAILABLE',
          startsAt: { lt: slot.endsAt },
          endsAt: { gt: slot.startsAt },
        },
      });
      if (unavailable) {
        continue;
      }

      const preferredShifts = this.normalizeScoringValues((candidate.settings?.preferredShifts as string[] | null) ?? [], 'shift');
      const preferredTeamIds = (candidate.settings?.preferredTeamIds as string[] | null) ?? [];
      const preferredDutyIds = (candidate.settings?.preferredDutyIds as string[] | null) ?? [];
      const preferredLocationValues = this.normalizeScoringValues((candidate.settings?.preferredLocationValues as string[] | null) ?? [], 'location');
      const competencies = this.normalizeScoringValues((candidate.settings?.competencies as string[] | null) ?? [], 'competency');
      const shiftCode = this.resolveShiftCode(slot.startsAt);
      const isHoliday = await this.isHoliday(slot.startsAt);
      const eventLocationValue = (slot.event as any).locationValue as string | null | undefined;
      const teamCompetencies = ((slot.team as any).requiredCompetencies as string[] | null) ?? [];
      const dutyCompetencies = ((slot.duty as any).requiredCompetencies as string[] | null) ?? [];
      const cycleIndex = cycleState.order.indexOf(candidate.id);

      let score = 100;
      const reasons: string[] = ['base:100'];
      if (cycleIndex === -1) {
        score -= 40;
        reasons.push('cycle-outside-pool:-40');
      } else {
        const distance = (cycleIndex - cycleState.pointer + cycleState.order.length) % Math.max(cycleState.order.length, 1);
        score += Math.max(0, 40 - distance * 10);
        reasons.push(`cycle-distance:${distance}:=${Math.max(0, 40 - distance * 10)}`);
      }
      if (pinnedAssigneeId === candidate.id) {
        score += 200;
        reasons.push('manual-pin:+200');
      }
      if (preferredTeamIds.includes(slot.teamId)) {
        score += 20;
        reasons.push('preferred-team:+20');
      }
      if (preferredDutyIds.includes(slot.duty.id)) {
        score += 20;
        reasons.push('preferred-duty:+20');
      }
      if (preferredShifts.includes(shiftCode)) {
        score += 10;
        reasons.push(`preferred-shift:${shiftCode}:+10`);
      }
      if (isHoliday && preferredShifts.includes('holiday')) {
        score += 10;
        reasons.push('holiday-match:+10');
      }
      if (eventLocationValue && preferredLocationValues.includes(eventLocationValue)) {
        score += 10;
        reasons.push(`location-match:${eventLocationValue}:+10`);
      }
      const teamCompetencyMatches = teamCompetencies.filter((competency) => competencies.includes(competency));
      const dutyCompetencyMatches = dutyCompetencies.filter((competency) => competencies.includes(competency));
      if (teamCompetencyMatches.length) {
        score += teamCompetencyMatches.length * 10;
        reasons.push(`team-competency-match:+${teamCompetencyMatches.length * 10}`);
      }
      if (dutyCompetencyMatches.length) {
        score += dutyCompetencyMatches.length * 15;
        reasons.push(`duty-competency-match:+${dutyCompetencyMatches.length * 15}`);
      }
      if (teamCompetencies.length && !teamCompetencyMatches.length) {
        score -= 20;
        reasons.push('missing-team-competency:-20');
      }
      if (dutyCompetencies.length && !dutyCompetencyMatches.length) {
        score -= 35;
        reasons.push('missing-duty-competency:-35');
      }
      if (competencies.some((competency) => slot.duty.name.toLowerCase().includes(competency.toLowerCase()) || competency.toLowerCase().includes(slot.duty.name.toLowerCase()))) {
        score += 15;
        reasons.push('competency-match:+15');
      }

      ranked.push({
        id: candidate.id,
        fullName: candidate.fullName,
        score,
        reasons,
      });
    }

    const sortedCandidates = ranked.sort((left, right) => right.score - left.score || left.fullName.localeCompare(right.fullName, 'it'));
    await this.schedulingCacheService.setCandidatePool(cacheKey, sortedCandidates);
    return sortedCandidates;
  }

  private advanceCycle(cycleState: CycleState, assigneeId: string | null): void {
    if (!assigneeId || !cycleState.order.length) {
      return;
    }

    const index = cycleState.order.indexOf(assigneeId);
    if (index === -1) {
      return;
    }

    cycleState.pointer = (index + 1) % cycleState.order.length;
    if (cycleState.pointer === 0) {
      cycleState.completedTurns += 1;
    }
  }

  private matchesApplyScope(item: Suggestion, anchor: Suggestion, applyScope: 'event' | 'month' | 'cycle' | 'year' | 'all'): boolean {
    const itemStart = new Date(item.startsAt);
    const anchorStart = new Date(anchor.startsAt);

    if (applyScope === 'all') {
      return true;
    }
    if (applyScope === 'event') {
      return item.eventId === anchor.eventId;
    }
    if (applyScope === 'month') {
      return itemStart.getFullYear() === anchorStart.getFullYear() && itemStart.getMonth() === anchorStart.getMonth();
    }
    if (applyScope === 'year') {
      return itemStart.getFullYear() === anchorStart.getFullYear();
    }

    return item.cycleKey === anchor.cycleKey && item.cycleNumber === anchor.cycleNumber;
  }

  private async shouldQueuePreview(payload: GenerateScheduleDto, allowAsync: boolean): Promise<boolean> {
    if (!allowAsync) {
      return false;
    }

    const from = new Date(payload.from);
    const to = new Date(payload.to);
    const rangeDays = Number.isFinite(from.getTime()) && Number.isFinite(to.getTime())
      ? Math.max(0, Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;
    const manualSelections = payload.manualSelections?.length ?? 0;

    const runtimeSettings = await this.loadSchedulingRuntimeSettings();
    const maxRangeDays = runtimeSettings.asyncRangeDays;
    const maxManualSelections = runtimeSettings.asyncManualSelections;
    const alwaysAsyncWithoutEvent = runtimeSettings.asyncWithoutEvent;

    return (alwaysAsyncWithoutEvent && !payload.eventId) || rangeDays > maxRangeDays || manualSelections > maxManualSelections;
  }

  private async loadSchedulingRuntimeSettings(): Promise<{ retryCount: number; asyncRangeDays: number; asyncManualSelections: number; asyncWithoutEvent: boolean }> {
    const settings = await this.prisma.aiSetting.findUnique({ where: { id: 'global' } } as any) as any;
    return {
      retryCount: Number(settings?.schedulingPreviewRetryCount ?? process.env.SCHEDULING_PREVIEW_RETRY_COUNT ?? 20),
      asyncRangeDays: Number(settings?.schedulingAsyncRangeDays ?? process.env.SCHEDULING_ASYNC_RANGE_DAYS ?? 14),
      asyncManualSelections: Number(settings?.schedulingAsyncManualSelections ?? process.env.SCHEDULING_ASYNC_MANUAL_SELECTIONS ?? 20),
      asyncWithoutEvent: Boolean(settings?.schedulingAsyncWithoutEvent ?? (process.env.SCHEDULING_ASYNC_WITHOUT_EVENT !== 'false')),
    };
  }

  async metrics(actorId: string, actorRole: Role) {
    if (actorRole !== Role.administrator && actorRole !== Role.service_leader) {
      throw new ForbiddenException('Non autorizzato');
    }

    const metricNames = [
      'preview_cache_hits',
      'preview_cache_misses',
      'preview_queue_dedup_hits',
      'preview_queued',
      'preview_completed',
      'preview_failed',
      'preview_duration_total_ms',
      'preview_duration_samples',
      'cycle_state_cache_hits',
      'cycle_state_cache_misses',
      'candidate_pool_cache_hits',
      'candidate_pool_cache_misses',
      'last_reset_at_ms',
    ];
    const metrics = await this.schedulingCacheService.getMetrics(metricNames);
    const plansCount = await (this.prisma as any).schedulingPlan.count({});
    const queuedJobs = await (this.prisma as any).backgroundJob.count({ where: { entityType: 'schedulePreview', status: 'queued' } });
    const runningJobs = await (this.prisma as any).backgroundJob.count({ where: { entityType: 'schedulePreview', status: 'running' } });
    const avgDurationMs = metrics.preview_duration_samples > 0 ? Math.round(metrics.preview_duration_total_ms / metrics.preview_duration_samples) : 0;
    const previewRequests = metrics.preview_cache_hits + metrics.preview_cache_misses;
    const cacheHitRate = previewRequests > 0 ? metrics.preview_cache_hits / previewRequests : 0;

    await this.recordAudit('scheduling.metrics.read', actorId, 'scheduling', { previewRequests, cacheHitRate });

    return {
      previewRequests,
      previewCacheHits: metrics.preview_cache_hits,
      previewCacheMisses: metrics.preview_cache_misses,
      previewCacheHitRate: cacheHitRate,
      queueDedupHits: metrics.preview_queue_dedup_hits,
      queuedJobs,
      runningJobs,
      completedPreviews: metrics.preview_completed,
      failedPreviews: metrics.preview_failed,
      averagePreviewDurationMs: avgDurationMs,
      cycleStateCacheHits: metrics.cycle_state_cache_hits,
      cycleStateCacheMisses: metrics.cycle_state_cache_misses,
      candidatePoolCacheHits: metrics.candidate_pool_cache_hits,
      candidatePoolCacheMisses: metrics.candidate_pool_cache_misses,
      plansPersisted: plansCount,
      lastResetAt: metrics.last_reset_at_ms ? new Date(metrics.last_reset_at_ms).toISOString() : null,
    };
  }

  async resetMetrics(actorId: string, actorRole: Role) {
    if (actorRole !== Role.administrator) {
      throw new ForbiddenException('Non autorizzato');
    }

    await this.schedulingCacheService.resetMetrics([
      'preview_cache_hits',
      'preview_cache_misses',
      'preview_queue_dedup_hits',
      'preview_queued',
      'preview_completed',
      'preview_failed',
      'preview_duration_total_ms',
      'preview_duration_samples',
      'cycle_state_cache_hits',
      'cycle_state_cache_misses',
      'candidate_pool_cache_hits',
      'candidate_pool_cache_misses',
    ]);

    await this.recordAudit('scheduling.metrics.reset', actorId, 'scheduling', {});

    return { ok: true, resetAt: new Date().toISOString() };
  }

  private toQueuedResponse(jobId: string, message: string) {
    return {
      planId: undefined,
      status: 'queued' as const,
      jobId,
      cacheHit: false,
      message,
      criteria: ['cycle-rotation', 'availability', 'skills', 'manual-overrides', 'replacement-awareness'],
      generatedAt: new Date().toISOString(),
      anchorEventId: '',
      suggestions: [],
      summary: {
        events: 0,
        slots: 0,
        covered: 0,
        proposed: 0,
        open: 0,
        changed: 0,
        missing: 0,
      },
    };
  }

  private toResponse(planId: string | null, anchorEventId: string, suggestions: Suggestion[], message: string, invalidatedAt: Date | null = null, invalidationReason: string | null = null, anchorEventTitle?: string) {
    return {
      planId: planId ?? undefined,
      message,
      criteria: ['cycle-rotation', 'availability', 'skills', 'manual-overrides', 'replacement-awareness'],
      generatedAt: new Date().toISOString(),
      anchorEventId,
      anchorEventTitle,
      invalidatedAt: invalidatedAt?.toISOString() ?? null,
      invalidationReason,
      suggestions: suggestions.map((item) => ({
        ...item,
        startsAt: item.startsAt.toISOString(),
        endsAt: item.endsAt.toISOString(),
      })),
      summary: {
        events: new Set(suggestions.map((item) => item.eventId)).size,
        slots: suggestions.length,
        covered: suggestions.filter((item) => item.coverageStatus === 'covered').length,
        proposed: suggestions.filter((item) => item.coverageStatus === 'suggested' || item.coverageStatus === 'manual').length,
        open: suggestions.filter((item) => item.coverageStatus === 'open').length,
        changed: suggestions.filter((item) => item.drift?.status === 'changed').length,
        missing: suggestions.filter((item) => item.drift?.status === 'missing').length,
      },
    };
  }

  private toPersistedResponse(plan: PlanRecord, message: string) {
    const suggestions = plan.items.map((item) => ({
      slotId: item.slotId,
      slotDemandKey: item.slotDemandKey,
      slotDemandIndex: item.slotDemandIndex,
      eventId: item.eventId,
      eventTitle: item.eventTitle,
      teamId: item.teamId,
      teamName: item.teamName,
      dutyId: item.dutyId,
      roleName: item.roleName,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      coverageStatus: item.coverageStatus as Suggestion['coverageStatus'],
      strategy: item.strategy,
      assigneeId: item.assigneeId,
      assigneeName: item.assigneeName,
      score: item.score,
      reasons: Array.isArray(item.reasons) ? item.reasons as string[] : [],
      candidates: Array.isArray(item.candidates) ? item.candidates as Candidate[] : [],
      cycleKey: item.cycleKey,
      cycleIndex: item.cycleIndex,
      cycleLength: item.cycleLength,
      cycleNumber: item.cycleNumber,
      selectionSource: item.selectionSource as Suggestion['selectionSource'],
      existingAssignmentId: item.existingAssignmentId,
      existingAssigneeId: item.existingAssigneeId,
      existingAssigneeName: item.existingAssigneeName,
      drift: item.drift,
    }));

    return this.toResponse(plan.id, plan.anchorEventId, suggestions, message, plan.invalidatedAt, plan.invalidationReason, plan.anchorEventTitle);
  }

  private async savePlan(
    payload: GenerateScheduleDto,
    actorId: string,
    suggestions: Suggestion[],
    applyScope: string | null
  ) {
    const summary = {
      events: new Set(suggestions.map((item) => item.eventId)).size,
      slots: suggestions.length,
      covered: suggestions.filter((item) => item.coverageStatus === 'covered').length,
      proposed: suggestions.filter((item) => item.coverageStatus === 'suggested' || item.coverageStatus === 'manual').length,
      open: suggestions.filter((item) => item.coverageStatus === 'open').length,
      changed: suggestions.filter((item) => item.drift?.status === 'changed').length,
      missing: suggestions.filter((item) => item.drift?.status === 'missing').length,
    };

    if (payload.planId) {
      await this.prisma.schedulingPlanItem.deleteMany({ where: { planId: payload.planId } } as any);
      return this.prisma.schedulingPlan.update({
        where: { id: payload.planId },
        data: {
          anchorEventId: payload.eventId ?? '',
          anchorEventTitle: await this.lookupEventTitle(payload.eventId ?? ''),
          from: new Date(payload.from),
          to: new Date(payload.to),
          scope: payload.scope ?? 'single',
          applyScope: applyScope ?? undefined,
          criteria: toJsonValue(['cycle-rotation', 'availability', 'skills', 'manual-overrides', 'replacement-awareness']),
          summary: toJsonValue(summary),
          manualSelections: toJsonValue(payload.manualSelections ?? []),
          invalidatedAt: null,
          invalidationReason: null,
          items: {
            create: suggestions.map((item) => this.mapPlanItem(item)),
          },
        },
      } as any);
    }

    return this.prisma.schedulingPlan.create({
      data: {
        actorId,
        anchorEventId: payload.eventId ?? '',
        anchorEventTitle: await this.lookupEventTitle(payload.eventId ?? ''),
        from: new Date(payload.from),
        to: new Date(payload.to),
        scope: payload.scope ?? 'single',
        applyScope: applyScope ?? undefined,
        criteria: toJsonValue(['cycle-rotation', 'availability', 'skills', 'manual-overrides', 'replacement-awareness']),
        summary: toJsonValue(summary),
        manualSelections: toJsonValue(payload.manualSelections ?? []),
        items: {
          create: suggestions.map((item) => this.mapPlanItem(item)),
        },
      },
    } as any);
  }

  private mapPlanItem(item: Suggestion) {
    return {
      slotId: item.slotId,
      slotDemandKey: item.slotDemandKey,
      slotDemandIndex: item.slotDemandIndex,
      eventId: item.eventId,
      eventTitle: item.eventTitle,
      teamId: item.teamId,
      teamName: item.teamName,
      dutyId: item.dutyId,
      roleName: item.roleName,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      coverageStatus: item.coverageStatus,
      strategy: item.strategy,
      assigneeId: item.assigneeId,
      assigneeName: item.assigneeName,
      score: item.score ?? undefined,
      reasons: toJsonValue(item.reasons ?? []),
      candidates: toJsonValue(item.candidates ?? []),
      cycleKey: item.cycleKey,
      cycleIndex: item.cycleIndex,
      cycleLength: item.cycleLength,
      cycleNumber: item.cycleNumber,
      selectionSource: item.selectionSource,
      existingAssignmentId: item.existingAssignmentId,
      existingAssigneeId: item.existingAssigneeId,
      existingAssigneeName: item.existingAssigneeName,
    };
  }

  private readSummary(value: unknown) {
    if (!value || typeof value !== 'object') {
      return { events: 0, slots: 0, covered: 0, proposed: 0, open: 0 };
    }

    const summary = value as Record<string, unknown>;
    return {
      events: Number(summary.events ?? 0),
      slots: Number(summary.slots ?? 0),
      covered: Number(summary.covered ?? 0),
      proposed: Number(summary.proposed ?? 0),
      open: Number(summary.open ?? 0),
      changed: Number(summary.changed ?? 0),
      missing: Number(summary.missing ?? 0),
    };
  }

  private async lookupEventTitle(eventId: string): Promise<string> {
    if (!eventId) {
      return 'Planning';
    }

    const event = await this.prisma.event.findUnique({ where: { id: eventId }, select: { title: true } } as any);
    return event?.title ?? 'Planning';
  }

  private normalizeSelections(selections: Array<ManualSelection | null | undefined> | undefined): Map<string, string> {
    return new Map(
      (selections ?? [])
        .filter((selection): selection is ManualSelection => Boolean(selection?.slotId && selection?.assigneeId))
        .map((selection) => [((selection as ManualSelection & { slotDemandKey?: string }).slotDemandKey ?? selection.slotId), selection.assigneeId])
    );
  }

  private async lookupUserName(userId: string | null): Promise<string | null> {
    if (!userId) {
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true },
    });

    return user?.fullName ?? null;
  }

  private async recordAudit(action: string, actorId: string, entityId: string, metadata: Record<string, unknown>) {
    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action,
        entityType: 'schedulePlan',
        entityId,
        metadata: toJsonValue(metadata),
      },
    });
  }

  private resolveShiftCode(startsAt: Date): string {
    const hour = startsAt.getHours();
    if (hour < 12) {
      return 'morning';
    }
    if (hour < 18) {
      return 'afternoon';
    }
    return 'evening';
  }

  private normalizeScoringValues(values: string[], type: 'shift' | 'competency' | 'location'): string[] {
    const normalized = Array.from(new Set(
      (values ?? [])
        .map((value) => String(value).trim())
        .filter((value) => value.length > 0)
    ));

    if (type === 'shift') {
      return normalized.filter((value) => ['morning', 'afternoon', 'evening', 'holiday'].includes(value));
    }

    return normalized;
  }

  private async isHoliday(startsAt: Date): Promise<boolean> {
    const date = new Date(startsAt);
    date.setHours(0, 0, 0, 0);
    const holiday = await (this.prisma as any).holidayCalendarDay.findUnique({ where: { date } });
    return Boolean(holiday?.isPublicHoliday);
  }
}
