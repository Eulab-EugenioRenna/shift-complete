import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { toJsonValue } from '../../common/utils/json.util';
import { PrismaService } from '../../database/prisma.service';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(userId: string, role: Role) {
    const teamIds = await this.resolveAllowedTeamIds(userId, role);
    const where = teamIds ? { teamId: { in: teamIds } } : undefined;
    const items = await this.prisma.inventoryItem.findMany({ where });

    return {
      assets: items.length,
      checkedOut: items.filter((item) => item.status === 'checked_out').length,
      maintenanceDue: items.filter((item) => item.maintenanceDueAt && item.maintenanceDueAt <= new Date()).length,
      items
    };
  }

  async create(payload: CreateInventoryItemDto, actorId: string, role: Role) {
    await this.assertTeamAccess(payload.teamId, actorId, role);

    const item = await this.prisma.inventoryItem.create({
      data: {
        teamId: payload.teamId,
        name: payload.name,
        serialNumber: payload.serialNumber,
        status: payload.status,
        maintenanceDueAt: payload.maintenanceDueAt ? new Date(payload.maintenanceDueAt) : undefined
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'inventory.created',
        entityType: 'inventoryItem',
        entityId: item.id,
        metadata: toJsonValue(payload)
      }
    });

    return item;
  }

  private async assertTeamAccess(teamId: string, userId: string, role: Role) {
    if (role === Role.administrator) {
      return;
    }

    const allowedTeamIds = await this.resolveAllowedTeamIds(userId, role);
    if (!allowedTeamIds?.includes(teamId)) {
      throw new ForbiddenException('Accesso negato al team richiesto');
    }
  }

  private async resolveAllowedTeamIds(userId: string, role: Role): Promise<string[] | null> {
    if (role === Role.administrator) {
      return null;
    }

    if (role === Role.service_leader) {
      const teams = await this.prisma.team.findMany({
        where: { leaderId: userId },
        select: { id: true }
      });
      return teams.map((team) => team.id);
    }

    const memberships = await this.prisma.teamMembership.findMany({
      where: { userId },
      select: { teamId: true }
    });
    return memberships.map((membership) => membership.teamId);
  }
}
