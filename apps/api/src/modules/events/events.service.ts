import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { toJsonValue } from '../../common/utils/json.util';
import { PrismaService } from '../../database/prisma.service';
import { CreateEventDto, UpdateEventDto, AssignVolunteerDto } from '@shift-complete/shared-types';
import { NotificationsService } from '../notifications/notifications.service';

const RECURRENCE_LOOKAHEAD_MONTHS = 12;
const MAX_RECURRING_OCCURRENCES = 520;

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService
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

    return this.prisma.event.findMany({
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
    }).then((events) =>
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
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          type: event.type,
          recurrenceRule: event.recurrenceRule,
          recurrenceTz: event.recurrenceTz,
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

    const event = await this.prisma.event.create({
      data: {
        title: payload.title,
        description: payload.description,
        type: payload.type as any, // mapping between string and enum
        startsAt: new Date(payload.startsAt),
        endsAt: new Date(payload.endsAt),
        recurrenceRule: payload.recurrenceRule,
        recurrenceTz: payload.recurrenceTz,
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
            required: slot.required ?? true
          }))
        }
      },
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

    return event;
  }

  async assignVolunteer(payload: AssignVolunteerDto, actorId: string, actorRole: Role) {
    const slot = await this.prisma.eventSlot.findUniqueOrThrow({
      where: { id: payload.slotId },
      include: {
        team: true,
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

    if (payload.assigneeId) {
      await this.notificationsService.pushSystemNotification(
        payload.assigneeId,
        'Nuova assegnazione turno',
        `Sei stato assegnato al servizio ${slot.dutyId} del team ${slot.team.name}.`,
        '/events',
        { template: 'assignment', teamName: slot.team.name }
      );
    }

    return assignment;
  }

  async update(eventId: string, payload: UpdateEventDto & { editMode?: 'single' | 'series'; occurrenceStart?: string }, actorId: string, actorRole: Role) {
    if (payload.editMode === 'single' && payload.occurrenceStart) {
      return this.updateSingleOccurrence(eventId, payload as UpdateEventDto & { occurrenceStart: string }, actorId, actorRole);
    }

    const event = await this.prisma.event.findUniqueOrThrow({
      where: { id: eventId },
      include: { slots: true, parentEvent: { include: { slots: true } } }
    });
    const targetEvent = payload.editMode === 'series' && event.parentEventId && event.parentEvent ? event.parentEvent : event;

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
        startsAt: payload.startsAt ? new Date(payload.startsAt) : undefined,
        endsAt: payload.endsAt ? new Date(payload.endsAt) : undefined,
        recurrenceRule: payload.type === 'recurring' || targetEvent.type === 'recurring' ? payload.recurrenceRule : null,
        recurrenceTz: payload.type === 'recurring' || targetEvent.type === 'recurring' ? payload.recurrenceTz : null,
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
                required: slot.required ?? true
              }))
            }
          : undefined
      }
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
    if (mode === 'single' && occurrenceStart) {
      return this.removeSingleOccurrence(eventId, occurrenceStart, actorId, actorRole);
    }

    const event = await this.prisma.event.findUniqueOrThrow({
      where: { id: eventId },
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

    const expanded = childEvents
      .filter((child) => this.readHistoricalSnapshot(child.historicalSnapshot)?.mode !== 'cancelled')
      .map((child) => this.mapPersistedOccurrence(child));

    for (const event of baseEvents) {
      if (event.type !== 'recurring') {
        expanded.push(this.mapStandaloneEvent(event));
        continue;
      }

      for (const occurrence of this.generateOccurrences(event)) {
        const key = `${event.id}:${occurrence.startsAt.toISOString()}`;
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
      seriesId: event.id,
      occurrenceStart: event.startsAt,
      isOccurrence: false,
      isVirtualOccurrence: false,
      seriesTemplate: null,
    };
  }

  private mapPersistedOccurrence(event: any) {
    const snapshot = this.readHistoricalSnapshot(event.historicalSnapshot);
    return {
      ...event,
      type: event.parentEventId ? 'recurring' : event.type,
      recurrenceRule: event.parentEvent?.recurrenceRule ?? event.recurrenceRule,
      recurrenceTz: event.parentEvent?.recurrenceTz ?? event.recurrenceTz,
      seriesId: event.parentEventId ?? event.id,
      occurrenceStart: snapshot?.occurrenceStart ?? event.startsAt,
      isOccurrence: Boolean(event.parentEventId),
      isVirtualOccurrence: false,
      seriesTemplate: event.parentEvent
        ? {
            title: event.parentEvent.title,
            description: event.parentEvent.description,
            startsAt: event.parentEvent.startsAt,
            endsAt: event.parentEvent.endsAt,
            recurrenceRule: event.parentEvent.recurrenceRule,
            recurrenceTz: event.parentEvent.recurrenceTz,
            slots: (event.parentEvent.slots ?? []).map((slot: any) => ({
              teamId: slot.teamId,
              dutyId: slot.dutyId,
              startsAt: slot.startsAt,
              endsAt: slot.endsAt,
              required: slot.required,
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
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        recurrenceRule: event.recurrenceRule,
        recurrenceTz: event.recurrenceTz,
        slots: (event.slots ?? []).map((slot: any) => ({
          teamId: slot.teamId,
          dutyId: slot.dutyId,
          startsAt: new Date(new Date(slot.startsAt).getTime() + delta),
          endsAt: new Date(new Date(slot.endsAt).getTime() + delta),
          required: slot.required,
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

  private generateOccurrences(event: any) {
    const startsAt = new Date(event.startsAt);
    const endsAt = new Date(event.endsAt);
    const rule = this.parseRecurrenceRule(event.recurrenceRule);
    if (!rule) {
      return [{ startsAt, endsAt }];
    }

    const occurrences: Array<{ startsAt: Date; endsAt: Date }> = [];
    let currentStart = new Date(startsAt);
    let currentEnd = new Date(endsAt);
    const horizon = new Date();
    horizon.setMonth(horizon.getMonth() + RECURRENCE_LOOKAHEAD_MONTHS);

    for (let index = 0; index < MAX_RECURRING_OCCURRENCES && currentStart <= horizon; index += 1) {
      occurrences.push({ startsAt: new Date(currentStart), endsAt: new Date(currentEnd) });
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

  private async updateSingleOccurrence(eventId: string, payload: UpdateEventDto & { occurrenceStart: string }, actorId: string, actorRole: Role) {
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
        }))
      : this.buildOccurrenceSlotsFromSeries(series.slots, new Date(payload.occurrenceStart), occurrenceStart);

    const baseData = {
      title: payload.title ?? series.title,
      description: payload.description ?? series.description,
      type: 'single' as any,
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

    return updated;
  }

  private async removeSingleOccurrence(eventId: string, occurrenceStart: string, actorId: string, actorRole: Role) {
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
          type: 'single' as any,
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
