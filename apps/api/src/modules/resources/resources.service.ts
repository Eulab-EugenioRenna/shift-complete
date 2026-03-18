import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { writeFileSync } from 'node:fs';
import { toJsonValue } from '../../common/utils/json.util';
import { PrismaService } from '../../database/prisma.service';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { QueueService } from '../queue/queue.service';
import { BackgroundJobsService } from '../jobs/background-jobs.service';
import { BackgroundJobKind } from '@prisma/client';
import { ResourceStorageService } from './resource-storage.service';

type AccessibleTeam = {
  id: string;
  name: string;
};

type ResourceQuotaRule = {
  teamId: string;
  storageLimitBytes?: number;
};

type ResourceQuotaSettings = {
  totalStorageLimitBytes: number | null;
  defaultTeamStorageLimitBytes: number | null;
  teamRules: ResourceQuotaRule[];
};

@Injectable()
export class ResourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly backgroundJobsService: BackgroundJobsService,
    private readonly resourceStorage: ResourceStorageService
  ) {}

  async list(userId: string, role: Role) {
    const teamIds = await this.getAccessibleTeamIds(userId, role);
    return this.prisma.resourceFile.findMany({
      where: this.resourceWhere(teamIds, role),
      include: {
        team: {
          select: { id: true, name: true }
        }
      },
      orderBy: { uploadedAt: 'desc' }
    });
  }

  async summary(userId: string, role: Role) {
    const [teams, resources, quotas] = await Promise.all([
      this.getAccessibleTeams(userId, role),
      this.prisma.resourceFile.findMany({
        where: this.resourceWhere(await this.getAccessibleTeamIds(userId, role), role),
        include: {
          team: {
            select: { id: true, name: true }
          }
        }
      }),
      this.getQuotaSettings(),
    ]);

    const teamEntries = new Map<string, {
      teamId: string | null;
      label: string;
      fileCount: number;
      folderCount: number;
      usedBytes: number;
      limitBytes: number | null;
      availableBytes: number | null;
      usageRatio: number | null;
      isGlobal: boolean;
    }>();

    teamEntries.set('global', {
      teamId: null,
      label: 'Libreria globale',
      fileCount: 0,
      folderCount: 1,
      usedBytes: 0,
      limitBytes: null,
      availableBytes: null,
      usageRatio: null,
      isGlobal: true,
    });

    for (const team of teams) {
      const limitBytes = this.resolveTeamLimit(team.id, quotas);
      teamEntries.set(team.id, {
        teamId: team.id,
        label: team.name,
        fileCount: 0,
        folderCount: 1,
        usedBytes: 0,
        limitBytes,
        availableBytes: limitBytes === null ? null : limitBytes,
        usageRatio: null,
        isGlobal: false,
      });
    }

    for (const resource of resources) {
      const key = resource.teamId ?? 'global';
      const entry = teamEntries.get(key) ?? {
        teamId: resource.teamId,
        label: resource.team?.name ?? 'Team',
        fileCount: 0,
        folderCount: 1,
        usedBytes: 0,
        limitBytes: resource.teamId ? this.resolveTeamLimit(resource.teamId, quotas) : null,
        availableBytes: null,
        usageRatio: null,
        isGlobal: !resource.teamId,
      };
      entry.fileCount += 1;
      entry.usedBytes += resource.sizeBytes;
      teamEntries.set(key, entry);
    }

    const teamsSummary = Array.from(teamEntries.values())
      .map((entry) => ({
        ...entry,
        availableBytes: entry.limitBytes === null ? null : Math.max(entry.limitBytes - entry.usedBytes, 0),
        usageRatio: entry.limitBytes && entry.limitBytes > 0 ? Math.min(entry.usedBytes / entry.limitBytes, 1) : null,
      }))
      .sort((a, b) => Number(a.isGlobal) - Number(b.isGlobal) || a.label.localeCompare(b.label));

    const usedBytes = resources.reduce((sum, resource) => sum + resource.sizeBytes, 0);
    const totalLimitBytes = quotas.totalStorageLimitBytes;

    return {
      totalUsedBytes: usedBytes,
      totalLimitBytes,
      totalAvailableBytes: totalLimitBytes === null ? null : Math.max(totalLimitBytes - usedBytes, 0),
      totalFileCount: resources.length,
      totalFolderCount: teamsSummary.length,
      teamCount: teams.length,
      teams: teamsSummary,
    };
  }

  async create(payload: CreateResourceDto, actorId: string, role: Role) {
    await this.assertWriteAccess(payload.teamId ?? null, actorId, role);

    const resource = await this.prisma.resourceFile.create({
      data: payload
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'resource.created',
        entityType: 'resourceFile',
        entityId: resource.id,
        metadata: toJsonValue(payload)
      }
    });

    return resource;
  }

  async upload(file: { originalname: string; buffer: Buffer; mimetype: string; size: number } | undefined, teamId: string | undefined, actorId: string, role: Role) {
    if (!file) {
      throw new NotFoundException('File non ricevuto');
    }

    await this.assertWriteAccess(teamId ?? null, actorId, role);
    await this.assertQuotaAvailable(teamId ?? null, file.size);
    const teamFolder = await this.resourceStorage.teamFolderName(teamId ?? null);
    const path = await this.resourceStorage.uploadBuffer(file, teamFolder);

    return this.create({
      name: file.originalname,
      path,
      mimeType: file.mimetype || 'application/octet-stream',
      sizeBytes: file.size,
      teamId
    }, actorId, role);
  }

  async enqueueUpload(file: { originalname: string; buffer: Buffer; mimetype: string; size: number } | undefined, teamId: string | undefined, actorId: string, role: Role) {
    if (!file) {
      throw new NotFoundException('File non ricevuto');
    }

    await this.assertWriteAccess(teamId ?? null, actorId, role);
    await this.assertQuotaAvailable(teamId ?? null, file.size);
    const tempPath = await this.resourceStorage.tempFilePath(file.originalname);
    writeFileSync(tempPath, file.buffer);

    const backgroundJob = await this.backgroundJobsService.create({
      kind: BackgroundJobKind.resource_upload,
      userId: actorId,
      teamId: teamId ?? null,
      entityType: 'resourceUpload',
      payload: { originalname: file.originalname, mimeType: file.mimetype, size: file.size }
    });

    const teamFolder = await this.resourceStorage.teamFolderName(teamId ?? null);

    await this.queueService.resourceQueue.add('resource-upload', {
      jobId: backgroundJob.id,
      actorId,
      teamId,
      teamFolder,
      tempPath,
      originalname: file.originalname,
      mimeType: file.mimetype,
      size: file.size
    });

    return backgroundJob;
  }

  async assertQuotaAvailable(teamId: string | null, incomingBytes: number) {
    const quotas = await this.getQuotaSettings();

    if (quotas.totalStorageLimitBytes !== null) {
      const totals = await this.prisma.resourceFile.aggregate({
        _sum: { sizeBytes: true }
      });
      const usedBytes = totals._sum.sizeBytes ?? 0;
      if (usedBytes + incomingBytes > quotas.totalStorageLimitBytes) {
        throw new BadRequestException(`Spazio totale esaurito. Disponibili ${this.formatBytes(Math.max(quotas.totalStorageLimitBytes - usedBytes, 0))}.`);
      }
    }

    if (!teamId) {
      return;
    }

    const teamLimitBytes = this.resolveTeamLimit(teamId, quotas);
    if (teamLimitBytes === null) {
      return;
    }

    const totals = await this.prisma.resourceFile.aggregate({
      where: { teamId },
      _sum: { sizeBytes: true }
    });
    const usedBytes = totals._sum.sizeBytes ?? 0;
    if (usedBytes + incomingBytes > teamLimitBytes) {
      throw new BadRequestException(`Spazio team esaurito. Disponibili ${this.formatBytes(Math.max(teamLimitBytes - usedBytes, 0))}.`);
    }
  }

  async update(resourceId: string, payload: UpdateResourceDto, actorId: string, role: Role) {
    const resource = await this.findAccessibleResource(resourceId, actorId, role);
    await this.assertWriteAccess(resource.teamId, actorId, role);

    const updated = await this.prisma.resourceFile.update({
      where: { id: resourceId },
      data: {
        name: payload.name
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
        action: 'resource.updated',
        entityType: 'resourceFile',
        entityId: resourceId,
        metadata: toJsonValue(payload)
      }
    });

    return updated;
  }

  async remove(resourceId: string, actorId: string, role: Role) {
    const resource = await this.findAccessibleResource(resourceId, actorId, role);
    await this.assertWriteAccess(resource.teamId, actorId, role);

    await this.resourceStorage.remove(resource.path);

    await this.prisma.resourceFile.delete({ where: { id: resourceId } });
    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: 'resource.deleted',
        entityType: 'resourceFile',
        entityId: resourceId,
        metadata: toJsonValue({ resourceId })
      }
    });

    return { deleted: true, id: resourceId };
  }

  async download(resourceId: string, actorId: string, role: Role) {
    const resource = await this.findAccessibleResource(resourceId, actorId, role);
    return this.resourceStorage.download(resource);
  }

  async prepareDownload(resourceId: string, actorId: string, role: Role) {
    const resource = await this.findAccessibleResource(resourceId, actorId, role);
    const backgroundJob = await this.backgroundJobsService.create({
      kind: BackgroundJobKind.resource_download,
      userId: actorId,
      teamId: resource.teamId,
      entityType: 'resourceFile',
      entityId: resource.id,
      payload: { resourceId: resource.id, name: resource.name }
    });

    await this.queueService.resourceQueue.add('resource-download-prepare', {
      jobId: backgroundJob.id,
      resourceId: resource.id,
      teamId: resource.teamId
    });

    return backgroundJob;
  }

  private async findAccessibleResource(resourceId: string, actorId: string, role: Role) {
    const resource = await this.prisma.resourceFile.findUnique({
      where: { id: resourceId }
    });

    if (!resource) {
      throw new NotFoundException('Risorsa non trovata');
    }

    if (role === Role.administrator) {
      return resource;
    }

    if (!resource.teamId) {
      return resource;
    }

    const membership = await this.prisma.teamMembership.findFirst({
      where: {
        userId: actorId,
        teamId: resource.teamId
      }
    });

    const leadership = await this.prisma.team.findFirst({
      where: {
        id: resource.teamId,
        leaderId: actorId
      }
    });

    if (!membership && !leadership) {
      throw new ForbiddenException('Accesso negato alla risorsa richiesta');
    }

    return resource;
  }

  private async getAccessibleTeamIds(userId: string, role: Role): Promise<string[]> {
    if (role === Role.administrator) {
      const teams = await this.prisma.team.findMany({ select: { id: true } });
      return teams.map((team) => team.id);
    }

    const [memberships, ledTeams] = await Promise.all([
      this.prisma.teamMembership.findMany({
        where: { userId },
        select: { teamId: true }
      }),
      role === Role.service_leader
        ? this.prisma.team.findMany({ where: { leaderId: userId }, select: { id: true } })
        : Promise.resolve([]),
    ]);

    return Array.from(new Set([
      ...memberships.map((membership) => membership.teamId),
      ...ledTeams.map((team) => team.id),
    ]));
  }

  private async getAccessibleTeams(userId: string, role: Role): Promise<AccessibleTeam[]> {
    if (role === Role.administrator) {
      return this.prisma.team.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' }
      });
    }

    const teamIds = await this.getAccessibleTeamIds(userId, role);
    if (!teamIds.length) {
      return [];
    }

    return this.prisma.team.findMany({
      where: { id: { in: teamIds } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    });
  }

  private resourceWhere(teamIds: string[], role: Role) {
    if (role === Role.administrator) {
      return undefined;
    }

    return {
      OR: [{ teamId: null }, { teamId: { in: teamIds } }]
    };
  }

  private async getQuotaSettings(): Promise<ResourceQuotaSettings> {
    const settings = await this.prisma.aiSetting.findUnique({ where: { id: 'global' } }) as {
      totalStorageLimitBytes?: number | null;
      defaultTeamStorageLimitBytes?: number | null;
      resourceTeamQuotaRules?: unknown;
    } | null;

    return {
      totalStorageLimitBytes: settings?.totalStorageLimitBytes ?? this.asNullableNumber(process.env.TOTAL_STORAGE_LIMIT_BYTES),
      defaultTeamStorageLimitBytes: settings?.defaultTeamStorageLimitBytes ?? this.asNullableNumber(process.env.DEFAULT_TEAM_STORAGE_LIMIT_BYTES),
      teamRules: this.normalizeTeamRules(settings?.resourceTeamQuotaRules),
    };
  }

  private resolveTeamLimit(teamId: string, quotas: ResourceQuotaSettings): number | null {
    const override = quotas.teamRules.find((rule) => rule.teamId === teamId)?.storageLimitBytes;
    if (typeof override === 'number' && override > 0) {
      return override;
    }
    return quotas.defaultTeamStorageLimitBytes;
  }

  private normalizeTeamRules(value: unknown): ResourceQuotaRule[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item): item is ResourceQuotaRule => Boolean(item && typeof item === 'object' && typeof (item as ResourceQuotaRule).teamId === 'string'))
      .map((item) => ({
        teamId: item.teamId,
        storageLimitBytes: typeof item.storageLimitBytes === 'number' && item.storageLimitBytes > 0 ? item.storageLimitBytes : undefined,
      }));
  }

  private asNullableNumber(value: string | undefined): number | null {
    if (!value) {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  private async assertWriteAccess(teamId: string | null, actorId: string, role: Role) {
    if (role === Role.administrator) {
      return;
    }

    if (!teamId) {
      throw new ForbiddenException('Solo l\'amministratore puo gestire risorse globali');
    }

    const team = await this.prisma.team.findFirst({
      where: {
        id: teamId,
        leaderId: actorId
      }
    });

    if (!team) {
      throw new ForbiddenException('Puoi caricare risorse solo per i tuoi team');
    }
  }
}
