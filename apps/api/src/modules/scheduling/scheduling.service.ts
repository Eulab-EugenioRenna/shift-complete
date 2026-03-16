import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { toJsonValue } from '../../common/utils/json.util';
import { PrismaService } from '../../database/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { GenerateScheduleDto } from './dto/generate-schedule.dto';

@Injectable()
export class SchedulingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway
  ) {}

  async generatePreview(payload: GenerateScheduleDto, actorId: string, actorRole: Role) {
    if (actorRole === Role.service_leader && payload.teamId) {
      const ownedTeam = await this.prisma.team.findFirst({
        where: {
          id: payload.teamId,
          leaderId: actorId
        }
      });

      if (!ownedTeam) {
        throw new ForbiddenException('Il leader puo generare solo per i propri team');
      }
    }

    const slots = await this.prisma.eventSlot.findMany({
      where: {
        startsAt: {
          gte: new Date(payload.from),
          lte: new Date(payload.to)
        },
        teamId: payload.teamId ?? undefined
      },
      include: {
        assignments: true,
        team: {
          select: { name: true }
        }
      },
      orderBy: { startsAt: 'asc' }
    });

    const suggestions = [];
    for (const slot of slots) {
      const existingCoverage = slot.assignments.length > 0;
      if (existingCoverage && !payload.includeExistingAssignments) {
        suggestions.push({
          slotId: slot.id,
          roleName: slot.roleName,
          teamName: slot.team.name,
          startsAt: slot.startsAt,
          coverageStatus: 'covered',
          strategy: 'keep-existing',
          assigneeId: slot.assignments[0]?.assigneeId ?? null
        });
        continue;
      }

      const suggestedVolunteer = await this.selectBestVolunteer(slot.teamId, slot.startsAt, slot.endsAt);
      suggestions.push({
        slotId: slot.id,
        roleName: slot.roleName,
        teamName: slot.team.name,
        startsAt: slot.startsAt,
        coverageStatus: suggestedVolunteer ? 'suggested' : 'open',
        strategy: suggestedVolunteer ? 'fairness-availability-skill' : 'no-candidate',
        assigneeId: suggestedVolunteer?.id ?? null,
        assigneeName: suggestedVolunteer?.fullName ?? null
      });
    }

    if (payload.apply) {
      for (const suggestion of suggestions) {
        if (!suggestion.assigneeId || suggestion.coverageStatus === 'covered') {
          continue;
        }

        await this.prisma.assignment.upsert({
          where: {
            id: `auto-${suggestion.slotId}-${suggestion.assigneeId}`
          },
          update: {
            status: 'assigned',
            autoAssigned: true,
            assigneeId: suggestion.assigneeId
          },
          create: {
            id: `auto-${suggestion.slotId}-${suggestion.assigneeId}`,
            slotId: suggestion.slotId,
            assigneeId: suggestion.assigneeId,
            status: 'assigned',
            autoAssigned: true
          }
        });
      }
    }

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'scheduling.preview.generated',
        entityType: 'schedulePreview',
        entityId: payload.teamId ?? 'global',
        metadata: toJsonValue(payload)
      }
    });

    this.realtimeGateway.broadcastSchedulingUpdate({
      kind: 'scheduling.preview.generated',
      actorId,
      teamId: payload.teamId ?? null,
      suggestions: suggestions.length,
      applied: Boolean(payload.apply)
    });

    return {
      message: 'Scheduling preview generated',
      criteria: ['fairness', 'availability', 'skills', 'rest-window', 'substitution-priority'],
      suggestions
    };
  }

  private async selectBestVolunteer(teamId: string, startsAt: Date, endsAt: Date) {
    const members = await this.prisma.teamMembership.findMany({
      where: {
        teamId,
        user: {
          role: Role.volunteer
        }
      },
      include: {
        user: {
          include: {
            assignments: {
              include: {
                slot: true
              }
            }
          }
        }
      }
    });

    const eligible = members
      .map((membership) => membership.user)
      .filter((user) =>
        user.assignments.every(
          (assignment) => assignment.slot.endsAt <= startsAt || assignment.slot.startsAt >= endsAt
        )
      )
      .sort((left, right) => left.assignments.length - right.assignments.length);

    return eligible[0] ?? null;
  }
}
