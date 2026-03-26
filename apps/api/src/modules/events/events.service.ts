import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { toJsonValue } from '../../common/utils/json.util';
import { PrismaService } from '../../database/prisma.service';
import { CreateEventDto, UpdateEventDto, AssignVolunteerDto } from '@shift-complete/shared-types';
import { DomainSyncService } from '../domain-sync/domain-sync.service';
import { NotificationsService } from '../notifications/notifications.service';

const RECURRENCE_LOOKAHEAD_MONTHS = 12;
const MAX_RECURRING_OCCURRENCES = 520;
const DEFAULT_RECURRENCE_DURATION_MONTHS = 12;

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly domainSync: DomainSyncService
  ) {}

  list(actorId: string, actorRole: Role) {
    const where = actorRole === Role.administrator
      ? undefined
      : actorRole === Role.service_leader
        ? {
            slots: {
              some: {
                team: {
                  leaderId: actorId
                }
              }
            }
          }
        : {
            slots: {
              some: {
                assignments: {
                  some: {
                    assigneeId: actorId
                  }
                }
              }
            }
          };

    return this.ensureRecurringCoverage().then(() => this.prisma.event.findMany({
      where,
      include: {
        parentEvent: {
          include: {
            slots: {
              include: {
                team: {
                  select: {
                    id: true,
                    name: true,
                    leaderId: true
                  }
                },
                duty: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        },
        slots: {
          include: {
            assignments: {
              include: {
                assignee: {
                  select: {
                    id: true,
                    fullName: true,
                    email: true
                  }
                },
                replacements: {
                  where: {
                    status: 'APPROVED'
                  },
                  select: {
                    id: true,
                    status: true
                  }
                }
              }
            },
            team: {
              select: {
                id: true,
                name: true,
                leaderId: true
              }
            },
            duty: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        startsAt: 'asc'
      }
    })).then((events) =>
      this.expandRecurringEvents(events).map((event) => {
        const visibleSlots = event.slots
          .map((slot) => ({
            ...slot,
            assignments: slot.assignments.filter((assignment) =>
              actorRole === Role.administrator
                ? true
                : actorRole === Role.service_leader
                  ? slot.team?.leaderId === actorId
                  : assignment.assigneeId === actorId
            )
          }))
          .filter((slot) =>
            actorRole === Role.administrator
              ? true
              : actorRole === Role.service_leader
                ? slot.team?.leaderId === actorId
                : slot.assignments.length > 0
          );

        return {
          id: event.id,
          seriesId: event.seriesId,
          parentEventId: event.parentEventId,
          title: event.title,
          description: event.description,
          color: event.color,
          icon: event.icon,
          locationValue: event.locationValue,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          type: event.type,
          recurrenceRule: event.recurrenceRule,
          recurrenceTz: event.recurrenceTz,
          recurrenceUntil: event.recurrenceUntil,
          recurrenceDurationMonths: event.recurrenceDurationMonths,
          recurrenceAutoRenew: event.recurrenceAutoRenew,
          recurrenceRenewMonths: event.recurrenceRenewMonths,
          occurrenceStart: event.occurrenceStart,
          isOccurrence: event.isOccurrence,
          isVirtualOccurrence: event.isVirtualOccurrence,
          canManageAssignments: !event.isVirtualOccurrence,
          seriesTemplate: event.seriesTemplate,
          slots: visibleSlots.map((slot) => ({
            id: slot.id,
            dutyId: slot.dutyId,
            roleName: slot.duty?.name,
            teamId: slot.teamId,
            teamName: slot.team?.name,
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            requiredVolunteers: slot.requiredVolunteers,
            assignments: slot.assignments.map((assignment) => ({
              id: assignment.id,
              assigneeId: assignment.assigneeId,
              status: assignment.status,
              assignee: assignment.assignee,
              replacementApproved: assignment.replacements.length > 0
            }))
          })),
          assignments: visibleSlots.flatMap((slot) =>
          slot.assignments.map((assignment) => ({
            id: assignment.id,
            eventId: event.id,
            slotId: slot.id,
            roleName: slot.duty?.name,
            team: slot.team?.name,
            status: assignment.status,
            assignee: assignment.assignee?.fullName ?? null
          }))
          )
        };
      })
    );
  }

  async create(payload: CreateEventDto, actorId: string, actorRole: Role) {
    if (actorRole === Role.service_leader) {
      const allowedTeamIds = await this.findLeaderTeamIds(actorId);
      const disallowedSlot = payload.slots.find((slot) => !allowedTeamIds.includes(slot.teamId));
      if (disallowedSlot) {
        throw new ForbiddenException('Il leader puo creare eventi solo per i propri team');
      }
    }

    const startsAt = new Date(payload.startsAt);
    const endsAt = new Date(payload.endsAt);
    const recurrence = this.buildRecurringSettings(payload.type, startsAt, payload);

    const event = await this.prisma.event.create({
      data: {
        title: payload.title,
        description: payload.description,
        type: payload.type as any, // mapping between string and enum
        locationValue: payload.locationValue,
        startsAt,
        endsAt,
        recurrenceRule: recurrence.recurrenceRule,
        recurrenceTz: recurrence.recurrenceTz,
        recurrenceUntil: recurrence.recurrenceUntil as any,
        recurrenceDurationMonths: recurrence.recurrenceDurationMonths,
        recurrenceAutoRenew: recurrence.recurrenceAutoRenew,
        recurrenceRenewMonths: recurrence.recurrenceRenewMonths,
        createdById: actorId,
        slots: {
          create: payload.slots.map((slot) => ({
            team: {
              connect: {
                id: slot.teamId
              }
            },
            duty: {
              connect: {
                id: slot.dutyId
              }
            },
            startsAt: new Date(slot.startsAt),
            endsAt: new Date(slot.endsAt),
            required: slot.required ?? true,
            requiredVolunteers: slot.requiredVolunteers ?? 1,
          }))
        }
      } as any,
      include: {
        slots: true
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'event.created',
        entityType: 'event',
        entityId: event.id,
        metadata: toJsonValue(payload)
      }
    });

    await this.domainSync.syncEventMutation({
      action: 'event.created',
      entityId: event.id,
      eventIds: [event.id],
      teamIds: payload.slots.map((slot) => slot.teamId),
      startsAt,
      endsAt,
      reason: 'event-created',
    });

    return event;
  }

  async assignVolunteer(payload: AssignVolunteerDto, actorId: string, actorRole: Role) {
    const slot = await this.prisma.eventSlot.findUniqueOrThrow({
      where: { id: payload.slotId },
      include: {
        team: true,
        duty: true,
        event: {
          select: {
            title: true,
          },
        },
        assignments: true
      }
    });

    if (actorRole === Role.service_leader) {
      const allowedTeamIds = await this.findLeaderTeamIds(actorId);
      if (!allowedTeamIds.includes(slot.teamId)) {
        throw new ForbiddenException('Il leader puo assegnare solo i ruoli dei propri team');
      }
    }

    if (payload.assigneeId) {
      const membership = await this.prisma.teamMembership.findUnique({
        where: {
          teamId_userId: {
            teamId: slot.teamId,
            userId: payload.assigneeId
          }
        }
      });

      if (!membership) {
        throw new ForbiddenException('Puoi assegnare solo persone presenti nel team dello slot');
      }

      const startOfDay = new Date(slot.startsAt);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(slot.startsAt);
      endOfDay.setHours(23, 59, 59, 999);

      const conflictingAssignment = await this.prisma.assignment.findFirst({
        where: {
          assigneeId: payload.assigneeId,
          slot: {
            startsAt: {
              gte: startOfDay,
              lte: endOfDay
            },
            teamId: {
              not: slot.teamId
            }
          }
        },
        include: {
          slot: {
            include: {
              team: true
            }
          }
        }
      });

      if (conflictingAssignment) {
        throw new ForbiddenException(`L'utente ha gia un servizio nel team ${conflictingAssignment.slot.team.name} nello stesso giorno`);
      }

      const conflictingAvailability = await this.prisma.availability.findFirst({
        where: {
          userId: payload.assigneeId,
          type: 'UNAVAILABLE',
          startsAt: {
            lt: slot.endsAt
          },
          endsAt: {
            gt: slot.startsAt
          }
        }
      });

      if (conflictingAvailability) {
        throw new ForbiddenException('L\'utente non e disponibile nella fascia oraria del servizio');
      }
    }

    const existingAssignment = await this.prisma.assignment.findFirst({
      where: {
        slotId: payload.slotId,
        assigneeId: payload.assigneeId ?? null
      }
    });

    const requiredVolunteers = (slot as any).requiredVolunteers ?? 1;
    const assignedVolunteerCount = slot.assignments.filter((assignment) => Boolean(assignment.assigneeId)).length;
    if (payload.assigneeId && !existingAssignment && assignedVolunteerCount >= requiredVolunteers) {
      throw new ForbiddenException(`La mansione richiede al massimo ${requiredVolunteers} volontari per questo evento`);
    }

    const assignment = existingAssignment
      ? await this.prisma.assignment.update({
          where: { id: existingAssignment.id },
          data: {
            status: payload.status as any ?? existingAssignment.status,
            autoAssigned: payload.autoAssigned ?? existingAssignment.autoAssigned
          }
        })
      : await this.prisma.assignment.create({
      data: {
        slotId: payload.slotId,
        assigneeId: payload.assigneeId,
        status: payload.status as any ?? 'assigned',
        autoAssigned: Boolean(payload.autoAssigned)
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: existingAssignment ? 'assignment.updated' : 'assignment.created',
        entityType: 'assignment',
        entityId: assignment.id,
        metadata: toJsonValue(payload)
      }
    });

    const eventSlot = await this.prisma.eventSlot.findUnique({
      where: { id: payload.slotId },
      select: { eventId: true, teamId: true, startsAt: true, endsAt: true },
    });

    await this.domainSync.syncAssignmentMutation({
      action: existingAssignment ? 'assignment.updated' : 'assignment.created',
      entityId: assignment.id,
      eventIds: eventSlot?.eventId ? [eventSlot.eventId] : [],
      teamIds: eventSlot?.teamId ? [eventSlot.teamId] : [],
      userIds: payload.assigneeId ? [payload.assigneeId] : [],
      startsAt: eventSlot?.startsAt ?? null,
      endsAt: eventSlot?.endsAt ?? null,
      reason: existingAssignment ? 'manual-assignment-updated' : 'manual-assignment-created',
    });

    if (payload.assigneeId) {
      const dutyLabel = slot.duty?.name || 'servizio';
      const eventLabel = slot.event?.title ? ` per ${slot.event.title}` : '';
      await this.notificationsService.pushSystemNotification(
        payload.assigneeId,
        'Nuova assegnazione turno',
        `Sei stato assegnato al servizio ${dutyLabel} del team ${slot.team.name}${eventLabel}.`,
        '/events',
        { template: 'assignment', teamName: slot.team.name, dutyName: dutyLabel, eventTitle: slot.event?.title }
      );
    }

    return assignment;
  }

  async update(eventId: string, payload: UpdateEventDto & { editMode?: 'single' | 'series'; occurrenceStart?: string }, actorId: string, actorRole: Role) {
    const eventRef = this.resolveEventReference(eventId, payload.occurrenceStart);

    if (payload.editMode === 'single' && eventRef.occurrenceStart) {
      return this.updateSingleOccurrence(eventRef.eventId, { ...payload, occurrenceStart: eventRef.occurrenceStart } as UpdateEventDto & { occurrenceStart: string }, actorId, actorRole);
    }

    await this.ensureRecurringCoverage(undefined, eventRef.eventId);

    const event = await this.prisma.event.findUniqueOrThrow({
      where: { id: eventRef.eventId },
      include: { slots: true, parentEvent: { include: { slots: true } } }
    });
    const targetEvent = payload.editMode === 'series' && event.parentEventId && event.parentEvent ? event.parentEvent : event;
    const recurrence = this.buildRecurringSettings(payload.type ?? targetEvent.type, payload.startsAt ? new Date(payload.startsAt) : new Date(targetEvent.startsAt), payload, targetEvent);

    await this.assertEventAccess(targetEvent, actorId, actorRole);

    if (actorRole === Role.service_leader && payload.slots?.length) {
      const allowedTeamIds = await this.findLeaderTeamIds(actorId);
      const disallowedSlot = payload.slots.find((slot) => !allowedTeamIds.includes(slot.teamId));
      if (disallowedSlot) {
        throw new ForbiddenException('Il leader puo aggiornare eventi solo per i propri team');
      }
    }

    const updated = await this.prisma.event.update({
      where: { id: targetEvent.id },
      data: {
        title: payload.title,
        description: payload.description,
        type: payload.type as any,
        locationValue: payload.locationValue,
        startsAt: payload.startsAt ? new Date(payload.startsAt) : undefined,
        endsAt: payload.endsAt ? new Date(payload.endsAt) : undefined,
        recurrenceRule: recurrence.recurrenceRule,
        recurrenceTz: recurrence.recurrenceTz,
        recurrenceUntil: recurrence.recurrenceUntil as any,
        recurrenceDurationMonths: recurrence.recurrenceDurationMonths,
        recurrenceAutoRenew: recurrence.recurrenceAutoRenew,
        recurrenceRenewMonths: recurrence.recurrenceRenewMonths,
        slots: payload.slots
          ? {
              deleteMany: {},
              create: payload.slots.map((slot) => ({
                team: {
                  connect: {
                    id: slot.teamId
                  }
                },
                duty: {
                  connect: {
                    id: slot.dutyId
                  }
                },
                startsAt: new Date(slot.startsAt),
                endsAt: new Date(slot.endsAt),
                required: slot.required ?? true,
                requiredVolunteers: slot.requiredVolunteers ?? 1,
              }))
            }
          : undefined
      } as any
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'event.updated',
        entityType: 'event',
        entityId: targetEvent.id,
        metadata: toJsonValue(payload)
      }
    });

    await this.domainSync.syncEventMutation({
      action: 'event.updated',
      entityId: targetEvent.id,
      eventIds: [targetEvent.id],
      teamIds: payload.slots?.map((slot) => slot.teamId) ?? targetEvent.slots.map((slot: any) => slot.teamId),
      startsAt: payload.startsAt ? new Date(payload.startsAt) : new Date(targetEvent.startsAt),
      endsAt: payload.endsAt ? new Date(payload.endsAt) : new Date(targetEvent.endsAt),
      reason: 'event-updated',
    });

    const assignments = await this.prisma.assignment.findMany({
      where: { slot: { eventId: targetEvent.id } },
      select: { assigneeId: true }
    });
    const assigneeIds = Array.from(new Set(assignments.map((item) => item.assigneeId).filter((id): id is string => Boolean(id))));
    await Promise.all(assigneeIds.map((assigneeId) =>
      this.notificationsService.pushSystemNotification(
        assigneeId,
        'Turno aggiornato',
        `L'evento ${updated.title} a cui sei assegnato e stato aggiornato. Verifica data, orario o dettagli del servizio.`,
        '/events',
        { template: 'assignment', eventTitle: updated.title }
      )
    ));

    return updated;
  }

  async remove(eventId: string, actorId: string, actorRole: Role, mode?: 'single' | 'series', occurrenceStart?: string) {
    const eventRef = this.resolveEventReference(eventId, occurrenceStart);

    if (mode === 'single' && eventRef.occurrenceStart) {
      return this.removeSingleOccurrence(eventRef.eventId, eventRef.occurrenceStart, actorId, actorRole);
    }

    await this.ensureRecurringCoverage(undefined, eventRef.eventId);

    const event = await this.prisma.event.findUniqueOrThrow({
      where: { id: eventRef.eventId },
      include: {
        parentEvent: {
          include: {
            slots: true
          }
        },
        slots: {
          include: {
            assignments: {
              select: { assigneeId: true }
            }
          }
        }
      }
    });

    const targetEvent = mode === 'series' && event.parentEventId && event.parentEvent ? {
      ...event.parentEvent,
      slots: event.parentEvent.slots,
    } : event;

    await this.assertEventAccess(targetEvent, actorId, actorRole);
    await this.prisma.event.delete({ where: { id: targetEvent.id } });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'event.deleted',
        entityType: 'event',
        entityId: targetEvent.id,
        metadata: toJsonValue({ eventId: targetEvent.id, mode: mode ?? 'single' })
      }
    });

    await this.domainSync.syncEventMutation({
      action: 'event.deleted',
      entityId: targetEvent.id,
      eventIds: [targetEvent.id],
      teamIds: targetEvent.slots.map((slot: any) => slot.teamId),
      startsAt: targetEvent.startsAt,
      endsAt: targetEvent.endsAt,
      reason: 'event-deleted',
    });

    const assigneeIds = Array.from(new Set(targetEvent.slots.flatMap((slot: any) => slot.assignments?.map((assignment: any) => assignment.assigneeId).filter((id: string | null): id is string => Boolean(id)) ?? [])));
    await Promise.all(assigneeIds.map((assigneeId) =>
      this.notificationsService.pushSystemNotification(
        assigneeId,
        'Turno annullato',
        `Un evento a cui eri assegnato e stato eliminato o annullato. Controlla il calendario aggiornato.`,
        '/events',
        { template: 'assignment' }
      )
    ));

    return { deleted: true, id: targetEvent.id };
  }

  private expandRecurringEvents(events: any[]) {
    const baseEvents = events.filter((event) => !event.parentEventId);
    const childEvents = events.filter((event) => event.parentEventId);
    const childBySeriesOccurrence = new Map<string, any>();
    const cancelledOccurrences = new Set<string>();
    const firstOccurrenceBySeries = new Map<string, any>();

    for (const child of childEvents) {
      const snapshot = this.readHistoricalSnapshot(child.historicalSnapshot);
      const occurrenceStart = snapshot?.occurrenceStart ?? child.startsAt?.toISOString?.() ?? child.startsAt;
      const key = `${child.parentEventId}:${occurrenceStart}`;
      if (snapshot?.mode === 'cancelled') {
        cancelledOccurrences.add(key);
        continue;
      }
      childBySeriesOccurrence.set(key, child);
    }

    for (const event of baseEvents) {
      if (event.type !== 'recurring') {
        continue;
      }

      const firstKey = `${event.id}:${new Date(event.startsAt).toISOString()}`;
      const firstOccurrence = childBySeriesOccurrence.get(firstKey);
      if (firstOccurrence) {
        firstOccurrenceBySeries.set(event.id, firstOccurrence);
      }
    }

    const expanded = childEvents
      .filter((child) => {
        const snapshot = this.readHistoricalSnapshot(child.historicalSnapshot);
        if (snapshot?.mode === 'cancelled') {
          return false;
        }

        const occurrenceStart = snapshot?.occurrenceStart ?? child.startsAt?.toISOString?.() ?? child.startsAt;
        const firstOccurrence = firstOccurrenceBySeries.get(child.parentEventId);
        if (firstOccurrence && occurrenceStart === (this.readHistoricalSnapshot(firstOccurrence.historicalSnapshot)?.occurrenceStart ?? firstOccurrence.startsAt?.toISOString?.() ?? firstOccurrence.startsAt)) {
          return false;
        }

        return true;
      })
      .map((child) => this.mapPersistedOccurrence(child));

    for (const event of baseEvents) {
      if (event.type !== 'recurring') {
        expanded.push(this.mapStandaloneEvent(event));
        continue;
      }

      const firstOccurrence = firstOccurrenceBySeries.get(event.id);
      expanded.push(firstOccurrence ? this.mapSeriesRootEvent(event, firstOccurrence) : this.mapStandaloneEvent(event));

      for (const occurrence of this.generateOccurrences(event)) {
        const key = `${event.id}:${occurrence.startsAt.toISOString()}`;
        if (occurrence.startsAt.toISOString() === new Date(event.startsAt).toISOString()) {
          continue;
        }
        if (cancelledOccurrences.has(key) || childBySeriesOccurrence.has(key)) {
          continue;
        }
        expanded.push(this.mapVirtualOccurrence(event, occurrence.startsAt, occurrence.endsAt));
      }
    }

    return expanded.sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());
  }

  private mapStandaloneEvent(event: any) {
    return {
      ...event,
      locationValue: event.locationValue,
      seriesId: event.id,
      occurrenceStart: event.startsAt,
      isOccurrence: false,
      isVirtualOccurrence: false,
      seriesTemplate: null,
    };
  }

  private mapSeriesRootEvent(event: any, firstOccurrence: any) {
    const mappedOccurrence = this.mapPersistedOccurrence(firstOccurrence);
    return {
      ...mappedOccurrence,
      id: event.id,
      parentEventId: null,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      title: mappedOccurrence.title ?? event.title,
      description: mappedOccurrence.description ?? event.description,
      locationValue: mappedOccurrence.locationValue ?? event.locationValue,
      occurrenceStart: event.startsAt,
      isOccurrence: false,
      isVirtualOccurrence: false,
      canManageAssignments: true,
      seriesId: event.id,
    };
  }

  private mapPersistedOccurrence(event: any) {
    const snapshot = this.readHistoricalSnapshot(event.historicalSnapshot);
    return {
      ...event,
      type: event.parentEventId ? 'recurring' : event.type,
      recurrenceRule: event.parentEvent?.recurrenceRule ?? event.recurrenceRule,
      recurrenceTz: event.parentEvent?.recurrenceTz ?? event.recurrenceTz,
      recurrenceUntil: event.parentEvent?.recurrenceUntil ?? event.recurrenceUntil,
      recurrenceDurationMonths: event.parentEvent?.recurrenceDurationMonths ?? event.recurrenceDurationMonths,
      recurrenceAutoRenew: event.parentEvent?.recurrenceAutoRenew ?? event.recurrenceAutoRenew,
      recurrenceRenewMonths: event.parentEvent?.recurrenceRenewMonths ?? event.recurrenceRenewMonths,
      seriesId: event.parentEventId ?? event.id,
      occurrenceStart: snapshot?.occurrenceStart ?? event.startsAt,
      isOccurrence: Boolean(event.parentEventId),
      isVirtualOccurrence: false,
      seriesTemplate: event.parentEvent
        ? {
            title: event.parentEvent.title,
            description: event.parentEvent.description,
            locationValue: event.parentEvent.locationValue,
            startsAt: event.parentEvent.startsAt,
            endsAt: event.parentEvent.endsAt,
            recurrenceRule: event.parentEvent.recurrenceRule,
            recurrenceTz: event.parentEvent.recurrenceTz,
            recurrenceUntil: event.parentEvent.recurrenceUntil,
            recurrenceDurationMonths: event.parentEvent.recurrenceDurationMonths,
            recurrenceAutoRenew: event.parentEvent.recurrenceAutoRenew,
            recurrenceRenewMonths: event.parentEvent.recurrenceRenewMonths,
            slots: (event.parentEvent.slots ?? []).map((slot: any) => ({
              teamId: slot.teamId,
              dutyId: slot.dutyId,
              startsAt: slot.startsAt,
              endsAt: slot.endsAt,
              required: slot.required,
              requiredVolunteers: slot.requiredVolunteers,
            })),
          }
        : null,
    };
  }

  private mapVirtualOccurrence(event: any, startsAt: Date, endsAt: Date) {
    const delta = startsAt.getTime() - new Date(event.startsAt).getTime();
    return {
      ...event,
      id: `${event.id}::${startsAt.toISOString()}`,
      seriesId: event.id,
      parentEventId: event.id,
      startsAt,
      endsAt,
      occurrenceStart: startsAt,
      isOccurrence: true,
      isVirtualOccurrence: true,
      seriesTemplate: {
        title: event.title,
        description: event.description,
        locationValue: event.locationValue,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        recurrenceRule: event.recurrenceRule,
        recurrenceTz: event.recurrenceTz,
        recurrenceUntil: event.recurrenceUntil,
        recurrenceDurationMonths: event.recurrenceDurationMonths,
        recurrenceAutoRenew: event.recurrenceAutoRenew,
        recurrenceRenewMonths: event.recurrenceRenewMonths,
        slots: (event.slots ?? []).map((slot: any) => ({
          teamId: slot.teamId,
          dutyId: slot.dutyId,
          startsAt: new Date(new Date(slot.startsAt).getTime() + delta),
          endsAt: new Date(new Date(slot.endsAt).getTime() + delta),
          required: slot.required,
          requiredVolunteers: slot.requiredVolunteers,
        })),
      },
      slots: (event.slots ?? []).map((slot: any) => ({
        ...slot,
        id: `${slot.id}::${startsAt.toISOString()}`,
        startsAt: new Date(new Date(slot.startsAt).getTime() + delta),
        endsAt: new Date(new Date(slot.endsAt).getTime() + delta),
        assignments: [],
      })),
      assignments: [],
    };
  }

  private generateOccurrences(event: any, options?: { from?: Date; to?: Date }) {
    const startsAt = new Date(event.startsAt);
    const endsAt = new Date(event.endsAt);
    const rule = this.parseRecurrenceRule(event.recurrenceRule);
    if (!rule) {
      return [{ startsAt, endsAt }];
    }

    const occurrences: Array<{ startsAt: Date; endsAt: Date }> = [];
    let currentStart = new Date(startsAt);
    let currentEnd = new Date(endsAt);
    const horizon = options?.to ? new Date(options.to) : new Date();
    const floor = options?.from ? new Date(options.from) : null;
    if (!options?.to) {
      horizon.setMonth(horizon.getMonth() + RECURRENCE_LOOKAHEAD_MONTHS);
    }
    const recurrenceUntil = event.recurrenceUntil ? new Date(event.recurrenceUntil) : null;

    for (let index = 0; index < MAX_RECURRING_OCCURRENCES && currentStart <= horizon; index += 1) {
      if (recurrenceUntil && currentStart > recurrenceUntil) {
        break;
      }
      if ((!floor || currentEnd > floor) && currentStart <= horizon) {
        occurrences.push({ startsAt: new Date(currentStart), endsAt: new Date(currentEnd) });
      }
      const next = this.nextOccurrence(currentStart, currentEnd, rule, startsAt);
      currentStart = next.startsAt;
      currentEnd = next.endsAt;
    }

    return occurrences;
  }

  private parseRecurrenceRule(rule?: string | null) {
    if (!rule) {
      return null;
    }

    const parts = Object.fromEntries(rule.split(';').map((part) => part.split('=')));
    const freq = parts['FREQ'];
    if (!freq) {
      return null;
    }

    return {
      freq,
      interval: Number(parts['INTERVAL'] ?? 1),
      byDay: parts['BYDAY'] ?? null,
      byMonthDay: parts['BYMONTHDAY'] ? Number(parts['BYMONTHDAY']) : null,
    };
  }

  private nextOccurrence(currentStart: Date, currentEnd: Date, rule: { freq: string; interval: number; byDay: string | null; byMonthDay: number | null }, seriesStart: Date) {
    const duration = currentEnd.getTime() - currentStart.getTime();
    const nextStart = new Date(currentStart);

    if (rule.freq === 'MONTHLY') {
      nextStart.setMonth(nextStart.getMonth() + rule.interval);
      nextStart.setDate(rule.byMonthDay ?? seriesStart.getDate());
    } else if (rule.freq === 'YEARLY' || rule.freq === 'ANNUALLY') {
      nextStart.setFullYear(nextStart.getFullYear() + rule.interval);
      nextStart.setMonth(seriesStart.getMonth(), rule.byMonthDay ?? seriesStart.getDate());
    } else {
      nextStart.setDate(nextStart.getDate() + 7 * rule.interval);
      if (rule.byDay) {
        const target = this.dayCodeToNumber(rule.byDay.split(',')[0]);
        const delta = (target - nextStart.getDay() + 7) % 7;
        nextStart.setDate(nextStart.getDate() + delta);
      }
    }

    return {
      startsAt: nextStart,
      endsAt: new Date(nextStart.getTime() + duration),
    };
  }

  private dayCodeToNumber(code: string): number {
    switch (code) {
      case 'MO': return 1;
      case 'TU': return 2;
      case 'WE': return 3;
      case 'TH': return 4;
      case 'FR': return 5;
      case 'SA': return 6;
      default: return 0;
    }
  }

  async prepareSlotsForScheduling(payload: { from: string; to: string; teamId?: string; eventId?: string; occurrenceStart?: string; scope?: 'single' | 'series' | 'range' }) {
    const from = new Date(payload.from);
    const to = new Date(payload.to);
    const scope = payload.scope ?? 'range';
    const ref = payload.eventId ? this.resolveEventReference(payload.eventId, payload.occurrenceStart) : null;

    await this.ensureRecurringCoverage(to, ref?.eventId);

    if (ref?.eventId) {
      await this.materializeOccurrencesInRange(from, to, ref.eventId, scope === 'single' ? ref.occurrenceStart : undefined);
    } else {
      await this.materializeOccurrencesInRange(from, to);
    }

    const where: any = {
      startsAt: {
        gte: from,
        lte: to,
      },
      teamId: payload.teamId ?? undefined,
    };

    if (ref?.eventId) {
      const event = await this.prisma.event.findUnique({ where: { id: ref.eventId } as any });
      if (!event) {
        throw new BadRequestException('Evento non trovato per lo scheduling');
      }

      if (scope === 'single' && ref.occurrenceStart) {
        const occurrenceEvent = await this.findOccurrenceInstance(event, ref.occurrenceStart);
        if (!occurrenceEvent) {
          throw new BadRequestException('Occorrenza non disponibile per lo scheduling');
        }
        where.eventId = occurrenceEvent.id;
      } else if ((event as any).type === 'recurring') {
        where.OR = [
          { eventId: ref.eventId },
          { event: { parentEventId: ref.eventId } },
        ];
      } else {
        where.eventId = ref.eventId;
      }
    } else {
      where.event = {
        OR: [
          { type: 'single' },
          { parentEventId: { not: null } },
        ],
      };
    }

    return this.prisma.eventSlot.findMany({
      where,
      include: {
        assignments: true,
        event: {
          select: {
            id: true,
            title: true,
            startsAt: true,
            endsAt: true,
            locationValue: true,
          },
        },
        team: {
          select: { name: true, requiredCompetencies: true },
        },
        duty: {
          select: { id: true, name: true, requiredCompetencies: true },
        },
      },
      orderBy: { startsAt: 'asc' },
    } as any);
  }

  private async updateSingleOccurrence(eventId: string, payload: UpdateEventDto & { occurrenceStart: string }, actorId: string, actorRole: Role) {
    await this.ensureRecurringCoverage(undefined, eventId);
    const event = await this.prisma.event.findUniqueOrThrow({
      where: { id: eventId },
      include: { slots: true, parentEvent: { include: { slots: true } } }
    });
    const series = event.parentEventId && event.parentEvent ? event.parentEvent : event;
    await this.assertEventAccess(series, actorId, actorRole);

    const existingChildren = await this.prisma.event.findMany({ where: { parentEventId: series.id }, include: { slots: true } });
    const occurrenceChild = existingChildren.find((child) => this.readHistoricalSnapshot(child.historicalSnapshot)?.occurrenceStart === payload.occurrenceStart);
    const occurrenceStart = payload.startsAt ? new Date(payload.startsAt) : new Date(payload.occurrenceStart);
    const occurrenceEnd = payload.endsAt ? new Date(payload.endsAt) : new Date(occurrenceStart.getTime() + (new Date(series.endsAt).getTime() - new Date(series.startsAt).getTime()));
    const slotPayload = payload.slots
      ? payload.slots.map((slot) => ({
          teamId: slot.teamId,
          dutyId: slot.dutyId,
          startsAt: new Date(slot.startsAt),
          endsAt: new Date(slot.endsAt),
          required: slot.required ?? true,
          requiredVolunteers: slot.requiredVolunteers ?? 1,
        }))
      : this.buildOccurrenceSlotsFromSeries(series.slots, new Date(payload.occurrenceStart), occurrenceStart);

    const baseData = {
      title: payload.title ?? series.title,
      description: payload.description ?? series.description,
      type: 'recurring' as any,
      startsAt: occurrenceStart,
      endsAt: occurrenceEnd,
      recurrenceRule: null,
      recurrenceTz: null,
      parentEventId: series.id,
      historicalSnapshot: toJsonValue({
        mode: 'override',
        occurrenceStart: payload.occurrenceStart,
        occurrenceEnd: occurrenceEnd.toISOString(),
      }),
    };

    const slotCreates = slotPayload.map((slot) => ({
      team: { connect: { id: slot.teamId } },
      duty: { connect: { id: slot.dutyId } },
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      required: slot.required,
      requiredVolunteers: slot.requiredVolunteers,
    }));

    const updated = occurrenceChild
      ? await this.prisma.event.update({
          where: { id: occurrenceChild.id },
          data: {
            ...baseData,
            slots: {
              deleteMany: {},
              create: slotCreates,
            },
          },
        })
      : await this.prisma.event.create({
          data: {
            ...baseData,
            createdById: actorId,
            slots: {
              create: slotCreates,
            },
          },
        });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'event.occurrence.updated',
        entityType: 'event',
        entityId: updated.id,
        metadata: toJsonValue({ seriesId: series.id, occurrenceStart: payload.occurrenceStart, payload })
      }
    });

    await this.domainSync.syncEventMutation({
      action: 'event.occurrence.updated',
      entityId: updated.id,
      eventIds: [series.id, updated.id],
      teamIds: slotPayload.map((slot) => slot.teamId),
      startsAt: occurrenceStart,
      endsAt: occurrenceEnd,
      reason: 'occurrence-updated',
    });

    return this.prisma.event.findUniqueOrThrow({
      where: { id: updated.id },
      include: { slots: true, parentEvent: { include: { slots: true } } }
    }).then((occurrence) => this.mapPersistedOccurrence(occurrence));
  }

  private async removeSingleOccurrence(eventId: string, occurrenceStart: string, actorId: string, actorRole: Role) {
    await this.ensureRecurringCoverage(undefined, eventId);
    const event = await this.prisma.event.findUniqueOrThrow({
      where: { id: eventId },
      include: { slots: true, parentEvent: { include: { slots: true } } }
    });
    const series = event.parentEventId && event.parentEvent ? event.parentEvent : event;
    await this.assertEventAccess(series, actorId, actorRole);

    const existingChildren = await this.prisma.event.findMany({ where: { parentEventId: series.id } });
    const occurrenceChild = existingChildren.find((child) => this.readHistoricalSnapshot(child.historicalSnapshot)?.occurrenceStart === occurrenceStart);
    const start = new Date(occurrenceStart);
    const end = new Date(start.getTime() + (new Date(series.endsAt).getTime() - new Date(series.startsAt).getTime()));

    if (occurrenceChild) {
      await this.prisma.event.update({
        where: { id: occurrenceChild.id },
        data: {
          historicalSnapshot: toJsonValue({ mode: 'cancelled', occurrenceStart, occurrenceEnd: end.toISOString() }),
          slots: { deleteMany: {} }
        }
      });
    } else {
      await this.prisma.event.create({
        data: {
          title: series.title,
          description: series.description,
          type: 'recurring' as any,
          startsAt: start,
          endsAt: end,
          parentEventId: series.id,
          createdById: actorId,
          historicalSnapshot: toJsonValue({ mode: 'cancelled', occurrenceStart, occurrenceEnd: end.toISOString() })
        }
      });
    }

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'event.occurrence.deleted',
        entityType: 'event',
        entityId: series.id,
        metadata: toJsonValue({ seriesId: series.id, occurrenceStart })
      }
    });

    await this.domainSync.syncEventMutation({
      action: 'event.occurrence.deleted',
      entityId: series.id,
      eventIds: [series.id],
      teamIds: series.slots.map((slot: any) => slot.teamId),
      startsAt: start,
      endsAt: end,
      reason: 'occurrence-deleted',
    });

    return { deleted: true, id: `${series.id}::${occurrenceStart}` };
  }

  private buildOccurrenceSlotsFromSeries(slots: any[], originalOccurrenceStart: Date, targetOccurrenceStart: Date) {
    const delta = targetOccurrenceStart.getTime() - originalOccurrenceStart.getTime();
    return slots.map((slot) => ({
      teamId: slot.teamId,
      dutyId: slot.dutyId,
      startsAt: new Date(new Date(slot.startsAt).getTime() + delta),
      endsAt: new Date(new Date(slot.endsAt).getTime() + delta),
      required: slot.required,
    }));
  }

  private readHistoricalSnapshot(snapshot: any): { mode?: string; occurrenceStart?: string; occurrenceEnd?: string } | null {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      return null;
    }
    return snapshot as { mode?: string; occurrenceStart?: string; occurrenceEnd?: string };
  }

  private resolveEventReference(eventId: string, occurrenceStart?: string) {
    if (eventId.includes('::')) {
      const [seriesId, derivedOccurrenceStart] = eventId.split('::');
      if (!seriesId || !derivedOccurrenceStart) {
        throw new BadRequestException('Identificativo evento non valido');
      }
      return { eventId: seriesId, occurrenceStart: occurrenceStart ?? derivedOccurrenceStart };
    }

    return { eventId, occurrenceStart };
  }

  private buildRecurringSettings(type: string, seriesStart: Date, payload: Partial<CreateEventDto & UpdateEventDto>, existing?: any) {
    const normalizedType = type ?? existing?.type;
    if (normalizedType !== 'recurring') {
      return {
        recurrenceRule: null,
        recurrenceTz: null,
        recurrenceUntil: null,
        recurrenceDurationMonths: null,
        recurrenceAutoRenew: true,
        recurrenceRenewMonths: null,
      };
    }

    const recurrenceDurationMonths = payload.recurrenceDurationMonths
      ?? existing?.recurrenceDurationMonths
      ?? DEFAULT_RECURRENCE_DURATION_MONTHS;
    const recurrenceAutoRenew = payload.recurrenceAutoRenew
      ?? existing?.recurrenceAutoRenew
      ?? true;
    const recurrenceRenewMonths = payload.recurrenceRenewMonths
      ?? existing?.recurrenceRenewMonths
      ?? recurrenceDurationMonths;

    let recurrenceUntil: Date | null;
    if (payload.recurrenceUntil) {
      recurrenceUntil = new Date(payload.recurrenceUntil);
    } else if (payload.recurrenceDurationMonths || payload.startsAt || !existing?.recurrenceUntil) {
      recurrenceUntil = this.addMonths(seriesStart, recurrenceDurationMonths);
    } else {
      recurrenceUntil = new Date(existing.recurrenceUntil);
    }

    return {
      recurrenceRule: payload.recurrenceRule ?? existing?.recurrenceRule ?? null,
      recurrenceTz: payload.recurrenceTz ?? existing?.recurrenceTz ?? 'Europe/Rome',
      recurrenceUntil,
      recurrenceDurationMonths,
      recurrenceAutoRenew,
      recurrenceRenewMonths,
    };
  }

  private async ensureRecurringCoverage(targetDate?: Date, eventId?: string) {
    const horizon = targetDate ? new Date(targetDate) : new Date();
    if (!targetDate) {
      horizon.setMonth(horizon.getMonth() + RECURRENCE_LOOKAHEAD_MONTHS);
    }

    const recurringEvents = await this.prisma.event.findMany({
      where: {
        type: 'recurring' as any,
        parentEventId: null,
        id: eventId ?? undefined,
      } as any,
    });

    await Promise.all(recurringEvents.map(async (event: any) => {
      const durationMonths = event.recurrenceDurationMonths ?? DEFAULT_RECURRENCE_DURATION_MONTHS;
      const renewMonths = event.recurrenceRenewMonths ?? durationMonths;
      let recurrenceUntil = event.recurrenceUntil ? new Date(event.recurrenceUntil) : this.addMonths(new Date(event.startsAt), durationMonths);

      if (!event.recurrenceAutoRenew && event.recurrenceUntil) {
        if (!event.recurrenceDurationMonths) {
          await this.prisma.event.update({
            where: { id: event.id },
            data: { recurrenceDurationMonths: durationMonths, recurrenceRenewMonths: renewMonths } as any,
          } as any);
        }
        return;
      }

      while (recurrenceUntil < horizon) {
        recurrenceUntil = this.addMonths(recurrenceUntil, renewMonths);
      }

      if (!event.recurrenceUntil || recurrenceUntil.getTime() !== new Date(event.recurrenceUntil).getTime() || !event.recurrenceDurationMonths || !event.recurrenceRenewMonths) {
        await this.prisma.event.update({
          where: { id: event.id },
          data: {
            recurrenceUntil,
            recurrenceDurationMonths: durationMonths,
            recurrenceAutoRenew: event.recurrenceAutoRenew ?? true,
            recurrenceRenewMonths: renewMonths,
          } as any,
        } as any);
      }
    }));
  }

  private async materializeOccurrencesInRange(from: Date, to: Date, eventId?: string, onlyOccurrenceStart?: string) {
    const recurringSeries = await this.prisma.event.findMany({
      where: {
        type: 'recurring' as any,
        parentEventId: null,
        id: eventId ?? undefined,
      } as any,
      include: {
        slots: true,
        instances: {
          include: {
            slots: true,
          },
        },
      } as any,
    } as any);

    for (const series of recurringSeries as any[]) {
      const occurrences = this.generateOccurrences(series, {
        from: onlyOccurrenceStart ? new Date(onlyOccurrenceStart) : from,
        to: onlyOccurrenceStart ? new Date(onlyOccurrenceStart) : to,
      }).filter((occurrence) => !onlyOccurrenceStart || occurrence.startsAt.toISOString() === onlyOccurrenceStart);

      for (const occurrence of occurrences) {
        const key = occurrence.startsAt.toISOString();
        const existing = (series.instances ?? []).find((child: any) => {
          const snapshot = this.readHistoricalSnapshot(child.historicalSnapshot);
          return (snapshot?.occurrenceStart ?? new Date(child.startsAt).toISOString()) === key;
        });
        const snapshot = existing ? this.readHistoricalSnapshot(existing.historicalSnapshot) : null;

        if (snapshot?.mode === 'cancelled' || existing) {
          continue;
        }

        const delta = occurrence.startsAt.getTime() - new Date(series.startsAt).getTime();
        await this.prisma.event.create({
          data: {
            title: series.title,
            description: series.description,
            type: 'recurring' as any,
            startsAt: occurrence.startsAt,
            endsAt: occurrence.endsAt,
            parentEventId: series.id,
            createdById: series.createdById,
            historicalSnapshot: toJsonValue({
              mode: 'materialized',
              occurrenceStart: key,
              occurrenceEnd: occurrence.endsAt.toISOString(),
            }),
            slots: {
              create: (series.slots ?? []).map((slot: any) => ({
                team: { connect: { id: slot.teamId } },
                duty: { connect: { id: slot.dutyId } },
                startsAt: new Date(new Date(slot.startsAt).getTime() + delta),
                endsAt: new Date(new Date(slot.endsAt).getTime() + delta),
                required: slot.required,
                requiredVolunteers: slot.requiredVolunteers,
              })),
            },
          } as any,
        } as any);
      }
    }
  }

  private async findOccurrenceInstance(event: any, occurrenceStart: string) {
    const seriesId = event.parentEventId ?? event.id;
    const candidates = await this.prisma.event.findMany({
      where: { parentEventId: seriesId } as any,
    });

    return candidates.find((candidate: any) => {
      const snapshot = this.readHistoricalSnapshot(candidate.historicalSnapshot);
      return (snapshot?.occurrenceStart ?? new Date(candidate.startsAt).toISOString()) === occurrenceStart;
    }) ?? null;
  }

  private addMonths(source: Date, months: number) {
    const next = new Date(source);
    next.setMonth(next.getMonth() + months);
    return next;
  }

  private async assertEventAccess(
    event: { slots: Array<{ teamId: string }> },
    actorId: string,
    actorRole: Role
  ) {
    if (actorRole !== Role.service_leader) {
      return;
    }

    const allowedTeamIds = await this.findLeaderTeamIds(actorId);
    const forbiddenSlot = event.slots.find((slot) => !allowedTeamIds.includes(slot.teamId));
    if (forbiddenSlot) {
      throw new ForbiddenException('Il leader puo operare solo sugli eventi dei propri team');
    }
  }

  private async findLeaderTeamIds(userId: string): Promise<string[]> {
    const teams = await this.prisma.team.findMany({
      where: {
        leaderId: userId
      },
      select: {
        id: true
      }
    });

    return teams.map((team) => team.id);
  }
}
