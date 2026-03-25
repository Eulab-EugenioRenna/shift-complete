import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { toJsonValue } from '../../common/utils/json.util';
import { CreateMeetingGroupDto, UpdateMeetingGroupDto } from '@shift-complete/shared-types';
import { Role } from '@prisma/client';

@Injectable()
export class MeetingGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.meetingGroup.findMany({
      include: {
        group: {
          select: { id: true, name: true }
        },
        leader: {
          select: { id: true, fullName: true, email: true }
        },
        members: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true, role: true }
            }
          }
        },
        meetings: {
          select: {
            id: true,
            title: true,
            startsAt: true,
            endsAt: true,
            type: true,
          },
          orderBy: { startsAt: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
    }).then(groups => groups.map(group => ({
      id: group.id,
        name: group.name,
        description: group.description,
        leaderId: group.leaderId,
        groupId: group.groupId,
        leader: group.leader,
        members: group.members.map(m => m.user),
        meetings: group.meetings,
      })));
  }

  async getById(id: string, actorId: string, actorRole: Role) {
    const group = await this.prisma.meetingGroup.findUnique({
      where: { id },
      include: {
        group: {
          select: { id: true, name: true, description: true }
        },
        leader: {
          select: { id: true, fullName: true, email: true }
        },
        members: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true, role: true }
            }
          }
        },
        meetings: {
          include: {
            team: {
              select: { id: true, name: true }
            }
          },
          orderBy: { startsAt: 'asc' }
        }
      }
    });

    if (!group) {
      throw new NotFoundException('Gruppo riunione non trovato');
    }

    await this.assertCanReadGroup(group, actorId, actorRole);

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      leaderId: group.leaderId,
      groupId: group.groupId,
      group: group.group,
      leader: group.leader,
      members: group.members.map((member) => member.user),
      meetings: group.meetings.map((meeting) => ({
        id: meeting.id,
        meetingGroupId: meeting.meetingGroupId,
        teamId: meeting.teamId,
        title: meeting.title,
        description: meeting.description,
        locationValue: meeting.locationValue,
        startsAt: meeting.startsAt,
        endsAt: meeting.endsAt,
        type: meeting.type,
        recurrenceRule: meeting.recurrenceRule,
        recurrenceTz: meeting.recurrenceTz,
        recurrenceUntil: meeting.recurrenceUntil,
        recurrenceDurationMonths: meeting.recurrenceDurationMonths,
        recurrenceAutoRenew: meeting.recurrenceAutoRenew,
        recurrenceRenewMonths: meeting.recurrenceRenewMonths,
        parentMeetingId: meeting.parentMeetingId,
        team: meeting.team,
        meetingGroup: { id: group.id, name: group.name },
        ownerType: 'meetingGroup' as const,
      }))
    };
  }

  private async assertCanReadGroup(group: any, actorId: string, actorRole: Role): Promise<void> {
    if (actorRole === Role.administrator) {
      return;
    }

    const isLeader = group.leaderId === actorId;
    const isMember = (group.members ?? []).some((member: { user?: { id: string } }) => member.user?.id === actorId);

    if (isLeader || isMember) {
      return;
    }

    if (group.groupId && actorRole === Role.service_leader) {
      const owningGroup = await this.prisma.teamGroup.findFirst({
        where: {
          id: group.groupId,
          teams: {
            some: {
              leaderId: actorId,
            }
          }
        },
        select: { id: true }
      });

      if (owningGroup) {
        return;
      }
    }

    throw new ForbiddenException('Non puoi consultare questo gruppo riunione');
  }

  async create(payload: CreateMeetingGroupDto, actorId: string) {
    const group = await this.prisma.meetingGroup.create({
        data: {
          name: payload.name,
          description: payload.description,
          leaderId: payload.leaderId,
          groupId: payload.groupId ?? null,
        }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'meeting-group.created',
        entityType: 'meetingGroup',
        entityId: group.id,
        metadata: toJsonValue(payload)
      }
    });

    return group;
  }

  async update(id: string, payload: UpdateMeetingGroupDto, actorId: string) {
    const existing = await this.prisma.meetingGroup.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Gruppo riunione non trovato');

    const group = await this.prisma.meetingGroup.update({
      where: { id },
        data: {
          name: payload.name,
          description: payload.description,
          leaderId: payload.leaderId,
          groupId: payload.groupId !== undefined ? payload.groupId ?? null : undefined,
        }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'meeting-group.updated',
        entityType: 'meetingGroup',
        entityId: group.id,
        metadata: toJsonValue(payload)
      }
    });

    return group;
  }

  async remove(id: string, actorId: string) {
    const existing = await this.prisma.meetingGroup.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Gruppo riunione non trovato');

    await this.prisma.meetingGroup.delete({ where: { id } });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'meeting-group.deleted',
        entityType: 'meetingGroup',
        entityId: id,
        metadata: toJsonValue({ id })
      }
    });

    return { deleted: true, id };
  }

  async assignMembers(groupId: string, userIds: string[], actorId: string) {
    const existing = await this.prisma.meetingGroup.findUnique({ where: { id: groupId } });
    if (!existing) throw new NotFoundException('Gruppo riunione non trovato');

    // Remove all current members
    await this.prisma.meetingGroupMember.deleteMany({
      where: { groupId }
    });

    // Add new members
    if (userIds.length) {
      await this.prisma.meetingGroupMember.createMany({
        data: userIds.map(userId => ({
          groupId,
          userId
        }))
      });
    }

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'meeting-group.members-assigned',
        entityType: 'meetingGroup',
        entityId: groupId,
        metadata: toJsonValue({ userIds })
      }
    });

    return { updated: true, groupId, userIds };
  }
}
