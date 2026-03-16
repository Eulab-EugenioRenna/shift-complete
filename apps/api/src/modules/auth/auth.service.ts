import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { hashPassword, verifyPassword } from '../../common/utils/password.util';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
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
      throw new UnauthorizedException('Credenziali non valide');
    }

    const payload = {
      sub: user.id,
      role: user.role,
      email: user.email
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        onboardingCompleted: user.onboardingCompleted,
        activeTeamIds: user.memberships.map((membership) => membership.teamId)
      }
    };
  }

  async register(payload: { email: string; password: string; fullName: string }) {
    const user = await this.prisma.user.create({
      data: {
        email: payload.email,
        fullName: payload.fullName,
        passwordHash: hashPassword(payload.password),
        role: Role.volunteer,
        onboardingCompleted: false
      }
    });

    return {
      message: 'Utente registrato',
      onboardingRequired: true,
      userId: user.id
    };
  }
}
