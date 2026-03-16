import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { toJsonValue } from '../../common/utils/json.util';
import { PrismaService } from '../../database/prisma.service';
import { CreateEventDto, UpdateEventDto, AssignVolunteerDto } from '@shift-complete/shared-types';
import { NotificationsService } from '../notifications/notifications.service';

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
                name: true
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
      events.map((event) => ({
        id: event.id,
        title: event.title,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        type: event.type,
        slots: event.slots.map((slot) => ({
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
        assignments: event.slots.flatMap((slot) =>
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
      }))
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

  async update(eventId: string, payload: UpdateEventDto, actorId: string, actorRole: Role) {
    const event = await this.prisma.event.findUniqueOrThrow({
      where: { id: eventId },
      include: { slots: true }
    });

    await this.assertEventAccess(event, actorId, actorRole);

    if (actorRole === Role.service_leader && payload.slots?.length) {
      const allowedTeamIds = await this.findLeaderTeamIds(actorId);
      const disallowedSlot = payload.slots.find((slot) => !allowedTeamIds.includes(slot.teamId));
      if (disallowedSlot) {
        throw new ForbiddenException('Il leader puo aggiornare eventi solo per i propri team');
      }
    }

    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data: {
        title: payload.title,
        description: payload.description,
        type: payload.type as any,
        startsAt: payload.startsAt ? new Date(payload.startsAt) : undefined,
        endsAt: payload.endsAt ? new Date(payload.endsAt) : undefined,
        recurrenceRule: payload.recurrenceRule,
        recurrenceTz: payload.recurrenceTz,
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
        entityId: eventId,
        metadata: toJsonValue(payload)
      }
    });

    const assignments = await this.prisma.assignment.findMany({
      where: { slot: { eventId } },
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

  async remove(eventId: string, actorId: string, actorRole: Role) {
    const event = await this.prisma.event.findUniqueOrThrow({
      where: { id: eventId },
      include: {
        slots: {
          include: {
            assignments: {
              select: { assigneeId: true }
            }
          }
        }
      }
    });

    await this.assertEventAccess(event, actorId, actorRole);
    await this.prisma.event.delete({ where: { id: eventId } });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'event.deleted',
        entityType: 'event',
        entityId: eventId,
        metadata: toJsonValue({ eventId })
      }
    });

    const assigneeIds = Array.from(new Set(event.slots.flatMap((slot) => slot.assignments.map((assignment) => assignment.assigneeId).filter((id): id is string => Boolean(id)))));
    await Promise.all(assigneeIds.map((assigneeId) =>
      this.notificationsService.pushSystemNotification(
        assigneeId,
        'Turno annullato',
        `Un evento a cui eri assegnato e stato eliminato o annullato. Controlla il calendario aggiornato.`,
        '/events',
        { template: 'assignment' }
      )
    ));

    return { deleted: true, id: eventId };
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
