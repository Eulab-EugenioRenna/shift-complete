import { existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BackgroundJobKind, BackgroundJobStatus } from '@prisma/client';
import { Job, Worker } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { BackgroundJobsService } from '../jobs/background-jobs.service';
import { RESOURCE_QUEUE } from '../queue/queue.constants';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { toJsonValue } from '../../common/utils/json.util';

@Injectable()
export class ResourcesWorkerService implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly backgroundJobsService: BackgroundJobsService,
    private readonly realtimeGateway: RealtimeGateway
  ) {}

  onModuleInit() {
    void this.bootstrapWorker();
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  private async process(job: Job<any>) {
    if (job.name === 'resource-upload') {
      return this.processUpload(job);
    }

    if (job.name === 'resource-download-prepare') {
      return this.processDownloadPrepare(job);
    }

    return null;
  }

  private async processUpload(job: Job<{ jobId: string; actorId: string; teamId?: string; tempPath: string; originalname: string; mimeType: string; size: number }>) {
    await this.backgroundJobsService.update(job.data.jobId, {
      status: BackgroundJobStatus.running,
      progress: 10,
      startedAt: new Date(),
      error: null
    });
    this.emit(job.data.jobId, 'running', 10);

    const finalPath = join(await this.storageDir(), `${job.data.jobId}-${job.data.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
    if (!existsSync(job.data.tempPath)) {
      throw new Error('File temporaneo non trovato');
    }

    renameSync(job.data.tempPath, finalPath);
    await this.backgroundJobsService.update(job.data.jobId, { progress: 55 });
    this.emit(job.data.jobId, 'running', 55);

    const resource = await this.prisma.resourceFile.create({
      data: {
        teamId: job.data.teamId,
        name: job.data.originalname,
        path: finalPath,
        mimeType: job.data.mimeType || 'application/octet-stream',
        sizeBytes: job.data.size
      },
      include: {
        team: { select: { id: true, name: true } }
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: job.data.actorId,
        action: 'resource.upload.completed',
        entityType: 'resourceFile',
        entityId: resource.id,
        metadata: toJsonValue({ teamId: job.data.teamId, name: job.data.originalname })
      }
    });

    await this.backgroundJobsService.update(job.data.jobId, {
      status: BackgroundJobStatus.completed,
      progress: 100,
      result: { resourceId: resource.id, resource },
      completedAt: new Date()
    });
    this.emit(job.data.jobId, 'completed', 100, { resourceId: resource.id, teamId: resource.team?.id ?? null });
    return resource;
  }

  private async processDownloadPrepare(job: Job<{ jobId: string; resourceId: string; teamId?: string }>) {
    await this.backgroundJobsService.update(job.data.jobId, {
      status: BackgroundJobStatus.running,
      progress: 30,
      startedAt: new Date(),
      error: null
    });
    this.emit(job.data.jobId, 'running', 30);

    const resource = await this.prisma.resourceFile.findUniqueOrThrow({ where: { id: job.data.resourceId } });

    await this.backgroundJobsService.update(job.data.jobId, {
      status: BackgroundJobStatus.completed,
      progress: 100,
      result: { resourceId: resource.id, downloadUrl: `/api/resources/${resource.id}/download` },
      completedAt: new Date()
    });
    this.emit(job.data.jobId, 'completed', 100, { resourceId: resource.id, teamId: job.data.teamId ?? null });
    return resource;
  }

  private emit(jobId: string, status: string, progress: number, payload: Record<string, unknown> = {}) {
    this.realtimeGateway.broadcastResourceTransfer({
      jobId,
      status,
      progress,
      ...payload
    });
  }

  private async bootstrapWorker() {
    const settings = await this.prisma.aiSetting.findUnique({ where: { id: 'global' } });
    this.worker = new Worker(
      RESOURCE_QUEUE,
      async (job) => this.process(job),
      {
        connection: { url: settings?.redisUrl ?? process.env.REDIS_URL ?? 'redis://localhost:6379' },
        concurrency: settings?.resourceJobConcurrency ?? Number(process.env.RESOURCE_JOB_CONCURRENCY ?? 3)
      }
    );
  }

  private async storageDir() {
    const settings = await this.prisma.aiSetting.findUnique({ where: { id: 'global' } });
    return join(process.cwd(), settings?.resourceStoragePath ?? process.env.RESOURCE_STORAGE_PATH ?? 'storage/resources');
  }
}
