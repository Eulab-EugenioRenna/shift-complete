import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { toJsonValue } from '../../common/utils/json.util';
import { CreateTeamGroupDto, UpdateTeamGroupDto } from '@shift-complete/shared-types';

@Injectable()
export class TeamGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.teamGroup.findMany({
      include: {
        meetingGroups: {
          include: {
            leader: {
              select: { id: true, fullName: true, email: true },
            },
            members: {
              include: {
                user: {
                  select: { id: true, fullName: true, email: true, role: true },
                },
              },
            },
          },
          orderBy: { name: 'asc' },
        },
        teams: {
          include: {
            leader: {
              select: { id: true, fullName: true, email: true },
            },
            memberships: {
              select: {
                user: {
                  select: { id: true, fullName: true, email: true, role: true },
                },
              },
            },
            duties: {
              select: { id: true, name: true, color: true, icon: true },
              orderBy: { name: 'asc' },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }).then((groups) =>
      groups.map((group) => ({
        id: group.id,
        name: group.name,
        description: group.description,
        sortOrder: group.sortOrder,
        teams: group.teams.map((team) => ({
          id: team.id,
          name: team.name,
          description: team.description,
          leader: team.leader,
          memberCount: team.memberships.length,
          members: team.memberships.map((m) => m.user),
          duties: team.duties,
        })),
        meetingGroups: group.meetingGroups.map((meetingGroup) => ({
          id: meetingGroup.id,
          name: meetingGroup.name,
          description: meetingGroup.description,
          leaderId: meetingGroup.leaderId,
          groupId: meetingGroup.groupId,
          leader: meetingGroup.leader,
          members: meetingGroup.members.map((member) => member.user),
        })),
      }))
    );
  }

  async create(payload: CreateTeamGroupDto, actorId: string) {
    const group = await this.prisma.teamGroup.create({
      data: {
        name: payload.name ?? null,
        description: payload.description ?? null,
        sortOrder: payload.sortOrder ?? 0,
        meetingGroups: payload.meetingGroupIds?.length
          ? {
              connect: payload.meetingGroupIds.map((id) => ({ id })),
            }
          : undefined,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'team-group.created',
        entityType: 'teamGroup',
        entityId: group.id,
        metadata: toJsonValue(payload),
      },
    });

    return group;
  }

  async update(groupId: string, payload: UpdateTeamGroupDto, actorId: string) {
    const existing = await this.prisma.teamGroup.findUnique({ where: { id: groupId } });
    if (!existing) {
      throw new NotFoundException('Gruppo non trovato');
    }

    const group = await this.prisma.teamGroup.update({
      where: { id: groupId },
      data: {
        name: payload.name !== undefined ? payload.name : undefined,
        description: payload.description !== undefined ? payload.description : undefined,
        sortOrder: payload.sortOrder !== undefined ? payload.sortOrder : undefined,
        meetingGroups: payload.meetingGroupIds
          ? {
              set: payload.meetingGroupIds.map((id) => ({ id })),
            }
          : undefined,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'team-group.updated',
        entityType: 'teamGroup',
        entityId: group.id,
        metadata: toJsonValue(payload),
      },
    });

    return group;
  }

  async remove(groupId: string, actorId: string) {
    const existing = await this.prisma.teamGroup.findUnique({ where: { id: groupId } });
    if (!existing) {
      throw new NotFoundException('Gruppo non trovato');
    }

    await this.prisma.team.updateMany({
      where: { groupId },
      data: { groupId: null },
    });

    await this.prisma.meetingGroup.updateMany({
      where: { groupId },
      data: { groupId: null },
    });

    await this.prisma.teamGroup.delete({ where: { id: groupId } });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'team-group.deleted',
        entityType: 'teamGroup',
        entityId: groupId,
        metadata: toJsonValue({ groupId }),
      },
    });

    return { deleted: true, id: groupId };
  }

  async assignTeams(groupId: string, teamIds: string[], actorId: string) {
    const existing = await this.prisma.teamGroup.findUnique({ where: { id: groupId } });
    if (!existing) {
      throw new NotFoundException('Gruppo non trovato');
    }

    await this.prisma.team.updateMany({
      where: { groupId },
      data: { groupId: null },
    });

    if (teamIds.length) {
      await this.prisma.team.updateMany({
        where: { id: { in: teamIds } },
        data: { groupId },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'team-group.teams-assigned',
        entityType: 'teamGroup',
        entityId: groupId,
        metadata: toJsonValue({ teamIds }),
      },
    });

    return { updated: true, groupId, teamIds };
  }

  async assignMeetingGroups(groupId: string, meetingGroupIds: string[], actorId: string) {
    const existing = await this.prisma.teamGroup.findUnique({ where: { id: groupId } });
    if (!existing) {
      throw new NotFoundException('Gruppo non trovato');
    }

    await this.prisma.meetingGroup.updateMany({
      where: { groupId },
      data: { groupId: null },
    });

    if (meetingGroupIds.length) {
      await this.prisma.meetingGroup.updateMany({
        where: { id: { in: meetingGroupIds } },
        data: { groupId },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'team-group.meeting-groups-assigned',
        entityType: 'teamGroup',
        entityId: groupId,
        metadata: toJsonValue({ meetingGroupIds }),
      },
    });

    return { updated: true, groupId, meetingGroupIds };
  }
}
