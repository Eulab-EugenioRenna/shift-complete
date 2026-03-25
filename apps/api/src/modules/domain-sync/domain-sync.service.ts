import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PrismaService } from '../../database/prisma.service';

type SyncPayload = {
  action: string;
  entityId: string;
  eventIds?: string[];
  teamIds?: string[];
  userIds?: string[];
  startsAt?: Date | null;
  endsAt?: Date | null;
  reason?: string;
};

@Injectable()
export class DomainSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway
  ) {}

  async syncEventMutation(payload: SyncPayload) {
    const eventIds = Array.from(new Set(payload.eventIds?.filter(Boolean) ?? []));
    await this.invalidatePlansForEvents(eventIds, payload.reason ?? payload.action);

    this.realtimeGateway.broadcastEventsChanged({ ...payload, eventIds, timestamp: new Date().toISOString() });
    this.broadcastPlannerInvalidated(payload, eventIds);
    this.realtimeGateway.broadcastStatsChanged({ source: 'events', ...payload, eventIds, timestamp: new Date().toISOString() });
  }

  async syncAssignmentMutation(payload: SyncPayload) {
    const eventIds = Array.from(new Set(payload.eventIds?.filter(Boolean) ?? []));
    await this.invalidatePlansForEvents(eventIds, payload.reason ?? payload.action);

    this.realtimeGateway.broadcastAssignmentsChanged({ ...payload, eventIds, timestamp: new Date().toISOString() });
    this.broadcastPlannerInvalidated(payload, eventIds);
    this.realtimeGateway.broadcastStatsChanged({ source: 'assignments', ...payload, eventIds, timestamp: new Date().toISOString() });
  }

  async syncReplacementMutation(payload: SyncPayload) {
    const eventIds = Array.from(new Set(payload.eventIds?.filter(Boolean) ?? []));
    await this.invalidatePlansForEvents(eventIds, payload.reason ?? payload.action);

    this.realtimeGateway.broadcastReplacementsChanged({ ...payload, eventIds, timestamp: new Date().toISOString() });
    this.broadcastPlannerInvalidated(payload, eventIds);
    this.realtimeGateway.broadcastStatsChanged({ source: 'replacements', ...payload, eventIds, timestamp: new Date().toISOString() });
  }

  async syncAvailabilityMutation(payload: SyncPayload) {
    await this.invalidatePlansForWindow(payload);

    this.realtimeGateway.broadcastAvailabilityChanged({ ...payload, timestamp: new Date().toISOString() });
    this.broadcastPlannerWindowInvalidated(payload);
    this.realtimeGateway.broadcastStatsChanged({ source: 'availability', ...payload, timestamp: new Date().toISOString() });
  }

  async syncPlanningContextMutation(payload: SyncPayload) {
    await this.invalidatePlansForWindow(payload);

    this.broadcastPlannerWindowInvalidated(payload);
    this.realtimeGateway.broadcastStatsChanged({ source: 'planning-context', ...payload, timestamp: new Date().toISOString() });
  }

  private async invalidatePlansForEvents(eventIds: string[], reason: string) {
    if (!eventIds.length) {
      return;
    }

    await (this.prisma as any).schedulingPlan.updateMany({
      where: {
        anchorEventId: { in: eventIds },
        invalidatedAt: null,
      },
      data: {
        invalidatedAt: new Date(),
        invalidationReason: reason,
      },
    });
  }

  private async invalidatePlansForWindow(payload: SyncPayload) {
    const startsAt = payload.startsAt ?? undefined;
    const endsAt = payload.endsAt ?? undefined;
    const teamIds = payload.teamIds?.filter(Boolean) ?? [];

    const where: Record<string, unknown> = { invalidatedAt: null };
    if (startsAt || endsAt) {
      where['OR'] = [
        {
          from: {
            lte: endsAt ?? new Date('9999-12-31T23:59:59.999Z'),
          },
          to: {
            gte: startsAt ?? new Date('1970-01-01T00:00:00.000Z'),
          },
        },
      ];
    }

    if (teamIds.length) {
      where['items'] = {
        some: {
          teamId: { in: teamIds },
        },
      };
    }

    await (this.prisma as any).schedulingPlan.updateMany({
      where,
      data: {
        invalidatedAt: new Date(),
        invalidationReason: payload.reason ?? payload.action,
      },
    });
  }

  private broadcastPlannerWindowInvalidated(payload: SyncPayload) {
    this.realtimeGateway.broadcastSchedulingUpdate({
      kind: 'planner.invalidated',
      action: payload.action,
      entityId: payload.entityId,
      reason: payload.reason ?? payload.action,
      teamIds: payload.teamIds ?? [],
      userIds: payload.userIds ?? [],
      startsAt: payload.startsAt?.toISOString() ?? null,
      endsAt: payload.endsAt?.toISOString() ?? null,
      timestamp: new Date().toISOString(),
    });
  }

  private broadcastPlannerInvalidated(payload: SyncPayload, eventIds: string[]) {
    this.realtimeGateway.broadcastSchedulingUpdate({
      kind: 'planner.invalidated',
      action: payload.action,
      entityId: payload.entityId,
      reason: payload.reason ?? payload.action,
      eventIds,
      teamIds: payload.teamIds ?? [],
      userIds: payload.userIds ?? [],
      timestamp: new Date().toISOString(),
    });
  }
}
