import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnboardingState, Role, TokenType } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { hashPassword, verifyPassword } from '../../common/utils/password.util';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly notificationsService: NotificationsService
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          select: { teamId: true }
        }
      }
    });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      await this.prisma.auditLog.create({
        data: {
          action: 'auth.login.failed',
          entityType: 'auth',
          entityId: email,
          metadata: { email }
        }
      });
      throw new UnauthorizedException('Credenziali non valide');
    }

    if (user.suspendedAt) {
      throw new UnauthorizedException('Account sospeso. Contatta un amministratore');
    }

    const payload = {
      sub: user.id,
      role: user.role,
      email: user.email
    };

    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = randomBytes(48).toString('hex');
    await this.prisma.session.create({
      data: {
        userId: user.id,
        token: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14)
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'auth.login.succeeded',
        entityType: 'auth',
        entityId: user.id,
        metadata: { email: user.email, role: user.role }
      }
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        onboardingCompleted: user.onboardingState === OnboardingState.FULLY_ONBOARDED,
        activeTeamIds: user.memberships.map((membership) => membership.teamId)
      }
    };
  }

  async refresh(refreshToken: string) {
    const session = await this.prisma.session.findUnique({
      where: {
        token: this.hashToken(refreshToken)
      },
      include: {
        user: {
          include: {
            memberships: {
              select: { teamId: true }
            }
          }
        }
      }
    });

    if (!session || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Sessione non valida o scaduta');
    }

    if (session.user.suspendedAt) {
      throw new UnauthorizedException('Account sospeso. Contatta un amministratore');
    }

    const payload = {
      sub: session.user.id,
      role: session.user.role,
      email: session.user.email
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: {
        id: session.user.id,
        email: session.user.email,
        fullName: session.user.fullName,
        role: session.user.role,
        onboardingCompleted: session.user.onboardingState === OnboardingState.FULLY_ONBOARDED,
        activeTeamIds: session.user.memberships.map((membership) => membership.teamId)
      }
    };
  }

  async register(payload: { email: string; password: string; fullName: string; teamId?: string }) {
    if (payload.teamId) {
      const team = await this.prisma.team.findUnique({
        where: { id: payload.teamId },
        select: { id: true, name: true, leaderId: true }
      });

      if (!team) {
        throw new NotFoundException('Team non trovato');
      }

      const request = await this.prisma.teamAccessRequest.create({
        data: {
          teamId: team.id,
          kind: 'SIGNUP',
          fullName: payload.fullName,
          email: payload.email,
          passwordHash: hashPassword(payload.password)
        }
      });

      await this.prisma.auditLog.create({
        data: {
          action: 'auth.signup-request.created',
          entityType: 'teamAccessRequest',
          entityId: request.id,
          metadata: { teamId: team.id, email: payload.email, fullName: payload.fullName }
        }
      });

      if (team.leaderId) {
        await this.notificationsService.pushSystemNotification(
          team.leaderId,
          'Nuova richiesta iscrizione team',
          `${payload.fullName} ha richiesto di entrare nel team ${team.name}`,
          '/teams?tab=requests'
        );
      } else {
        const administrators = await this.prisma.user.findMany({
          where: { role: Role.administrator },
          select: { id: true }
        });

        for (const administrator of administrators) {
          await this.notificationsService.pushSystemNotification(
            administrator.id,
            'Nuova richiesta iscrizione team',
            `${payload.fullName} ha richiesto di entrare nel team ${team.name}`,
            '/teams?tab=requests'
          );
        }
      }

      return {
        message: 'Richiesta inviata al team selezionato',
        onboardingRequired: false,
        requestId: request.id,
        pendingApproval: true
      };
    }

    const user = await this.prisma.user.create({
      data: {
        email: payload.email,
        fullName: payload.fullName,
        passwordHash: hashPassword(payload.password),
        role: Role.volunteer,
        onboardingState: OnboardingState.REGISTERED
      }
    });

    const verificationToken = await this.issueUserToken(user.id, TokenType.EMAIL_VERIFICATION, 1000 * 60 * 60 * 24 * 2);
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'auth.register.completed',
        entityType: 'user',
        entityId: user.id,
        metadata: { email: user.email }
      }
    });
    await this.notificationsService.pushSystemNotification(
      user.id,
      'Verifica email',
      `Completa la verifica email con il token: ${verificationToken}`
    );

    return {
      message: 'Utente registrato',
      onboardingRequired: true,
      userId: user.id,
      pendingApproval: false
    };
  }

  listRegistrationTeams() {
    return this.prisma.team.findMany({
      select: {
        id: true,
        name: true,
        leaderId: true,
        memberships: {
          select: { id: true }
        }
      },
      orderBy: { name: 'asc' }
    }).then((teams) =>
      teams.map((team) => ({
        id: team.id,
        name: team.name,
        leaderId: team.leaderId ?? undefined,
        memberCount: team.memberships.length
      }))
    );
  }

  async approveSignupRequest(requestId: string, actorId: string, actorRole: Role) {
    const request = await this.prisma.teamAccessRequest.findUnique({
      where: { id: requestId },
      include: { team: true }
    });

    if (!request) {
      throw new NotFoundException('Richiesta non trovata');
    }

    await this.assertTeamApprovalAccess(request.teamId, request.team.leaderId, actorId, actorRole);

    if (request.status !== 'PENDING') {
      throw new ForbiddenException('Richiesta gia gestita');
    }

    if (request.kind !== 'SIGNUP' || !request.email || !request.fullName || !request.passwordHash) {
      throw new ForbiddenException('Richiesta non valida per la creazione utente');
    }

    const user = await this.prisma.user.create({
      data: {
        email: request.email,
        fullName: request.fullName,
        passwordHash: request.passwordHash,
        role: Role.volunteer,
        onboardingState: OnboardingState.REGISTERED,
        memberships: {
          create: {
            teamId: request.teamId
          }
        }
      }
    });

    await this.prisma.teamAccessRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        reviewedByUserId: actorId,
        createdUserId: user.id,
        reviewedAt: new Date()
      }
    });

    const verificationToken = await this.issueUserToken(user.id, TokenType.EMAIL_VERIFICATION, 1000 * 60 * 60 * 24 * 2);
    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'auth.signup-request.approved',
        entityType: 'teamAccessRequest',
        entityId: requestId,
        metadata: { createdUserId: user.id, teamId: request.teamId }
      }
    });
    await this.notificationsService.pushSystemNotification(
      user.id,
      'Account approvato',
      `Il tuo account per ${request.team.name} e stato approvato. Token verifica: ${verificationToken}`,
      '/auth'
    );

    return { approved: true, userId: user.id };
  }

  async declineSignupRequest(requestId: string, actorId: string, actorRole: Role) {
    const request = await this.prisma.teamAccessRequest.findUnique({
      where: { id: requestId },
      include: { team: true }
    });

    if (!request) {
      throw new NotFoundException('Richiesta non trovata');
    }

    await this.assertTeamApprovalAccess(request.teamId, request.team.leaderId, actorId, actorRole);

    await this.prisma.teamAccessRequest.update({
      where: { id: requestId },
      data: {
        status: 'DECLINED',
        reviewedByUserId: actorId,
        reviewedAt: new Date()
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'auth.signup-request.declined',
        entityType: 'teamAccessRequest',
        entityId: requestId,
        metadata: { teamId: request.teamId }
      }
    });

    return { declined: true, id: requestId };
  }

  private async assertTeamApprovalAccess(teamId: string, leaderId: string | null, actorId: string, actorRole: Role) {
    if (actorRole === Role.administrator) {
      return;
    }

    if (actorRole === Role.service_leader && leaderId === actorId) {
      return;
    }

    throw new ForbiddenException('Non puoi approvare richieste per questo team');
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return { message: 'Se l\'utente esiste, ricevera istruzioni per il reset.' };
    }

    const token = await this.issueUserToken(user.id, TokenType.PASSWORD_RESET, 1000 * 60 * 30);
    await this.notificationsService.pushSystemNotification(
      user.id,
      'Reset password',
      `Usa questo token per reimpostare la password: ${token}`
    );

    return { message: 'Se l\'utente esiste, ricevera istruzioni per il reset.' };
  }

  async resetPassword(token: string, password: string) {
    const userToken = await this.prisma.userToken.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!userToken || userToken.type !== TokenType.PASSWORD_RESET || userToken.expiresAt <= new Date()) {
      throw new UnauthorizedException('Token reset non valido o scaduto');
    }

    await this.prisma.user.update({
      where: { id: userToken.userId },
      data: {
        passwordHash: hashPassword(password)
      }
    });

    await this.prisma.userToken.delete({ where: { id: userToken.id } });
    await this.prisma.session.deleteMany({ where: { userId: userToken.userId } });

    return { message: 'Password aggiornata con successo' };
  }

  async verifyEmail(token: string) {
    const userToken = await this.prisma.userToken.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!userToken || userToken.type !== TokenType.EMAIL_VERIFICATION || userToken.expiresAt <= new Date()) {
      throw new UnauthorizedException('Token verifica non valido o scaduto');
    }

    await this.prisma.user.update({
      where: { id: userToken.userId },
      data: {
        onboardingState:
          userToken.user.onboardingState === OnboardingState.REGISTERED
            ? OnboardingState.PROFILE_COMPLETE
            : userToken.user.onboardingState
      }
    });

    await this.prisma.userToken.delete({ where: { id: userToken.id } });

    return { message: 'Email verificata con successo' };
  }

  async resendVerification(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException('Utente non trovato');
    }

    const token = await this.issueUserToken(user.id, TokenType.EMAIL_VERIFICATION, 1000 * 60 * 60 * 24 * 2);
    await this.notificationsService.pushSystemNotification(
      user.id,
      'Nuovo token verifica email',
      `Usa questo token per verificare l'email: ${token}`
    );

    return { message: 'Token di verifica rigenerato' };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async issueUserToken(userId: string, type: TokenType, ttlMs: number) {
    await this.prisma.userToken.deleteMany({ where: { userId, type } });
    const token = randomBytes(32).toString('hex');
    await this.prisma.userToken.create({
      data: {
        userId,
        token,
        type,
        expiresAt: new Date(Date.now() + ttlMs)
      }
    });

    return token;
  }
}
