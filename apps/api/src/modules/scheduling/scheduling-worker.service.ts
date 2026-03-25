import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Job, Worker } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { BackgroundJobsService } from '../jobs/background-jobs.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { SCHEDULING_QUEUE } from '../queue/queue.constants';
import { GenerateScheduleDto } from './dto/generate-schedule.dto';
import { SchedulingService } from './scheduling.service';

type SchedulingPreviewJobPayload = {
  jobId: string;
  actorId: string;
  actorRole: Role;
  requestHash: string;
  payload: GenerateScheduleDto;
};

@Injectable()
export class SchedulingWorkerService implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly backgroundJobsService: BackgroundJobsService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly schedulingService: SchedulingService,
  ) {}

  onModuleInit(): void {
    void this.bootstrapWorker();
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async process(job: Job<SchedulingPreviewJobPayload>) {
      await this.backgroundJobsService.update(job.data.jobId, {
      status: 'running' as any,
      progress: 15,
      startedAt: new Date(),
      error: null,
    });
    this.emit(job.data.jobId, 'running', 15, { hash: job.data.requestHash });

    try {
      const result = await this.schedulingService.generatePreview(job.data.payload, job.data.actorId, job.data.actorRole, { allowAsync: false });

      await this.backgroundJobsService.update(job.data.jobId, {
        status: 'completed' as any,
        progress: 100,
        result,
        completedAt: new Date(),
      });
      await this.schedulingService.recordMetric('preview_completed');
      this.emit(job.data.jobId, 'completed', 100, { hash: job.data.requestHash, planId: result.planId ?? null });
      await this.schedulingService.clearQueuedPreview(job.data.requestHash);

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Scheduling preview failed';
      await this.backgroundJobsService.update(job.data.jobId, {
        status: 'failed' as any,
        progress: 100,
        error: message,
        completedAt: new Date(),
      });
      await this.schedulingService.recordMetric('preview_failed');
      this.emit(job.data.jobId, 'failed', 100, { hash: job.data.requestHash, error: message });
      await this.schedulingService.clearQueuedPreview(job.data.requestHash);
      throw error;
    }
  }

  private emit(jobId: string, status: 'running' | 'completed' | 'failed', progress: number, payload: Record<string, unknown>) {
    this.realtimeGateway.broadcastSchedulingUpdate({
      kind: 'scheduling.preview.job.updated',
      jobId,
      status,
      progress,
      ...payload,
    });
  }

  private async bootstrapWorker(): Promise<void> {
    const settings = await this.prisma.aiSetting.findUnique({ where: { id: 'global' } } as any) as any;
    this.worker = new Worker(
      SCHEDULING_QUEUE,
      async (job) => this.process(job),
      {
        connection: { url: settings?.redisUrl ?? process.env.REDIS_URL ?? 'redis://localhost:6379' },
        concurrency: Number(process.env.SCHEDULING_JOB_CONCURRENCY ?? 2),
      },
    );
  }
}
