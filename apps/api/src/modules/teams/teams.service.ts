import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { toJsonValue } from '../../common/utils/json.util';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService
  ) {}

  async list(actorId: string, actorRole: Role) {
    const accessibleTeamIds = await this.resolveAccessibleTeamIds(actorId, actorRole);
    if (accessibleTeamIds && accessibleTeamIds.length === 0) {
      return [];
    }

    return this.prisma.team.findMany({
      where: accessibleTeamIds
        ? {
            id: {
              in: accessibleTeamIds
            }
          }
        : undefined,
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
            id: true,
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                role: true
              }
            },
            duties: {
              select: {
                duty: {
                  select: {
                    id: true,
                    name: true,
                    color: true,
                    icon: true
                  }
                }
              }
            }
          }
        },
        duties: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true
          },
          orderBy: {
            name: 'asc'
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
        memberCount: team.memberships.length,
        members: team.memberships.map((membership) => ({
          ...membership.user,
          dutyIds: membership.duties.map((item) => item.duty.id),
          duties: membership.duties.map((item) => item.duty)
        })),
        duties: team.duties
      }))
    );
  }

  async create(payload: CreateTeamDto, actorId: string, actorRole: Role) {
    const leaderId = actorRole === Role.service_leader ? actorId : payload.leaderId;

    if (actorRole === Role.service_leader && payload.leaderId && payload.leaderId !== actorId) {
      throw new ForbiddenException('Il leader puo creare team solo assegnando se stesso come leader');
    }

    const team = await this.prisma.team.create({
      data: {
        name: payload.name,
        description: payload.description,
        leaderId,
        memberships: leaderId
          ? {
              create: {
                userId: leaderId
              }
            }
          : undefined
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'team.created',
        entityType: 'team',
        entityId: team.id,
        metadata: toJsonValue({ ...payload, leaderId })
      }
    });

    return team;
  }

  async addMember(teamId: string, userId: string, actorId: string, actorRole: Role) {
    await this.assertManageMemberAccess(teamId, actorId, actorRole);

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

    const team = await this.prisma.team.findUnique({ where: { id: teamId }, select: { name: true } });
    await this.notificationsService.pushSystemNotification(
      userId,
      'Aggiunto al team',
      `Sei stato aggiunto al team ${team?.name ?? 'selezionato'} e potrai ricevere servizi e aggiornamenti collegati.`,
      '/teams',
      { template: 'team', teamName: team?.name ?? null }
    );

    return membership;
  }

  async removeMember(teamId: string, userId: string, actorId: string, actorRole: Role) {
    await this.assertManageMemberAccess(teamId, actorId, actorRole);

    const membership = await this.prisma.teamMembership.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId
        }
      }
    });

    if (!membership) {
      throw new NotFoundException('Membro non trovato nel team');
    }

    await this.prisma.teamMembership.delete({ where: { id: membership.id } });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'team.member.removed',
        entityType: 'teamMembership',
        entityId: membership.id,
        metadata: toJsonValue({ teamId, userId })
      }
    });

    const team = await this.prisma.team.findUnique({ where: { id: teamId }, select: { name: true } });
    await this.notificationsService.pushSystemNotification(
      userId,
      'Rimosso dal team',
      `Sei stato rimosso dal team ${team?.name ?? 'selezionato'}. Alcune assegnazioni future potrebbero cambiare.`,
      '/teams',
      { template: 'team', teamName: team?.name ?? null }
    );

    return { deleted: true, teamId, userId };
  }

  async assignMemberDuties(teamId: string, userId: string, dutyIds: string[], actorId: string, actorRole: Role) {
    await this.assertManageMemberAccess(teamId, actorId, actorRole);

    const membership = await this.prisma.teamMembership.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId
        }
      },
      include: {
        duties: {
          select: {
            dutyId: true
          }
        }
      }
    });

    if (!membership) {
      throw new NotFoundException('Membro non trovato nel team');
    }

    const validDuties = await this.prisma.duty.findMany({
      where: {
        teamId,
        id: {
          in: dutyIds
        }
      },
      select: {
        id: true
      }
    });

    if (validDuties.length !== dutyIds.length) {
      throw new ForbiddenException('Una o piu mansioni non appartengono al team selezionato');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.teamMembershipDuty.deleteMany({ where: { membershipId: membership.id } });
      if (dutyIds.length) {
        await tx.teamMembershipDuty.createMany({
          data: dutyIds.map((dutyId) => ({ membershipId: membership.id, dutyId }))
        });
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'team.member.duties.updated',
        entityType: 'teamMembership',
        entityId: membership.id,
        metadata: toJsonValue({ teamId, userId, dutyIds })
      }
    });

    return { updated: true, teamId, userId, dutyIds };
  }

  async createJoinRequest(teamId: string, userId: string, actorId: string, actorRole: Role) {
    if (actorRole !== Role.administrator && actorRole !== Role.service_leader) {
      throw new ForbiddenException('Non puoi richiedere inserimenti al team');
    }

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true, leaderId: true }
    });

    if (!team) {
      throw new NotFoundException('Team non trovato');
    }

    if (actorRole === Role.service_leader && team.leaderId !== actorId) {
      throw new ForbiddenException('Il leader puo richiedere inserimenti solo per il proprio team');
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, fullName: true, email: true }
    });

    const existingMembership = await this.prisma.teamMembership.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId
        }
      }
    });

    if (existingMembership) {
      throw new ForbiddenException('L\'utente e gia presente nel team');
    }

    const request = await this.prisma.teamAccessRequest.create({
      data: {
        teamId,
        kind: 'TEAM_JOIN',
        targetUserId: userId,
        requestedByUserId: actorId
      }
    });

    await this.notificationsService.pushSystemNotification(
      userId,
      'Richiesta inserimento team',
      `Ti e stato richiesto l'inserimento nel team ${team.name}. Contatta il leader o l'amministratore per la conferma.`,
      '/teams?tab=requests'
    );

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'team.join-request.created',
        entityType: 'teamAccessRequest',
        entityId: request.id,
        metadata: toJsonValue({ teamId, userId })
      }
    });

    return {
      id: request.id,
      teamId,
      userId: user.id,
      fullName: user.fullName,
      email: user.email,
      status: request.status
    };
  }

  async listJoinRequests(actorId: string, actorRole: Role) {
    const where = actorRole === Role.administrator
      ? undefined
      : {
          team: {
            leaderId: actorId
          }
        };

    return this.prisma.teamAccessRequest.findMany({
      where,
      include: {
        team: {
          select: { id: true, name: true }
        },
        targetUser: {
          select: { id: true, fullName: true, email: true }
        },
        requestedBy: {
          select: { id: true, fullName: true, email: true }
        },
        reviewedBy: {
          select: { id: true, fullName: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async resolveJoinRequest(requestId: string, status: 'APPROVED' | 'DECLINED', actorId: string, actorRole: Role) {
    const request = await this.prisma.teamAccessRequest.findUnique({
      where: { id: requestId },
      include: {
        team: true,
        targetUser: true
      }
    });

    if (!request) {
      throw new NotFoundException('Richiesta non trovata');
    }

    await this.assertManageMemberAccess(request.teamId, actorId, actorRole);

    if (request.kind !== 'TEAM_JOIN') {
      throw new ForbiddenException('Richiesta non valida per questo flusso');
    }

    if (status === 'APPROVED' && request.targetUserId) {
      await this.prisma.teamMembership.upsert({
        where: {
          teamId_userId: {
            teamId: request.teamId,
            userId: request.targetUserId
          }
        },
        update: {},
        create: {
          teamId: request.teamId,
          userId: request.targetUserId
        }
      });
    }

    const updated = await this.prisma.teamAccessRequest.update({
      where: { id: requestId },
      data: {
        status,
        reviewedByUserId: actorId,
        reviewedAt: new Date()
      },
      include: {
        team: {
          select: { id: true, name: true }
        },
        targetUser: {
          select: { id: true, fullName: true, email: true }
        },
        requestedBy: {
          select: { id: true, fullName: true, email: true }
        },
        reviewedBy: {
          select: { id: true, fullName: true, email: true }
        }
      }
    });

    if (request.targetUserId) {
      await this.notificationsService.pushSystemNotification(
        request.targetUserId,
        'Richiesta team aggiornata',
        `La richiesta per il team ${request.team.name} e stata ${status.toLowerCase()}`,
        '/teams?tab=requests'
      );
    }

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'team.join-request.resolved',
        entityType: 'teamAccessRequest',
        entityId: requestId,
        metadata: toJsonValue({ status, teamId: request.teamId, kind: request.kind, targetUserId: request.targetUserId })
      }
    });

    return updated;
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

  private async assertManageMemberAccess(teamId: string, actorId: string, actorRole: Role) {
    if (actorRole === Role.administrator) {
      return;
    }

    if (actorRole !== Role.service_leader) {
      throw new ForbiddenException('Operazione non consentita');
    }

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { leaderId: true }
    });

    if (!team || team.leaderId !== actorId) {
      throw new ForbiddenException('Il leader puo operare solo sui propri team');
    }
  }

  private async resolveAccessibleTeamIds(actorId: string, actorRole: Role): Promise<string[] | null> {
    if (actorRole === Role.administrator) {
      return null;
    }

    const memberships = await this.prisma.teamMembership.findMany({
      where: { userId: actorId },
      select: { teamId: true }
    });

    if (actorRole === Role.service_leader) {
      const ledTeams = await this.prisma.team.findMany({
        where: { leaderId: actorId },
        select: { id: true }
      });

      return Array.from(new Set([...memberships.map((membership) => membership.teamId), ...ledTeams.map((team) => team.id)]));
    }

    return memberships.map((membership) => membership.teamId);
  }
}
