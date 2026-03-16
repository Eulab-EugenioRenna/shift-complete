import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { toJsonValue } from '../../common/utils/json.util';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.team.findMany({
      include: {
        leader: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        memberships: {
          select: {
            id: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    }).then((teams) =>
      teams.map((team) => ({
        id: team.id,
        name: team.name,
        description: team.description,
        leader: team.leader,
        memberCount: team.memberships.length
      }))
    );
  }

  async create(payload: CreateTeamDto, actorId: string) {
    const team = await this.prisma.team.create({
      data: {
        name: payload.name,
        description: payload.description,
        leaderId: payload.leaderId
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'team.created',
        entityType: 'team',
        entityId: team.id,
        metadata: toJsonValue(payload)
      }
    });

    return team;
  }

  async addMember(teamId: string, userId: string, actorId: string) {
    const membership = await this.prisma.teamMembership.upsert({
      where: {
        teamId_userId: {
          teamId,
          userId
        }
      },
      update: {},
      create: {
        teamId,
        userId
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'team.member.added',
        entityType: 'teamMembership',
        entityId: membership.id,
        metadata: toJsonValue({
          teamId,
          userId
        })
      }
    });

    return membership;
  }

  async update(teamId: string, payload: UpdateTeamDto, actorId: string) {
    const team = await this.prisma.team.update({
      where: { id: teamId },
      data: payload
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'team.updated',
        entityType: 'team',
        entityId: team.id,
        metadata: toJsonValue(payload)
      }
    });

    return team;
  }

  async remove(teamId: string, actorId: string) {
    await this.prisma.team.delete({
      where: { id: teamId }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'team.deleted',
        entityType: 'team',
        entityId: teamId,
        metadata: toJsonValue({ teamId })
      }
    });

    return { deleted: true, id: teamId };
  }
}
