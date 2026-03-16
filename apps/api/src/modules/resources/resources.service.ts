import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { toJsonValue } from '../../common/utils/json.util';
import { PrismaService } from '../../database/prisma.service';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { QueueService } from '../queue/queue.service';
import { BackgroundJobsService } from '../jobs/background-jobs.service';
import { BackgroundJobKind } from '@prisma/client';

@Injectable()
export class ResourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly backgroundJobsService: BackgroundJobsService
  ) {}

  async list(userId: string, role: Role) {
    if (role === Role.administrator) {
      return this.prisma.resourceFile.findMany({
        include: {
          team: {
            select: { id: true, name: true }
          }
        },
        orderBy: { uploadedAt: 'desc' }
      });
    }

    const memberships = await this.prisma.teamMembership.findMany({
      where: { userId },
      select: { teamId: true }
    });
    const ledTeams = role === Role.service_leader
      ? await this.prisma.team.findMany({ where: { leaderId: userId }, select: { id: true } })
      : [];
    const teamIds = Array.from(new Set([...memberships.map((membership) => membership.teamId), ...ledTeams.map((team) => team.id)]));

    return this.prisma.resourceFile.findMany({
      where: {
        OR: [{ teamId: null }, { teamId: { in: teamIds } }]
      },
      include: {
        team: {
          select: { id: true, name: true }
        }
      },
      orderBy: { uploadedAt: 'desc' }
    });
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
    this.ensureStorageDir(await this.storageDir());

    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}${extname(file.originalname)}`;
    const path = join(await this.storageDir(), safeName);
    writeFileSync(path, file.buffer);

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
    this.ensureStorageDir(await this.storageDir());
    this.ensureTempDir(await this.tempDir());

    const tempPath = join(await this.tempDir(), `${Date.now()}-${Math.random().toString(36).slice(2)}${extname(file.originalname)}`);
    writeFileSync(tempPath, file.buffer);

    const backgroundJob = await this.backgroundJobsService.create({
      kind: BackgroundJobKind.resource_upload,
      userId: actorId,
      teamId: teamId ?? null,
      entityType: 'resourceUpload',
      payload: { originalname: file.originalname, mimeType: file.mimetype, size: file.size }
    });

    await this.queueService.resourceQueue.add('resource-upload', {
      jobId: backgroundJob.id,
      actorId,
      teamId,
      tempPath,
      originalname: file.originalname,
      mimeType: file.mimetype,
      size: file.size
    });

    return backgroundJob;
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

    if (existsSync(resource.path)) {
      rmSync(resource.path);
    }

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
    if (!existsSync(resource.path)) {
      throw new NotFoundException('File non disponibile nello storage');
    }
    return resource;
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

  private async storageDir() {
    const settings = await this.prisma.aiSetting.findUnique({ where: { id: 'global' } });
    return join(process.cwd(), settings?.resourceStoragePath ?? process.env.RESOURCE_STORAGE_PATH ?? 'storage/resources');
  }

  private async tempDir() {
    const settings = await this.prisma.aiSetting.findUnique({ where: { id: 'global' } });
    return join(process.cwd(), settings?.resourceTempPath ?? process.env.RESOURCE_TEMP_PATH ?? 'storage/resources/tmp');
  }

  private ensureStorageDir(path: string) {
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
    }
  }

  private ensureTempDir(path: string) {
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
    }
  }
}
