import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { toJsonValue } from '../../common/utils/json.util';
import { CreateAvailabilityDto, UpdateAvailabilityDto } from '@shift-complete/shared-types';

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actorId: string, role: Role, userId?: string) {
    const effectiveUserId = await this.resolveTargetUserId(actorId, role, userId);

    return this.prisma.availability.findMany({
      where: {
        userId: effectiveUserId
      },
      orderBy: {
        startsAt: 'asc'
      }
    });
  }

  async create(actorId: string, role: Role, payload: CreateAvailabilityDto, userId?: string) {
    const effectiveUserId = await this.resolveTargetUserId(actorId, role, userId);

    const availability = await this.prisma.availability.create({
      data: {
        userId: effectiveUserId,
        teamId: payload.teamId,
        type: payload.type as any,
        startsAt: new Date(payload.startsAt),
        endsAt: new Date(payload.endsAt),
        reason: payload.reason
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'availability.created',
        entityType: 'availability',
        entityId: availability.id,
        metadata: toJsonValue({ ...payload, userId: effectiveUserId })
      }
    });

    return availability;
  }

  async update(availabilityId: string, actorId: string, role: Role, payload: UpdateAvailabilityDto) {
    const availability = await this.prisma.availability.findUniqueOrThrow({
      where: { id: availabilityId }
    });

    await this.assertAvailabilityAccess(availability.userId, actorId, role);

    const updated = await this.prisma.availability.update({
      where: { id: availabilityId },
      data: {
        teamId: payload.teamId,
        type: payload.type as any,
        startsAt: payload.startsAt ? new Date(payload.startsAt) : undefined,
        endsAt: payload.endsAt ? new Date(payload.endsAt) : undefined,
        reason: payload.reason
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'availability.updated',
        entityType: 'availability',
        entityId: availabilityId,
        metadata: toJsonValue(payload)
      }
    });

    return updated;
  }

  async remove(availabilityId: string, actorId: string, role: Role) {
    const availability = await this.prisma.availability.findUniqueOrThrow({
      where: { id: availabilityId }
    });

    await this.assertAvailabilityAccess(availability.userId, actorId, role);
    await this.prisma.availability.delete({ where: { id: availabilityId } });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'availability.deleted',
        entityType: 'availability',
        entityId: availabilityId,
        metadata: toJsonValue({ availabilityId })
      }
    });

    return { deleted: true, id: availabilityId };
  }

  private async resolveTargetUserId(actorId: string, role: Role, requestedUserId?: string) {
    if (!requestedUserId || requestedUserId === actorId) {
      return actorId;
    }

    if (role === Role.administrator) {
      return requestedUserId;
    }

    if (role === Role.service_leader) {
      const membership = await this.prisma.teamMembership.findFirst({
        where: {
          userId: requestedUserId,
          team: {
            leaderId: actorId
          }
        },
        select: { id: true }
      });

      if (membership) {
        return requestedUserId;
      }
    }

    throw new ForbiddenException('Accesso negato alla disponibilita richiesta');
  }

  private async assertAvailabilityAccess(userId: string, actorId: string, role: Role) {
    await this.resolveTargetUserId(actorId, role, userId);
  }
}
