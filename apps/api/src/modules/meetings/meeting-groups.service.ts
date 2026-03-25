import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { toJsonValue } from '../../common/utils/json.util';
import { CreateMeetingGroupDto, UpdateMeetingGroupDto } from '@shift-complete/shared-types';

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
        members: group.members.map(m => m.user)
      })));
  }

  async create(payload: CreateMeetingGroupDto, actorId: string) {
    const group = await this.prisma.meetingGroup.create({
      data: {
        name: payload.name,
        description: payload.description,
        leaderId: payload.leaderId,
        groupId: payload.groupId,
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
        groupId: payload.groupId,
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
