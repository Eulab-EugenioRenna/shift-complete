import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BackgroundJobKind, BackgroundJobStatus } from '@prisma/client';
import { Job, Worker } from 'bullmq';
import { toJsonValue } from '../../common/utils/json.util';
import { BackgroundJobsService } from '../jobs/background-jobs.service';
import { AI_QUEUE } from '../queue/queue.constants';
import { QueueService } from '../queue/queue.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AiProviderRegistryService } from './ai-provider-registry.service';
import { AiSettingsService } from './ai-settings.service';

@Injectable()
export class AiJobsService implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker;

  constructor(
    private readonly backgroundJobsService: BackgroundJobsService,
    private readonly queueService: QueueService,
    private readonly aiProviderRegistryService: AiProviderRegistryService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly aiSettingsService: AiSettingsService
  ) {}

  onModuleInit() {
    void this.bootstrapWorker();
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  async enqueuePrompt(payload: { actorId: string; provider: string; model?: string; prompt: string; ollamaUrl?: string; apiKey?: string }) {
    const runtime = await this.aiSettingsService.runtimeSettings();
    const backgroundJob = await this.backgroundJobsService.create({
      kind: BackgroundJobKind.ai_task,
      userId: payload.actorId,
      entityType: 'aiPrompt',
      payload: { provider: payload.provider, model: payload.model ?? runtime.model, promptPreview: payload.prompt.slice(0, 120) }
    });

    await this.queueService.aiQueue.add('ai-complete', {
      jobId: backgroundJob.id,
      ...payload
      ,model: payload.model ?? runtime.model,
      apiKey: payload.apiKey ?? runtime.apiKey,
      ollamaUrl: payload.ollamaUrl ?? runtime.ollamaUrl
    });

    return backgroundJob;
  }

  private async process(job: Job<{ jobId: string; actorId: string; provider: string; model?: string; prompt: string; ollamaUrl?: string; apiKey?: string }>) {
    await this.backgroundJobsService.update(job.data.jobId, {
      status: BackgroundJobStatus.running,
      progress: 15,
      startedAt: new Date(),
      error: null
    });
    this.realtimeGateway.broadcastAiJobUpdate({ jobId: job.data.jobId, status: 'running', progress: 15 });

    const provider = this.aiProviderRegistryService.get(job.data.provider);
    const result = await provider.complete({ model: job.data.model, prompt: job.data.prompt }, {
      apiKey: job.data.apiKey,
      ollamaUrl: job.data.ollamaUrl
    });

    await this.backgroundJobsService.update(job.data.jobId, {
      status: BackgroundJobStatus.completed,
      progress: 100,
      result: toJsonValue(result),
      completedAt: new Date()
    });
    this.realtimeGateway.broadcastAiJobUpdate({ jobId: job.data.jobId, status: 'completed', progress: 100, result });

    return result;
  }

  private async bootstrapWorker() {
    const runtime = await this.aiSettingsService.runtimeSettings();
    this.worker = new Worker(
      AI_QUEUE,
      async (job) => this.process(job),
      {
        connection: { url: runtime.redisUrl ?? process.env.REDIS_URL ?? 'redis://localhost:6379' },
        concurrency: runtime.aiJobConcurrency ?? Number(process.env.AI_JOB_CONCURRENCY ?? 2)
      }
    );
  }
}
