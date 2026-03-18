import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OnboardingState, Role } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { ChangeMyPasswordDto, UpdateUserProfileDto } from '@shift-complete/shared-types';
import { toJsonValue } from '../../common/utils/json.util';
import { hashPassword, verifyPassword } from '../../common/utils/password.util';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateManagedUserDto } from './dto/create-managed-user.dto';
import { UpdateManagedUserDto } from './dto/update-managed-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService
  ) {}

  async list(actorId: string, actorRole: Role, role?: string, teamId?: string) {
    const normalizedRole = Object.values(Role).includes(role as Role) ? (role as Role) : undefined;
    const teamFilter = teamId ? await this.resolveTeamFilter(actorId, actorRole, teamId) : await this.resolveTeamFilter(actorId, actorRole);

    return this.prisma.user.findMany({
      where: normalizedRole ? { role: normalizedRole } : undefined,
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        suspendedAt: true,
        onboardingState: true,
        memberships: {
          select: {
            teamId: true
          }
        },
        leadingTeams: {
          select: {
            id: true
          }
        },
        settings: {
          select: {
            phone: true,
            address: true,
            emergencyName: true,
            emergencyPhone: true,
            preferredShifts: true,
            preferredTeamIds: true,
            preferredDutyIds: true,
            competencies: true,
            serviceNotes: true
          }
        }
      },
      orderBy: {
        fullName: 'asc'
      }
    }).then((users) =>
      users.map((user) => ({
        ...user,
        onboardingCompleted: user.onboardingState === OnboardingState.FULLY_ONBOARDED,
        suspended: Boolean(user.suspendedAt),
        activeTeamIds: Array.from(new Set([...user.memberships.map((membership) => membership.teamId), ...user.leadingTeams.map((team) => team.id)])),
        phone: user.settings?.phone ?? null,
        address: user.settings?.address ?? null,
        emergencyName: user.settings?.emergencyName ?? null,
        emergencyPhone: user.settings?.emergencyPhone ?? null,
        preferredShifts: (user.settings?.preferredShifts as string[] | null) ?? null,
        preferredTeamIds: (user.settings?.preferredTeamIds as string[] | null) ?? null,
        preferredDutyIds: (user.settings?.preferredDutyIds as string[] | null) ?? null,
        competencies: (user.settings?.competencies as string[] | null) ?? null,
        serviceNotes: user.settings?.serviceNotes ?? null
      }))
      .filter((user) => !teamFilter || user.activeTeamIds.some((id) => teamFilter.includes(id)))
    );
  }

  findById(id: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        suspendedAt: true,
        onboardingState: true,
        memberships: {
          select: {
            teamId: true
          }
        },
        leadingTeams: {
          select: {
            id: true
          }
        },
        settings: {
          select: {
            phone: true,
            address: true,
            emergencyName: true,
            emergencyPhone: true,
            preferredShifts: true,
            preferredTeamIds: true,
            preferredDutyIds: true,
            competencies: true,
            serviceNotes: true
          }
        }
      }
    }).then((user) => ({
      ...user,
      onboardingCompleted: user.onboardingState === OnboardingState.FULLY_ONBOARDED,
      suspended: Boolean(user.suspendedAt),
      activeTeamIds: Array.from(new Set([...user.memberships.map((membership) => membership.teamId), ...user.leadingTeams.map((team) => team.id)])),
      phone: user.settings?.phone ?? null,
      address: user.settings?.address ?? null,
      emergencyName: user.settings?.emergencyName ?? null,
      emergencyPhone: user.settings?.emergencyPhone ?? null,
      preferredShifts: (user.settings?.preferredShifts as string[] | null) ?? null,
      preferredTeamIds: (user.settings?.preferredTeamIds as string[] | null) ?? null,
      preferredDutyIds: (user.settings?.preferredDutyIds as string[] | null) ?? null,
      competencies: (user.settings?.competencies as string[] | null) ?? null,
      serviceNotes: user.settings?.serviceNotes ?? null
    }));
  }

  async detail(actorId: string, userId: string) {
    const user = await this.findById(userId);

    const [notifications, deliveries, audits, assignments] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),
      this.prisma.notificationDelivery.findMany({
        where: {
          notification: { userId }
        },
        include: {
          notification: {
            select: {
              subject: true,
              body: true,
              createdAt: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),
      this.prisma.auditLog.findMany({
        where: {
          OR: [{ userId }, { entityType: 'user', entityId: userId }]
        },
        orderBy: { createdAt: 'desc' },
        take: 30
      }),
      this.prisma.assignment.findMany({
        where: { assigneeId: userId },
        include: {
          slot: {
            include: {
              event: { select: { id: true, title: true, startsAt: true, endsAt: true } },
              team: { select: { id: true, name: true } },
              duty: { select: { id: true, name: true } }
            }
          }
        },
        orderBy: { slot: { startsAt: 'desc' } },
        take: 20
      })
    ]);

    return {
      user,
      notifications,
      deliveries,
      audits,
      timeline: this.buildTimeline(notifications, deliveries, audits, assignments),
      assignments: assignments.map((assignment) => ({
        id: assignment.id,
        status: assignment.status,
        autoAssigned: assignment.autoAssigned,
        eventTitle: assignment.slot.event?.title ?? null,
        startsAt: assignment.slot.startsAt,
        endsAt: assignment.slot.endsAt,
        teamName: assignment.slot.team?.name ?? null,
        dutyName: assignment.slot.duty?.name ?? null
      }))
    };
  }

  async updateProfile(userId: string, payload: UpdateUserProfileDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: payload.fullName,
        email: payload.email,
      }
    });

    await this.prisma.userSettings.upsert({
      where: { userId },
      update: {
        phone: payload.phone,
        address: payload.address,
        emergencyName: payload.emergencyName,
        emergencyPhone: payload.emergencyPhone,
        preferredShifts: payload.preferredShifts,
        preferredTeamIds: payload.preferredTeamIds,
        preferredDutyIds: payload.preferredDutyIds,
        competencies: payload.competencies,
        serviceNotes: payload.serviceNotes
      },
      create: {
        userId,
        phone: payload.phone,
        address: payload.address,
        emergencyName: payload.emergencyName,
        emergencyPhone: payload.emergencyPhone,
        preferredShifts: payload.preferredShifts,
        preferredTeamIds: payload.preferredTeamIds,
        preferredDutyIds: payload.preferredDutyIds,
        competencies: payload.competencies,
        serviceNotes: payload.serviceNotes
      }
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        onboardingState: OnboardingState.PROFILE_COMPLETE
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'user.profile.updated',
        entityType: 'user',
        entityId: userId,
        metadata: toJsonValue(payload)
      }
    });

    return this.findById(userId);
  }

  async changeMyPassword(userId: string, payload: ChangeMyPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Utente non trovato');
    }

    if (!verifyPassword(payload.currentPassword, user.passwordHash)) {
      throw new ForbiddenException('La password attuale non e corretta');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashPassword(payload.newPassword) }
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'user.password.updated',
        entityType: 'user',
        entityId: userId,
        metadata: toJsonValue({ changedBySelf: true })
      }
    });

    return { updated: true };
  }

  async createManagedUser(actorId: string, payload: CreateManagedUserDto) {
    const password = this.generatePassword();
    const user = await this.prisma.user.create({
      data: {
        email: payload.email,
        fullName: payload.fullName,
        role: payload.role as Role,
        passwordHash: hashPassword(password),
        onboardingState: OnboardingState.REGISTERED,
        settings: {
          create: {
            phone: payload.phone,
            address: payload.address,
            emergencyName: payload.emergencyName,
            emergencyPhone: payload.emergencyPhone,
            preferredShifts: payload.preferredShifts,
            preferredTeamIds: payload.preferredTeamIds,
            preferredDutyIds: payload.preferredDutyIds,
            competencies: payload.competencies,
            serviceNotes: payload.serviceNotes
          }
        },
        memberships: payload.teamIds?.length ? {
          create: payload.teamIds.map((teamId) => ({ teamId }))
        } : undefined
      },
      include: {
        memberships: { select: { teamId: true } }
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'user.created',
        entityType: 'user',
        entityId: user.id,
        metadata: toJsonValue({ email: payload.email, role: payload.role, teamIds: payload.teamIds })
      }
    });

    await this.notificationsService.pushSystemNotification(
      user.id,
      'Credenziali create',
      `Il tuo account e stato creato con ruolo ${payload.role}. Password temporanea: ${password}`,
      '/auth',
      { template: 'credentials', tempPassword: password }
    );

    return {
      ...(await this.findById(user.id)),
      generatedPassword: password
    };
  }

  async updateManagedUser(actorId: string, userId: string, payload: UpdateManagedUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Utente non trovato');
    }

    const previousMemberships = await this.prisma.teamMembership.findMany({ where: { userId }, select: { teamId: true } });
    const previousTeamIds = previousMemberships.map((membership) => membership.teamId);
    const previousRole = user.role;

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          email: payload.email,
          fullName: payload.fullName,
          role: payload.role as Role | undefined
        }
      });

      await tx.userSettings.upsert({
        where: { userId },
        update: {
          phone: payload.phone,
          address: payload.address,
          emergencyName: payload.emergencyName,
          emergencyPhone: payload.emergencyPhone,
          preferredShifts: payload.preferredShifts,
          preferredTeamIds: payload.preferredTeamIds,
          preferredDutyIds: payload.preferredDutyIds,
          competencies: payload.competencies,
          serviceNotes: payload.serviceNotes
        },
        create: {
          userId,
          phone: payload.phone,
          address: payload.address,
          emergencyName: payload.emergencyName,
          emergencyPhone: payload.emergencyPhone,
          preferredShifts: payload.preferredShifts,
          preferredTeamIds: payload.preferredTeamIds,
          preferredDutyIds: payload.preferredDutyIds,
          competencies: payload.competencies,
          serviceNotes: payload.serviceNotes
        }
      });

      if (payload.teamIds) {
        await tx.teamMembership.deleteMany({ where: { userId } });
        if (payload.teamIds.length) {
          await tx.teamMembership.createMany({
            data: payload.teamIds.map((teamId) => ({ teamId, userId }))
          });
        }
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'user.updated',
        entityType: 'user',
        entityId: userId,
        metadata: toJsonValue(payload)
      }
    });

    await this.notificationsService.pushSystemNotification(
      userId,
      'Profilo aggiornato',
      this.buildManagedUserUpdateMessage(previousRole, payload.role as Role | undefined, previousTeamIds, payload.teamIds),
      '/settings',
      { template: 'user-update' }
    );

    return this.findById(userId);
  }

  async removeManagedUser(actorId: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Utente non trovato');
    }

    await this.prisma.user.delete({ where: { id: userId } });
    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'user.deleted',
        entityType: 'user',
        entityId: userId,
        metadata: toJsonValue({ email: user.email })
      }
    });

    return { deleted: true, id: userId };
  }

  async sendCredentials(actorId: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Utente non trovato');
    }

    const password = this.generatePassword();
    await this.prisma.session.deleteMany({ where: { userId } });
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashPassword(password) }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'user.credentials.sent',
        entityType: 'user',
        entityId: userId,
        metadata: toJsonValue({ email: user.email })
      }
    });

    await this.notificationsService.pushSystemNotification(
      userId,
      'Nuove credenziali di accesso',
      `Le tue credenziali sono state rigenerate dall’amministratore. Password temporanea: ${password}`,
      '/auth',
      { template: 'credentials', tempPassword: password }
    );

    return { sent: true, id: userId, generatedPassword: password };
  }

  async suspendUser(actorId: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utente non trovato');

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { suspendedAt: new Date() } });
      await tx.session.deleteMany({ where: { userId } });
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'user.suspended',
        entityType: 'user',
        entityId: userId,
        metadata: toJsonValue({ email: user.email })
      }
    });

    return { suspended: true, id: userId };
  }

  async resumeUser(actorId: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utente non trovato');

    await this.prisma.user.update({ where: { id: userId }, data: { suspendedAt: null } });
    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'user.resumed',
        entityType: 'user',
        entityId: userId,
        metadata: toJsonValue({ email: user.email })
      }
    });

    await this.notificationsService.pushSystemNotification(
      userId,
      'Account riattivato',
      'Il tuo account e stato riattivato dall’amministratore. Puoi accedere di nuovo alla piattaforma.',
      '/auth',
      { template: 'user-update' }
    );

    return { suspended: false, id: userId };
  }

  private async resolveTeamFilter(actorId: string, actorRole: Role, requestedTeamId?: string) {
    if (actorRole === Role.administrator) {
      return requestedTeamId ? [requestedTeamId] : null;
    }

    if (actorRole === Role.service_leader) {
      const teams = await this.prisma.team.findMany({ where: { leaderId: actorId }, select: { id: true } });
      const allowedIds = teams.map((team) => team.id);
      if (requestedTeamId && !allowedIds.includes(requestedTeamId)) {
        throw new ForbiddenException('Non puoi filtrare utenti fuori dai tuoi team');
      }
      return requestedTeamId ? [requestedTeamId] : allowedIds;
    }

    throw new ForbiddenException('Accesso non consentito');
  }

  private generatePassword() {
    return `Shift-${randomBytes(6).toString('base64url')}`;
  }

  private buildManagedUserUpdateMessage(previousRole: Role, nextRole?: Role, previousTeamIds: string[] = [], nextTeamIds?: string[]) {
    const changes: string[] = ['I tuoi dati utente sono stati aggiornati dall’amministratore.'];

    if (nextRole && nextRole !== previousRole) {
      changes.push(`Ruolo aggiornato da ${previousRole} a ${nextRole}.`);
    }

    if (nextTeamIds) {
      const added = nextTeamIds.filter((teamId) => !previousTeamIds.includes(teamId));
      const removed = previousTeamIds.filter((teamId) => !nextTeamIds.includes(teamId));
      if (added.length) {
        changes.push(`Aggiunto a ${added.length} team.`);
      }
      if (removed.length) {
        changes.push(`Rimosso da ${removed.length} team.`);
      }
    }

    return changes.join(' ');
  }

  private buildTimeline(notifications: any[], deliveries: any[], audits: any[], assignments: any[]) {
    const items = [
      ...notifications.map((item) => ({
        type: 'notification',
        at: item.createdAt,
        title: item.subject,
        description: item.body,
        meta: item.channel
      })),
      ...deliveries.map((item) => ({
        type: 'delivery',
        at: item.createdAt,
        title: `${item.channel} · ${item.status}`,
        description: item.notification?.subject ?? 'Delivery notifica',
        meta: item.lastError ?? null
      })),
      ...audits.map((item) => ({
        type: 'audit',
        at: item.createdAt,
        title: item.action,
        description: `${item.entityType} · ${item.entityId}`,
        meta: null
      })),
      ...assignments.map((item) => ({
        type: 'assignment',
        at: item.slot.startsAt,
        title: item.slot.event?.title ?? 'Turno',
        description: `${item.slot.team?.name ?? '—'} · ${item.slot.duty?.name ?? '—'} · ${item.status}`,
        meta: item.autoAssigned ? 'auto' : 'manuale'
      }))
    ];

    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 50);
  }
}
