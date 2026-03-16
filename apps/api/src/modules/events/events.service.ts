import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { toJsonValue } from '../../common/utils/json.util';
import { PrismaService } from '../../database/prisma.service';
import { AssignVolunteerDto } from './dto/assign-volunteer.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.event.findMany({
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
                }
              }
            },
            team: {
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
          roleName: slot.roleName,
          teamId: slot.teamId,
          teamName: slot.team.name,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          assignments: slot.assignments.map((assignment) => ({
            id: assignment.id,
            status: assignment.status,
            assignee: assignment.assignee
          }))
        })),
        assignments: event.slots.flatMap((slot) =>
          slot.assignments.map((assignment) => ({
            id: assignment.id,
            slotId: slot.id,
            roleName: slot.roleName,
            team: slot.team.name,
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
        type: payload.type,
        startsAt: new Date(payload.startsAt),
        endsAt: new Date(payload.endsAt),
        recurrenceRule: payload.recurrenceRule,
        recurrenceTz: payload.recurrenceTz,
        createdById: actorId,
        slots: {
          create: payload.slots.map((slot) => ({
            teamId: slot.teamId,
            roleName: slot.roleName,
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
        team: true
      }
    });

    if (actorRole === Role.service_leader) {
      const allowedTeamIds = await this.findLeaderTeamIds(actorId);
      if (!allowedTeamIds.includes(slot.teamId)) {
        throw new ForbiddenException('Il leader puo assegnare solo i ruoli dei propri team');
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
            status: payload.status ?? existingAssignment.status,
            autoAssigned: payload.autoAssigned ?? existingAssignment.autoAssigned
          }
        })
      : await this.prisma.assignment.create({
      data: {
        slotId: payload.slotId,
        assigneeId: payload.assigneeId,
        status: payload.status ?? 'assigned',
        autoAssigned: Boolean(payload.autoAssigned)
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'assignment.created',
        entityType: 'assignment',
        entityId: assignment.id,
        metadata: toJsonValue(payload)
      }
    });

    return assignment;
  }

  async update(eventId: string, payload: UpdateEventDto, actorId: string, actorRole: Role) {
    const event = await this.prisma.event.findUniqueOrThrow({
      where: { id: eventId },
      include: { slots: true }
    });

    await this.assertEventAccess(event, actorId, actorRole);

    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data: {
        title: payload.title,
        description: payload.description,
        type: payload.type,
        startsAt: payload.startsAt ? new Date(payload.startsAt) : undefined,
        endsAt: payload.endsAt ? new Date(payload.endsAt) : undefined,
        recurrenceRule: payload.recurrenceRule,
        recurrenceTz: payload.recurrenceTz
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

    return updated;
  }

  async remove(eventId: string, actorId: string, actorRole: Role) {
    const event = await this.prisma.event.findUniqueOrThrow({
      where: { id: eventId },
      include: { slots: true }
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
