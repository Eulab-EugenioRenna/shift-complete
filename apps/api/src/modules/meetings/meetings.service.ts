import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DomainSyncService } from '../domain-sync/domain-sync.service';
import { toJsonValue } from '../../common/utils/json.util';
import { CreateMeetingDto, ExtendedUpdateMeetingDto } from '@shift-complete/shared-types';
import { Role, EventType } from '@prisma/client';
import { RRule, RRuleSet, rrulestr } from 'rrule';

@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly domainSync: DomainSyncService
  ) {}

  async getById(meetingId: string, actorId: string, actorRole: Role) {
    const meetingRef = this.resolveMeetingReference(meetingId);
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingRef.meetingId },
      include: {
        meetingGroup: {
          select: {
            id: true,
            name: true,
            leaderId: true,
            members: {
              select: { userId: true }
            }
          }
        },
        team: {
          select: {
            id: true,
            name: true,
            leaderId: true,
            memberships: {
              select: { userId: true }
            }
          }
        }
      }
    });

    if (!meeting) {
      throw new NotFoundException('Riunione non trovata');
    }

    await this.assertCanReadMeeting(meeting, actorId, actorRole);

    return this.mapMeetingEntity(meeting);
  }

  async list(start?: string, end?: string) {
    let whereClause: any = {};
    
    if (start || end) {
      const dateRange: any = {};
      
      if (start) {
        dateRange.gte = new Date(start);
      }
      
      if (end) {
        dateRange.lte = new Date(end);
        // Add one day to include the entire end date if it's just a date string
        if (end.length <= 10) { 
          const endDate = new Date(end);
          endDate.setDate(endDate.getDate() + 1);
          dateRange.lt = endDate;
          delete dateRange.lte;
        }
      }
      
      whereClause = {
        OR: [
          {
            // Single meetings within range
            type: 'single',
            startsAt: dateRange,
          },
          {
            // Recurring meetings that overlap
            type: 'recurring',
            startsAt: { lte: dateRange.lt || dateRange.lte || undefined },
            OR: [
              { recurrenceUntil: null },
              { recurrenceUntil: { gte: dateRange.gte || undefined } }
            ]
          },
          {
             // Exceptions that fall in the range
             parentMeetingId: { not: null },
             startsAt: dateRange
          }
        ]
      };
    }

    const meetings = await this.prisma.meeting.findMany({
      where: whereClause,
      include: {
        meetingGroup: {
          select: { id: true, name: true }
        },
        team: {
          select: { id: true, name: true }
        }
      },
      orderBy: { startsAt: 'asc' }
    });

    return this.expandRecurringMeetings(meetings, start ? new Date(start) : undefined, end ? new Date(end) : undefined);
  }

  async create(payload: CreateMeetingDto, actorId: string, actorRole: Role) {
    const isRecurring = !!payload.recurrenceRule;
    this.assertMeetingOwner(payload.teamId, payload.meetingGroupId);

    const meeting = await this.prisma.meeting.create({
      data: {
        title: payload.title,
        description: payload.description,
        locationValue: payload.locationValue,
        startsAt: new Date(payload.startsAt),
        endsAt: new Date(payload.endsAt),
        type: isRecurring ? 'recurring' : 'single',
        recurrenceRule: payload.recurrenceRule,
        recurrenceTz: payload.recurrenceTz,
        recurrenceUntil: payload.recurrenceUntil ? new Date(payload.recurrenceUntil) : undefined,
        recurrenceDurationMonths: payload.recurrenceDurationMonths,
        recurrenceAutoRenew: payload.recurrenceAutoRenew,
        recurrenceRenewMonths: payload.recurrenceRenewMonths,
        meetingGroupId: payload.meetingGroupId ?? null,
        teamId: payload.teamId ?? null,
        createdById: actorId
      },
      include: {
        meetingGroup: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } }
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'meeting.created',
        entityType: 'meeting',
        entityId: meeting.id,
        metadata: toJsonValue(payload)
      }
    });

    const userIds = await this.getMeetingParticipants(meeting.teamId, meeting.meetingGroupId);
    for (const uid of userIds) {
      if (uid === actorId) continue;
      await this.notificationsService.pushSystemNotification(
        uid,
        'Nuova Riunione Programmata',
        `È stata programmata una nuova riunione: "${meeting.title}" il ${new Date(meeting.startsAt).toLocaleDateString('it-IT')}.`,
        '/events',
        { template: 'meeting_created', meetingId: meeting.id }
      );
    }

    return this.mapMeetingEntity(meeting);
  }

  async update(meetingId: string, payload: ExtendedUpdateMeetingDto, actorId: string, actorRole: Role) {
    const meetingRef = this.resolveMeetingReference(meetingId, payload.occurrenceStart);

    if (payload.editMode === 'single' && meetingRef.occurrenceStart) {
      return this.updateSingleOccurrence(meetingRef.meetingId, meetingRef.occurrenceStart, payload, actorId, actorRole);
    }

    const meeting = await this.prisma.meeting.findUniqueOrThrow({
      where: { id: meetingRef.meetingId },
      include: {
        meetingGroup: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } }
      }
    });

    const nextTeamId = payload.teamId !== undefined ? payload.teamId ?? null : meeting.teamId ?? null;
    const nextMeetingGroupId = payload.meetingGroupId !== undefined ? payload.meetingGroupId ?? null : meeting.meetingGroupId ?? null;
    this.assertMeetingOwner(nextTeamId, nextMeetingGroupId);

    const isRecurring = payload.recurrenceRule !== undefined ? !!payload.recurrenceRule : meeting.type === 'recurring';

    const updated = await this.prisma.meeting.update({
      where: { id: meetingRef.meetingId },
      data: {
        title: payload.title,
        description: payload.description,
        locationValue: payload.locationValue,
        startsAt: payload.startsAt ? new Date(payload.startsAt) : undefined,
        endsAt: payload.endsAt ? new Date(payload.endsAt) : undefined,
        type: isRecurring ? 'recurring' : 'single',
        recurrenceRule: payload.recurrenceRule,
        recurrenceTz: payload.recurrenceTz,
        recurrenceUntil: payload.recurrenceUntil ? new Date(payload.recurrenceUntil) : undefined,
        recurrenceDurationMonths: payload.recurrenceDurationMonths,
        recurrenceAutoRenew: payload.recurrenceAutoRenew,
        recurrenceRenewMonths: payload.recurrenceRenewMonths,
        meetingGroupId: payload.meetingGroupId !== undefined ? payload.meetingGroupId ?? null : undefined,
        teamId: payload.teamId !== undefined ? payload.teamId ?? null : undefined,
      },
      include: {
        meetingGroup: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } }
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'meeting.updated',
        entityType: 'meeting',
        entityId: updated.id,
        metadata: toJsonValue(payload)
      }
    });

    const userIds = await this.getMeetingParticipants(updated.teamId, updated.meetingGroupId);
    for (const uid of userIds) {
      if (uid === actorId) continue;
      await this.notificationsService.pushSystemNotification(
        uid,
        'Riunione Modificata',
        `La riunione "${updated.title}" è stata modificata. Controlla il calendario per i dettagli.`,
        '/events',
        { template: 'meeting_updated', meetingId: updated.id }
      );
    }

    return this.mapMeetingEntity(updated);
  }

  async remove(meetingId: string, actorId: string, actorRole: Role, mode?: 'single' | 'series', occurrenceStart?: string) {
    const meetingRef = this.resolveMeetingReference(meetingId, occurrenceStart);

    if (mode === 'single' && meetingRef.occurrenceStart) {
      return this.removeSingleOccurrence(meetingRef.meetingId, meetingRef.occurrenceStart, actorId, actorRole);
    }

    const meeting = await this.prisma.meeting.findUniqueOrThrow({
      where: { id: meetingRef.meetingId },
      include: {
        parentMeeting: true
      }
    });

    const targetMeeting = mode === 'series' && meeting.parentMeetingId && meeting.parentMeeting ? meeting.parentMeeting : meeting;

    await this.prisma.meeting.delete({ where: { id: targetMeeting.id } });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'meeting.deleted',
        entityType: 'meeting',
        entityId: targetMeeting.id,
        metadata: toJsonValue({ meetingId: targetMeeting.id, mode: mode ?? 'single' })
      }
    });

    const userIds = await this.getMeetingParticipants(targetMeeting.teamId, targetMeeting.meetingGroupId);
    for (const uid of userIds) {
      if (uid === actorId) continue;
      await this.notificationsService.pushSystemNotification(
        uid,
        'Riunione Annullata',
        `La riunione "${targetMeeting.title}" è stata annullata.`,
        '/events',
        { template: 'meeting_deleted', meetingId: targetMeeting.id }
      );
    }

    return { deleted: true, id: targetMeeting.id };
  }

  private resolveMeetingReference(meetingId: string, inputOccurrenceStart?: string) {
    if (meetingId.includes(':')) {
      const [actualId, occurrenceDate] = meetingId.split(':');
      return { meetingId: actualId, occurrenceStart: inputOccurrenceStart ?? occurrenceDate };
    }
    return { meetingId, occurrenceStart: inputOccurrenceStart };
  }

  private async updateSingleOccurrence(parentMeetingId: string, occurrenceStart: string, payload: ExtendedUpdateMeetingDto, actorId: string, actorRole: Role) {
    const parent = await this.prisma.meeting.findUniqueOrThrow({
      where: { id: parentMeetingId }
    });

    let exception = await this.prisma.meeting.findFirst({
      where: {
        parentMeetingId,
        historicalSnapshot: { path: ['occurrenceStart'], equals: occurrenceStart }
      }
    });

    if (!exception) {
      const originalStartsAt = new Date(occurrenceStart);
      const originalDuration = parent.endsAt.getTime() - parent.startsAt.getTime();
      const originalEndsAt = new Date(originalStartsAt.getTime() + originalDuration);

      exception = await this.prisma.meeting.create({
        data: {
          title: parent.title,
          description: parent.description,
          locationValue: parent.locationValue,
          startsAt: originalStartsAt,
          endsAt: originalEndsAt,
          type: 'single',
          parentMeetingId,
          historicalSnapshot: toJsonValue({
            occurrenceStart,
            mode: 'modified',
            originalStartsAt: originalStartsAt.toISOString(),
            originalEndsAt: originalEndsAt.toISOString()
          }),
          meetingGroupId: parent.meetingGroupId,
          teamId: parent.teamId,
          createdById: actorId
        }
      });
    }

    const updated = await this.prisma.meeting.update({
      where: { id: exception.id },
      data: {
        title: payload.title,
        description: payload.description,
        locationValue: payload.locationValue,
        startsAt: payload.startsAt ? new Date(payload.startsAt) : undefined,
        endsAt: payload.endsAt ? new Date(payload.endsAt) : undefined,
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'meeting.occurrence_updated',
        entityType: 'meeting',
        entityId: updated.id,
        metadata: toJsonValue(payload)
      }
    });

    const userIds = await this.getMeetingParticipants(parent.teamId, parent.meetingGroupId);
    for (const uid of userIds) {
      if (uid === actorId) continue;
      await this.notificationsService.pushSystemNotification(
        uid,
        'Riunione Modificata',
        `La riunione "${updated.title}" è stata spostata o modificata.`,
        '/events',
        { template: 'meeting_occurrence_updated', meetingId: updated.id }
      );
    }

    return updated;
  }

  private async removeSingleOccurrence(parentMeetingId: string, occurrenceStart: string, actorId: string, actorRole: Role) {
    let exception = await this.prisma.meeting.findFirst({
      where: {
        parentMeetingId,
        historicalSnapshot: { path: ['occurrenceStart'], equals: occurrenceStart }
      }
    });

    if (exception) {
      const snapshot: any = exception.historicalSnapshot ?? {};
      snapshot.mode = 'cancelled';
      
      await this.prisma.meeting.update({
        where: { id: exception.id },
        data: { historicalSnapshot: toJsonValue(snapshot) }
      });
    } else {
      const parent = await this.prisma.meeting.findUniqueOrThrow({
        where: { id: parentMeetingId }
      });

      const originalStartsAt = new Date(occurrenceStart);
      const originalDuration = parent.endsAt.getTime() - parent.startsAt.getTime();
      const originalEndsAt = new Date(originalStartsAt.getTime() + originalDuration);

      await this.prisma.meeting.create({
        data: {
          title: parent.title,
          description: parent.description,
          locationValue: parent.locationValue,
          startsAt: originalStartsAt,
          endsAt: originalEndsAt,
          type: 'single',
          parentMeetingId,
          historicalSnapshot: toJsonValue({
            occurrenceStart,
            mode: 'cancelled'
          }),
          meetingGroupId: parent.meetingGroupId,
          teamId: parent.teamId,
          createdById: actorId
        }
      });
    }

    const parent = await this.prisma.meeting.findUnique({
      where: { id: parentMeetingId }
    });

    if (parent) {
      const userIds = await this.getMeetingParticipants(parent.teamId, parent.meetingGroupId);
      for (const uid of userIds) {
        if (uid === actorId) continue;
        await this.notificationsService.pushSystemNotification(
          uid,
          'Riunione Annullata',
          `Una ricorrenza della riunione "${parent.title}" è stata annullata.`,
          '/events',
          { template: 'meeting_occurrence_deleted', meetingId: parentMeetingId }
        );
      }
    }

    return { deleted: true, eventId: parentMeetingId, occurrenceStart };
  }

  private async getMeetingParticipants(teamId?: string | null, meetingGroupId?: string | null): Promise<string[]> {
    const userIds = new Set<string>();

    if (teamId) {
      const team = await this.prisma.team.findUnique({
        where: { id: teamId },
        include: {
          memberships: {
            select: { userId: true }
          }
        }
      });

      team?.memberships.forEach((membership) => userIds.add(membership.userId));
      if (team?.leaderId) {
        userIds.add(team.leaderId);
      }
    }
    
    if (meetingGroupId) {
      const groupData = await this.prisma.meetingGroup.findUnique({
        where: { id: meetingGroupId },
        include: { members: true }
      });
      if (groupData) {
        groupData.members.forEach((m: { userId: string }) => userIds.add(m.userId));
        if (groupData.leaderId) {
          userIds.add(groupData.leaderId);
        }
      }
    }
    
    return Array.from(userIds);
  }

  private assertMeetingOwner(teamId?: string | null, meetingGroupId?: string | null): void {
    const hasTeam = Boolean(teamId);
    const hasMeetingGroup = Boolean(meetingGroupId);

    if (!hasTeam && !hasMeetingGroup) {
      throw new BadRequestException('Specifica un team o un gruppo riunione.');
    }

    if (hasTeam && hasMeetingGroup) {
      throw new BadRequestException('Una riunione puo appartenere solo a un team o a un gruppo riunione.');
    }
  }

  private async assertCanReadMeeting(meeting: any, actorId: string, actorRole: Role): Promise<void> {
    if (actorRole === Role.administrator) {
      return;
    }

    if (meeting.team) {
      const canReadTeamMeeting = meeting.team.leaderId === actorId
        || (meeting.team.memberships ?? []).some((membership: { userId: string }) => membership.userId === actorId);

      if (canReadTeamMeeting) {
        return;
      }
    }

    if (meeting.meetingGroup) {
      const canReadMeetingGroupMeeting = meeting.meetingGroup.leaderId === actorId
        || (meeting.meetingGroup.members ?? []).some((member: { userId: string }) => member.userId === actorId);

      if (canReadMeetingGroupMeeting) {
        return;
      }
    }

    throw new ForbiddenException('Non puoi consultare questa riunione');
  }

  private mapMeetingEntity(meeting: any) {
    return {
      ...meeting,
      team: meeting.team ? { id: meeting.team.id, name: meeting.team.name } : null,
      meetingGroup: meeting.meetingGroup ? { id: meeting.meetingGroup.id, name: meeting.meetingGroup.name } : null,
      ownerType: meeting.teamId ? 'team' : 'meetingGroup',
    };
  }

  private expandRecurringMeetings(meetings: any[], periodStart?: Date, periodEnd?: Date) {
    const expanded: any[] = [];
    const baseMeetings = meetings.filter(m => !m.parentMeetingId);
    const childMeetings = meetings.filter(m => m.parentMeetingId);
    
    const childBySeriesOccurrence = new Map<string, any>();
    const cancelledOccurrences = new Set<string>();
    
    for (const child of childMeetings) {
      const snapshot: any = child.historicalSnapshot;
      const occurrenceStart = snapshot?.occurrenceStart ?? child.startsAt.toISOString();
      const key = `${child.parentMeetingId}:${occurrenceStart}`;
      if (snapshot?.mode === 'cancelled') {
        cancelledOccurrences.add(key);
        continue;
      }
      childBySeriesOccurrence.set(key, child);
    }

    for (const meeting of baseMeetings) {
      if (meeting.type !== 'recurring') {
        expanded.push({ ...this.mapMeetingEntity(meeting), seriesId: undefined, isOccurrence: false });
        continue;
      }

      try {
        if (!meeting.recurrenceRule) continue;
        
        let rruleStr = meeting.recurrenceRule;
        if (!rruleStr.includes('DTSTART')) {
          const dtStart = new Date(meeting.startsAt).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
          rruleStr = `DTSTART:${dtStart}\n${rruleStr}`;
        }
        
        const rule = rruleStr.includes('EXDATE') || rruleStr.includes('RDATE') 
          ? rrulestr(rruleStr, { forceset: true }) as RRuleSet 
          : rrulestr(rruleStr) as RRule;
          
        const maxDate = meeting.recurrenceUntil ? new Date(meeting.recurrenceUntil) : 
                        periodEnd ? new Date(periodEnd.getTime() + 86400000) : 
                        new Date(Date.now() + 31536000000); // 1 year limit default
                        
        const minDate = periodStart ? new Date(periodStart.getTime() - 86400000) : 
                        new Date(meeting.startsAt.getTime() - 86400000);

        const dates = rule.between(minDate, maxDate, true);
        const duration = new Date(meeting.endsAt).getTime() - new Date(meeting.startsAt).getTime();

        for (const date of dates) {
          const isoStart = date.toISOString();
          const key = `${meeting.id}:${isoStart}`;
          
          if (cancelledOccurrences.has(key)) continue;
          
          const exception = childBySeriesOccurrence.get(key);
          if (exception) {
            expanded.push({ ...this.mapMeetingEntity(exception), isOccurrence: true, seriesId: meeting.id, parentMeetingId: meeting.id, seriesTemplate: meeting });
            continue;
          }

          const end = new Date(date.getTime() + duration);
          expanded.push({
            ...this.mapMeetingEntity(meeting),
            id: `${meeting.id}:${isoStart}`,
            startsAt: date,
            endsAt: end,
            isOccurrence: true,
            isVirtualOccurrence: true,
            seriesId: meeting.id,
            parentMeetingId: meeting.id,
            occurrenceStart: isoStart,
            seriesTemplate: meeting
          });
        }
      } catch (err) {
        console.warn(`Failed to expand recurrence for meeting ${meeting.id}:`, err);
        expanded.push({ ...this.mapMeetingEntity(meeting), seriesId: undefined, isOccurrence: false });
      }
    }

    // Sort all expanded instances correctly by start time
    return expanded.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }
}
