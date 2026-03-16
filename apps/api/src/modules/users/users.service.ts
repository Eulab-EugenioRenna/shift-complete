import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list(role?: string) {
    const normalizedRole = Object.values(Role).includes(role as Role) ? (role as Role) : undefined;

    return this.prisma.user.findMany({
      where: normalizedRole ? { role: normalizedRole } : undefined,
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        onboardingCompleted: true
      },
      orderBy: {
        fullName: 'asc'
      }
    });
  }

  findById(id: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        onboardingCompleted: true,
        memberships: {
          select: {
            teamId: true
          }
        }
      }
    }).then((user) => ({
      ...user,
      activeTeamIds: user.memberships.map((membership) => membership.teamId)
    }));
  }
}
