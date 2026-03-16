import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { toJsonValue } from '../../common/utils/json.util';
import { PrismaService } from '../../database/prisma.service';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(userId: string, role: Role) {
    const items = await this.list(userId, role);

    return {
      assets: items.length,
      checkedOut: items.filter((item) => item.status === 'checked_out').length,
      maintenanceDue: items.filter((item) => item.maintenanceDueAt && item.maintenanceDueAt <= new Date()).length,
      items
    };
  }

  async list(userId: string, role: Role) {
    const teamIds = await this.resolveAllowedTeamIds(userId, role);
    const where = teamIds ? { teamId: { in: teamIds } } : undefined;
    return this.prisma.inventoryItem.findMany({
      where,
      include: {
        team: {
          select: { id: true, name: true }
        }
      },
      orderBy: { name: 'asc' }
    });
  }

  async create(payload: CreateInventoryItemDto, actorId: string, role: Role) {
    const teamId = payload.teamId ?? await this.resolveDefaultTeamId(actorId, role);

    await this.assertTeamAccess(teamId, actorId, role);

    const item = await this.prisma.inventoryItem.create({
      data: {
        teamId,
        name: payload.name,
        serialNumber: payload.serialNumber,
        status: payload.status ?? 'available',
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

  async update(itemId: string, payload: UpdateInventoryItemDto, actorId: string, role: Role) {
    const item = await this.prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemId } });
    const teamId = payload.teamId ?? item.teamId;

    await this.assertTeamAccess(teamId, actorId, role);

    const updated = await this.prisma.inventoryItem.update({
      where: { id: itemId },
      data: {
        teamId,
        name: payload.name,
        serialNumber: payload.serialNumber,
        status: payload.status,
        maintenanceDueAt: payload.maintenanceDueAt ? new Date(payload.maintenanceDueAt) : payload.maintenanceDueAt === '' ? null : undefined
      },
      include: {
        team: {
          select: { id: true, name: true }
        }
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'inventory.updated',
        entityType: 'inventoryItem',
        entityId: itemId,
        metadata: toJsonValue(payload)
      }
    });

    return updated;
  }

  async remove(itemId: string, actorId: string, role: Role) {
    const item = await this.prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemId } });
    await this.assertTeamAccess(item.teamId, actorId, role);

    await this.prisma.inventoryItem.delete({ where: { id: itemId } });
    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'inventory.deleted',
        entityType: 'inventoryItem',
        entityId: itemId,
        metadata: toJsonValue({ itemId })
      }
    });

    return { deleted: true, id: itemId };
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

  private async resolveDefaultTeamId(userId: string, role: Role) {
    const teamIds = await this.resolveAllowedTeamIds(userId, role);
    const teamId = teamIds?.[0];
    if (!teamId) {
      throw new ForbiddenException('Nessun team disponibile per creare un asset');
    }
    return teamId;
  }
}
