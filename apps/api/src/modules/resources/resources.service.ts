import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { toJsonValue } from '../../common/utils/json.util';
import { PrismaService } from '../../database/prisma.service';
import { CreateResourceDto } from './dto/create-resource.dto';

@Injectable()
export class ResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, role: Role) {
    if (role === Role.administrator) {
      return this.prisma.resourceFile.findMany({
        include: {
          team: {
            select: { id: true, name: true }
          }
        },
        orderBy: { uploadedAt: 'desc' }
      });
    }

    const memberships = await this.prisma.teamMembership.findMany({
      where: { userId },
      select: { teamId: true }
    });
    const teamIds = memberships.map((membership) => membership.teamId);

    return this.prisma.resourceFile.findMany({
      where: {
        OR: [{ teamId: null }, { teamId: { in: teamIds } }]
      },
      include: {
        team: {
          select: { id: true, name: true }
        }
      },
      orderBy: { uploadedAt: 'desc' }
    });
  }

  async create(payload: CreateResourceDto, actorId: string, role: Role) {
    if (role !== Role.administrator && payload.teamId) {
      const team = await this.prisma.team.findFirst({
        where: {
          id: payload.teamId,
          leaderId: actorId
        }
      });

      if (!team) {
        throw new ForbiddenException('Puoi caricare risorse solo per i tuoi team');
      }
    }

    const resource = await this.prisma.resourceFile.create({
      data: payload
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'resource.created',
        entityType: 'resourceFile',
        entityId: resource.id,
        metadata: toJsonValue(payload)
      }
    });

    return resource;
  }
}
