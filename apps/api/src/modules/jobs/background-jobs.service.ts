import { Injectable } from '@nestjs/common';
import { BackgroundJobKind, BackgroundJobStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { toJsonValue } from '../../common/utils/json.util';

@Injectable()
export class BackgroundJobsService {
  constructor(private readonly prisma: PrismaService) {}

  create(payload: {
    kind: BackgroundJobKind;
    userId?: string;
    teamId?: string | null;
    entityType?: string;
    entityId?: string;
    payload?: unknown;
  }) {
    return this.prisma.backgroundJob.create({
      data: {
        kind: payload.kind,
        userId: payload.userId,
        teamId: payload.teamId ?? undefined,
        entityType: payload.entityType,
        entityId: payload.entityId,
        payload: toJsonValue(payload.payload),
        status: BackgroundJobStatus.queued,
        progress: 0
      }
    });
  }

  update(jobId: string, payload: {
    status?: BackgroundJobStatus;
    progress?: number;
    result?: unknown;
    error?: string | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
  }) {
    return this.prisma.backgroundJob.update({
      where: { id: jobId },
      data: {
        status: payload.status,
        progress: payload.progress,
        result: payload.result === undefined ? undefined : toJsonValue(payload.result),
        error: payload.error === undefined ? undefined : payload.error,
        startedAt: payload.startedAt === undefined ? undefined : payload.startedAt,
        completedAt: payload.completedAt === undefined ? undefined : payload.completedAt
      }
    });
  }

  listForUser(userId: string) {
    return this.prisma.backgroundJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  }

  findById(jobId: string) {
    return this.prisma.backgroundJob.findUniqueOrThrow({ where: { id: jobId } });
  }
}
