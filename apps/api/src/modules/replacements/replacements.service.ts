import { ForbiddenException, Injectable } from '@nestjs/common';
import { ReplacementStatus, Role } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { toJsonValue } from '../../common/utils/json.util';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateReplacementDto, ResolveReplacementDto } from '@shift-complete/shared-types';

@Injectable()
export class ReplacementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService
  ) {}

  private async getReplacementCandidates(slot: { id: string; teamId: string; duty?: { id?: string | null; name?: string | null } | null; startsAt: Date; endsAt: Date }, replacementAssignmentId: string) {
    const members = await this.prisma.teamMembership.findMany({
      where: {
        teamId: slot.teamId,
        user: {
          role: Role.volunteer,
        },
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
                    team: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const eligible: Array<{ id: string; fullName: string; email: string; score: number; reasons: string[] }> = [];
    for (const candidate of members.map((membership) => membership.user)) {
      const hasConflict = candidate.assignments.some((assignment) => {
        if (assignment.id === replacementAssignmentId) {
          return false;
        }
        const sameDay = assignment.slot.startsAt.toDateString() === slot.startsAt.toDateString();
        const overlap = assignment.slot.endsAt > slot.startsAt && assignment.slot.startsAt < slot.endsAt;
        return sameDay || overlap;
      });

      if (hasConflict) {
        continue;
      }

      const unavailable = await this.prisma.availability.findFirst({
        where: {
          userId: candidate.id,
          type: 'UNAVAILABLE',
          startsAt: { lt: slot.endsAt },
          endsAt: { gt: slot.startsAt },
        },
      });

      if (unavailable) {
        continue;
      }

      const preferredShifts = (candidate.settings?.preferredShifts as string[] | null) ?? [];
      const preferredTeamIds = (candidate.settings?.preferredTeamIds as string[] | null) ?? [];
      const preferredDutyIds = (candidate.settings?.preferredDutyIds as string[] | null) ?? [];
      const competencies = (candidate.settings?.competencies as string[] | null) ?? [];

      let score = 100;
      const reasons: string[] = ['base:100'];
      score -= candidate.assignments.length * 5;
      reasons.push(`fairness:-${candidate.assignments.length * 5}`);

      if (preferredTeamIds.includes(slot.teamId)) {
        score += 30;
        reasons.push('preferred-team:+30');
      }

      if (slot.duty?.id && preferredDutyIds.includes(slot.duty.id)) {
        score += 30;
        reasons.push('preferred-duty:+30');
      }

      const hour = slot.startsAt.getHours();
      const shiftCode = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
      if (preferredShifts.includes(shiftCode)) {
        score += 20;
        reasons.push(`preferred-shift:${shiftCode}:+20`);
      }

      if ((slot.duty?.name ?? '') && competencies.some((competency) => slot.duty?.name?.toLowerCase().includes(competency.toLowerCase()) || competency.toLowerCase().includes((slot.duty?.name ?? '').toLowerCase()))) {
        score += 25;
        reasons.push('competency-match:+25');
      }

      eligible.push({
        id: candidate.id,
        fullName: candidate.fullName,
        email: candidate.email,
        score,
        reasons,
      });
    }

    return eligible.sort((left, right) => right.score - left.score).slice(0, 5);
  }

  async list(actorId: string, role: Role) {
    const where = role === Role.administrator
      ? undefined
      : role === Role.service_leader
        ? {
            assignment: {
              slot: {
                team: {
                  leaderId: actorId
                }
              }
            }
          }
        : {
            OR: [
              { requestedByUserId: actorId },
              { assignment: { assigneeId: actorId } }
            ]
          };

    const replacements = await this.prisma.replacement.findMany({
      where,
      include: {
        requestedBy: {
          select: { id: true, fullName: true, email: true }
        },
        replacementAssignee: {
          select: { id: true, fullName: true, email: true }
        },
        assignment: {
          include: {
            assignee: {
              select: { id: true, fullName: true, email: true }
            },
            slot: {
              include: {
                team: { select: { name: true } },
                duty: { select: { name: true } },
                event: { select: { title: true } }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return Promise.all(
      replacements.map(async (replacement) => {
        const candidates = await this.getReplacementCandidates(
          {
            id: replacement.assignment.slot.id,
            teamId: replacement.assignment.slot.teamId,
            duty: replacement.assignment.slot.duty,
            startsAt: replacement.assignment.slot.startsAt,
            endsAt: replacement.assignment.slot.endsAt,
          },
          replacement.assignmentId
        );

        return {
          ...replacement,
          suggestedReplacement: candidates[0] ?? null,
          suggestedCandidates: candidates,
        };
      })
    );
  }

  async create(actorId: string, role: Role, payload: CreateReplacementDto) {
    const assignment = await this.prisma.assignment.findUniqueOrThrow({
      where: { id: payload.assignmentId },
      include: {
        slot: {
          include: {
            team: true,
            duty: true,
            event: true
          }
        }
      }
    });

    if (role === Role.volunteer && assignment.assigneeId !== actorId) {
      throw new ForbiddenException('Puoi richiedere sostituzione solo per i tuoi turni');
    }

    if (role === Role.service_leader && assignment.slot.team.leaderId !== actorId) {
      throw new ForbiddenException('Puoi operare solo sulle sostituzioni dei tuoi team');
    }

    const replacement = await this.prisma.replacement.create({
      data: {
        assignmentId: payload.assignmentId,
        requestedByUserId: actorId,
        reason: payload.reason
      },
      include: {
        requestedBy: {
          select: { id: true, fullName: true, email: true }
        },
        replacementAssignee: {
          select: { id: true, fullName: true, email: true }
        },
        assignment: {
          include: {
            assignee: {
              select: { id: true, fullName: true, email: true }
            },
            slot: {
              include: {
                team: { select: { name: true } },
                duty: { select: { name: true } },
                event: { select: { title: true } }
              }
            }
          }
        }
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'replacement.created',
        entityType: 'replacement',
        entityId: replacement.id,
        metadata: toJsonValue(payload)
      }
    });

    if (assignment.slot.team.leaderId) {
      await this.notificationsService.pushSystemNotification(
        assignment.slot.team.leaderId,
        'Nuova richiesta sostituzione',
        `${replacement.requestedBy?.fullName ?? 'Un volontario'} ha richiesto una sostituzione per ${assignment.slot.event.title}${payload.reason ? `: ${payload.reason}` : ''}`,
        '/replacements'
      );
    }

    return replacement;
  }

  async resolve(replacementId: string, actorId: string, role: Role, payload: ResolveReplacementDto) {
    const replacement = await this.prisma.replacement.findUniqueOrThrow({
      where: { id: replacementId },
      include: {
        assignment: {
          include: {
            assignee: {
              select: { id: true, fullName: true, email: true }
            },
            slot: {
              include: {
                team: true,
                event: true
              }
            }
          }
        },
        requestedBy: {
          select: { id: true, fullName: true }
        }
      }
    });

    if (role !== Role.administrator && replacement.assignment.slot.team.leaderId !== actorId) {
      throw new ForbiddenException('Solo Amministratore o Leader del team puo risolvere la richiesta');
    }

    if (replacement.status !== ReplacementStatus.PENDING) {
      throw new ForbiddenException('La richiesta di sostituzione e gia stata gestita');
    }

    if (payload.status === 'APPROVED' && !payload.replacementAssigneeId) {
      throw new ForbiddenException('Se approvi una sostituzione devi selezionare un sostituto');
    }

    if (payload.status === 'APPROVED' && payload.replacementAssigneeId) {
      const membership = await this.prisma.teamMembership.findUnique({
        where: {
          teamId_userId: {
            teamId: replacement.assignment.slot.teamId,
            userId: payload.replacementAssigneeId
          }
        }
      });

      if (!membership) {
        throw new ForbiddenException('Il sostituto deve appartenere al team del servizio');
      }

      const conflictingAssignment = await this.prisma.assignment.findFirst({
        where: {
          assigneeId: payload.replacementAssigneeId,
          id: {
            not: replacement.assignmentId
          },
          slot: {
            startsAt: {
              lt: replacement.assignment.slot.endsAt
            },
            endsAt: {
              gt: replacement.assignment.slot.startsAt
            }
          }
        }
      });

      if (conflictingAssignment) {
        throw new ForbiddenException('Il sostituto selezionato ha gia un assegnazione in conflitto');
      }

      const conflictingAvailability = await this.prisma.availability.findFirst({
        where: {
          userId: payload.replacementAssigneeId,
          type: 'UNAVAILABLE',
          startsAt: {
            lt: replacement.assignment.slot.endsAt
          },
          endsAt: {
            gt: replacement.assignment.slot.startsAt
          }
        }
      });

      if (conflictingAvailability) {
        throw new ForbiddenException('Il sostituto non e disponibile nella fascia oraria del servizio');
      }

      await this.prisma.assignment.update({
        where: { id: replacement.assignmentId },
        data: {
          assigneeId: payload.replacementAssigneeId,
          status: 'assigned',
          autoAssigned: false
        }
      });
    }

    const updated = await this.prisma.replacement.update({
      where: { id: replacementId },
      data: {
        replacementAssigneeId: payload.status === 'APPROVED' ? payload.replacementAssigneeId : null,
        status: payload.status as ReplacementStatus,
        resolvedAt: new Date()
      },
      include: {
        requestedBy: {
          select: { id: true, fullName: true, email: true }
        },
        replacementAssignee: {
          select: { id: true, fullName: true, email: true }
        },
        assignment: {
          include: {
            assignee: {
              select: { id: true, fullName: true, email: true }
            },
            slot: {
              include: {
                team: { select: { name: true } },
                duty: { select: { name: true } },
                event: { select: { title: true } }
              }
            }
          }
        }
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'replacement.resolved',
        entityType: 'replacement',
        entityId: replacementId,
        metadata: toJsonValue(payload)
      }
    });

    await this.notificationsService.pushSystemNotification(
      replacement.requestedBy.id,
      'Richiesta sostituzione aggiornata',
      `La richiesta per ${replacement.assignment.slot.event.title} e ora ${payload.status}${payload.replacementAssigneeId ? ' con sostituto assegnato' : ''}`,
      '/replacements'
    );

    return updated;
  }
}
