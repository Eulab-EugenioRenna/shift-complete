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
    if (actorRole === Role.service_leader && !payload.teamId) {
      throw new ForbiddenException('Il leader deve selezionare un team per generare il planning');
    }

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
        },
        duty: {
          select: { id: true, name: true }
        }
      },
      orderBy: { startsAt: 'asc' }
    });

    const suggestions: Array<{
      slotId: string;
      roleName: string;
      teamName: string;
      startsAt: Date;
      coverageStatus: string;
      strategy: string;
      assigneeId: string | null;
      assigneeName?: string | null;
      score?: number | null;
      reasons?: string[];
      candidates?: Array<{ id: string; fullName: string; score: number; reasons: string[] }>;
    }> = [];
    for (const slot of slots) {
      const existingCoverage = slot.assignments.length > 0;
      if (existingCoverage && !payload.includeExistingAssignments) {
        suggestions.push({
          slotId: slot.id,
          roleName: slot.duty.name,
          teamName: slot.team.name,
          startsAt: slot.startsAt,
          coverageStatus: 'covered',
          strategy: 'keep-existing',
          assigneeId: slot.assignments[0]?.assigneeId ?? null
        });
        continue;
      }

      const suggestedVolunteer = await this.selectBestVolunteer(slot.teamId, slot.duty.name, slot.duty.id, slot.startsAt, slot.endsAt);
      suggestions.push({
        slotId: slot.id,
        roleName: slot.duty.name,
        teamName: slot.team.name,
        startsAt: slot.startsAt,
        coverageStatus: suggestedVolunteer ? 'suggested' : 'open',
        strategy: suggestedVolunteer ? `score:${suggestedVolunteer.score}` : 'no-candidate',
        assigneeId: suggestedVolunteer?.id ?? null,
        assigneeName: suggestedVolunteer?.fullName ?? null,
        score: suggestedVolunteer?.score ?? null,
        reasons: suggestedVolunteer?.reasons ?? [],
        candidates: suggestedVolunteer?.candidates ?? []
      });
    }

    if (payload.apply) {
      for (const suggestion of suggestions) {
        if (!suggestion.assigneeId || suggestion.coverageStatus === 'covered') {
          continue;
        }

        const existingConflictingAssignment = await this.prisma.assignment.findFirst({
          where: {
            assigneeId: suggestion.assigneeId,
            slotId: {
              not: suggestion.slotId
            },
            slot: {
              startsAt: {
                lte: new Date(suggestion.startsAt)
              },
              endsAt: {
                gt: new Date(suggestion.startsAt)
              }
            }
          }
        });

        if (existingConflictingAssignment) {
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

  private async selectBestVolunteer(teamId: string, dutyName: string, dutyId: string, startsAt: Date, endsAt: Date) {
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
            settings: true,
            assignments: {
              include: {
                slot: {
                  include: {
                    duty: true,
                    team: true
                  }
                }
              }
            }
          }
        }
      }
    });

    const eligible: Array<{ id: string; fullName: string; score: number; reasons: string[] }> = [];

    for (const candidate of members.map((membership) => membership.user)) {
      const hasConflict = candidate.assignments.some((assignment) => {
        const sameDay = assignment.slot.startsAt.toDateString() === startsAt.toDateString();
        const overlap = assignment.slot.endsAt > startsAt && assignment.slot.startsAt < endsAt;
        return sameDay || overlap;
      });

      if (hasConflict) {
        continue;
      }

      const unavailable = await this.prisma.availability.findFirst({
        where: {
          userId: candidate.id,
          type: 'UNAVAILABLE',
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt }
        }
      });

      if (unavailable) {
        continue;
      }

      const preferredShifts = (candidate.settings?.preferredShifts as string[] | null) ?? [];
      const preferredTeamIds = (candidate.settings?.preferredTeamIds as string[] | null) ?? [];
      const preferredDutyIds = (candidate.settings?.preferredDutyIds as string[] | null) ?? [];
      const competencies = (candidate.settings?.competencies as string[] | null) ?? [];
      const shiftCode = this.resolveShiftCode(startsAt);

      let score = 100;
      const reasons: string[] = ['base:100'];
      score -= candidate.assignments.length * 5;
      reasons.push(`fairness:-${candidate.assignments.length * 5}`);
      if (preferredTeamIds.includes(teamId)) {
        score += 30;
        reasons.push('preferred-team:+30');
      }
      if (preferredDutyIds.includes(dutyId)) {
        score += 30;
        reasons.push('preferred-duty:+30');
      }
      if (preferredShifts.includes(shiftCode)) {
        score += 20;
        reasons.push(`preferred-shift:${shiftCode}:+20`);
      }
      if (competencies.some((competency) => dutyName.toLowerCase().includes(competency.toLowerCase()) || competency.toLowerCase().includes(dutyName.toLowerCase()))) {
        score += 25;
        reasons.push('competency-match:+25');
      }

      eligible.push({
        id: candidate.id,
        fullName: candidate.fullName,
        score,
        reasons
      });
    }

    const ranked = eligible.sort((left, right) => right.score - left.score);
    const best = ranked[0] ?? null;
    if (!best) {
      return null;
    }

    return {
      ...best,
      candidates: ranked.slice(0, 5)
    };
  }

  private resolveShiftCode(startsAt: Date): string {
    const hour = startsAt.getHours();
    if (hour < 12) {
      return 'morning';
    }
    if (hour < 18) {
      return 'afternoon';
    }
    return 'evening';
  }
}
