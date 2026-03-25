import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Role } from '@prisma/client';
import Redis from 'ioredis';
import { createHash } from 'node:crypto';
import { GenerateScheduleDto } from './dto/generate-schedule.dto';

@Injectable()
export class SchedulingCacheService implements OnModuleDestroy {
  private readonly previewTtlSeconds = Number(process.env.SCHEDULING_PREVIEW_CACHE_TTL_SECONDS ?? 180);
  private readonly candidatePoolTtlSeconds = Number(process.env.SCHEDULING_CANDIDATE_CACHE_TTL_SECONDS ?? 120);
  private readonly cycleStateTtlSeconds = Number(process.env.SCHEDULING_CYCLE_CACHE_TTL_SECONDS ?? 300);
  private readonly jobLinkTtlSeconds = Number(process.env.SCHEDULING_PREVIEW_JOB_TTL_SECONDS ?? 900);
  private readonly redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  async buildPreviewHash(payload: GenerateScheduleDto, actorId: string, actorRole: Role): Promise<string> {
    const namespaceVersion = await this.getNamespaceVersion();
    const normalizedSelections = [...(payload.manualSelections ?? [])]
      .filter((item) => item?.slotId && item?.assigneeId)
      .sort((left, right) => left.slotId.localeCompare(right.slotId, 'it'));

    const raw = JSON.stringify({
      actorId,
      actorRole,
      namespaceVersion,
      payload: {
        from: payload.from,
        to: payload.to,
        eventId: payload.eventId ?? null,
        occurrenceStart: payload.occurrenceStart ?? null,
        teamId: payload.teamId ?? null,
        scope: payload.scope ?? 'single',
        includeExistingAssignments: payload.includeExistingAssignments !== false,
        manualSelections: normalizedSelections,
      },
      plannerVersion: 'v1',
    });

    return createHash('sha256').update(raw).digest('hex');
  }

  async getPreview<T>(hash: string): Promise<T | null> {
    const cached = await this.redis.get(this.previewKey(hash));
    return cached ? (JSON.parse(cached) as T) : null;
  }

  async setPreview<T>(hash: string, payload: T): Promise<void> {
    await this.redis.set(this.previewKey(hash), JSON.stringify(payload), 'EX', this.previewTtlSeconds);
  }

  async incrementMetric(name: string, amount = 1): Promise<void> {
    await this.redis.incrby(this.metricKey(name), amount);
  }

  async addMetricValue(name: string, amount: number): Promise<void> {
    await this.redis.incrbyfloat(this.metricKey(name), amount);
  }

  async getMetrics(names: string[]): Promise<Record<string, number>> {
    const keys = names.map((name) => this.metricKey(name));
    const values = keys.length ? await this.redis.mget(keys) : [];
    return names.reduce<Record<string, number>>((acc, name, index) => {
      acc[name] = Number(values[index] ?? 0);
      return acc;
    }, {});
  }

  async resetMetrics(names: string[]): Promise<void> {
    const keys = names.map((name) => this.metricKey(name));
    if (keys.length) {
      await this.redis.del(...keys);
    }
    await this.redis.set(this.metricKey('last_reset_at_ms'), String(Date.now()));
  }

  async getCycleState<T>(hash: string): Promise<T | null> {
    const cached = await this.redis.get(this.cycleStateKey(hash));
    return cached ? (JSON.parse(cached) as T) : null;
  }

  async setCycleState<T>(hash: string, payload: T): Promise<void> {
    await this.redis.set(this.cycleStateKey(hash), JSON.stringify(payload), 'EX', this.cycleStateTtlSeconds);
  }

  async getCandidatePool<T>(hash: string): Promise<T | null> {
    const cached = await this.redis.get(this.candidatePoolKey(hash));
    return cached ? (JSON.parse(cached) as T) : null;
  }

  async setCandidatePool<T>(hash: string, payload: T): Promise<void> {
    await this.redis.set(this.candidatePoolKey(hash), JSON.stringify(payload), 'EX', this.candidatePoolTtlSeconds);
  }

  async getActiveJobId(hash: string): Promise<string | null> {
    return this.redis.get(this.jobKey(hash));
  }

  async setActiveJobId(hash: string, jobId: string): Promise<void> {
    await this.redis.set(this.jobKey(hash), jobId, 'EX', this.jobLinkTtlSeconds);
  }

  async clearActiveJobId(hash: string): Promise<void> {
    await this.redis.del(this.jobKey(hash));
  }

  async bumpNamespaceVersion(): Promise<number> {
    return this.redis.incr(this.namespaceKey());
  }

  async currentNamespaceVersion(): Promise<number> {
    return this.getNamespaceVersion();
  }

  buildAuxiliaryHash(payload: unknown): string {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  private async getNamespaceVersion(): Promise<number> {
    const value = await this.redis.get(this.namespaceKey());
    if (!value) {
      await this.redis.set(this.namespaceKey(), '1');
      return 1;
    }
    return Number(value) || 1;
  }

  private previewKey(hash: string): string {
    return `schedule:preview:${hash}`;
  }

  private jobKey(hash: string): string {
    return `schedule:preview-job:${hash}`;
  }

  private cycleStateKey(hash: string): string {
    return `schedule:cycle-state:${hash}`;
  }

  private candidatePoolKey(hash: string): string {
    return `schedule:candidate-pool:${hash}`;
  }

  private namespaceKey(): string {
    return 'schedule:namespace-version';
  }

  private metricKey(name: string): string {
    return `schedule:metric:${name}`;
  }
}
