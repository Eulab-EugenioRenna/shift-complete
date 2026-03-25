import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { toJsonValue } from '../../common/utils/json.util';
import { CreateDutyDto, UpdateDutyDto } from '@shift-complete/shared-types';
import { DomainSyncService } from '../domain-sync/domain-sync.service';

@Injectable()
export class DutiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly domainSync: DomainSyncService,
  ) {}

  async list(actorId: string, role: Role, teamId?: string) {
    const where = role === Role.administrator
      ? { teamId: teamId ?? undefined }
      : role === Role.service_leader
        ? {
            teamId: teamId ?? undefined,
            team: {
              leaderId: actorId
            }
          }
        : {
            teamId: teamId ?? undefined,
            team: {
              memberships: {
                some: {
                  userId: actorId
                }
              }
            }
          };

    return this.prisma.duty.findMany({
      where,
      orderBy: {
        name: 'asc'
      }
    });
  }

  async create(payload: CreateDutyDto, actorId: string, role: Role) {
    await this.assertTeamAccess(payload.teamId, actorId, role);

    const duty = await this.prisma.duty.create({
      data: {
        name: payload.name,
        description: payload.description,
        color: payload.color,
        icon: payload.icon,
        requiredCompetencies: payload.requiredCompetencies,
        team: {
          connect: {
            id: payload.teamId
          }
        }
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'duty.created',
        entityType: 'duty',
        entityId: duty.id,
        metadata: toJsonValue(payload)
      }
    });

    await this.domainSync.syncPlanningContextMutation({
      action: 'duty.created',
      entityId: duty.id,
      teamIds: [payload.teamId],
      reason: 'duty-created',
    });

    return duty;
  }

  async update(dutyId: string, payload: UpdateDutyDto, actorId: string, role: Role) {
    const duty = await this.prisma.duty.findUniqueOrThrow({
      where: { id: dutyId }
    });

    await this.assertTeamAccess(duty.teamId, actorId, role);

    const updated = await this.prisma.duty.update({
      where: { id: dutyId },
      data: payload as any
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'duty.updated',
        entityType: 'duty',
        entityId: dutyId,
        metadata: toJsonValue(payload)
      }
    });

    await this.domainSync.syncPlanningContextMutation({
      action: 'duty.updated',
      entityId: dutyId,
      teamIds: [duty.teamId],
      reason: 'duty-updated',
    });

    return updated;
  }

  async updateCompetencies(dutyId: string, competencyValues: string[], actorId: string, role: Role) {
    const duty = await this.prisma.duty.findUniqueOrThrow({
      where: { id: dutyId },
      select: { teamId: true },
    });

    await this.assertTeamAccess(duty.teamId, actorId, role);

    const updated = await this.prisma.duty.update({
      where: { id: dutyId },
      data: {
        requiredCompetencies: competencyValues,
      } as any,
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'duty.competencies.updated',
        entityType: 'duty',
        entityId: dutyId,
        metadata: toJsonValue({ competencyValues }),
      }
    });

    await this.domainSync.syncPlanningContextMutation({
      action: 'duty.competencies.updated',
      entityId: dutyId,
      teamIds: [duty.teamId],
      reason: 'duty-competencies-updated',
    });

    return updated;
  }

  async remove(dutyId: string, actorId: string, role: Role) {
    const duty = await this.prisma.duty.findUniqueOrThrow({
      where: { id: dutyId },
      include: {
        slots: {
          select: { id: true }
        }
      }
    });

    await this.assertTeamAccess(duty.teamId, actorId, role);

    if (duty.slots.length > 0) {
      throw new ForbiddenException('Non puoi eliminare una mansione gia utilizzata negli eventi');
    }

    await this.prisma.duty.delete({ where: { id: dutyId } });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'duty.deleted',
        entityType: 'duty',
        entityId: dutyId,
        metadata: toJsonValue({ dutyId })
      }
    });

    await this.domainSync.syncPlanningContextMutation({
      action: 'duty.deleted',
      entityId: dutyId,
      teamIds: [duty.teamId],
      reason: 'duty-deleted',
    });

    return { deleted: true, id: dutyId };
  }

  private async assertTeamAccess(teamId: string, actorId: string, role: Role) {
    if (role === Role.administrator) {
      return;
    }

    const team = await this.prisma.team.findFirst({
      where: {
        id: teamId,
        leaderId: actorId
      },
      select: { id: true }
    });

    if (!team) {
      throw new ForbiddenException('Accesso negato alla mansione del team richiesto');
    }
  }
}
