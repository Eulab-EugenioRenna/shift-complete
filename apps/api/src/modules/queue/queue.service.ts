import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AI_QUEUE, NOTIFICATION_QUEUE, RESOURCE_QUEUE, SCHEDULING_QUEUE } from './queue.constants';

@Injectable()
export class QueueService {
  readonly resourceQueue: Queue;
  readonly notificationQueue: Queue;
  readonly aiQueue: Queue;
  readonly schedulingQueue: Queue;

  constructor() {
    const queueOptions = {
      connection: {
        url: process.env.REDIS_URL ?? 'redis://localhost:6379'
      },
      defaultJobOptions: {
        attempts: 3,
        removeOnComplete: 200,
        removeOnFail: 200,
        backoff: {
          type: 'exponential',
          delay: 1000
        }
      }
    };

    this.resourceQueue = new Queue(RESOURCE_QUEUE, queueOptions);
    this.notificationQueue = new Queue(NOTIFICATION_QUEUE, queueOptions);
    this.aiQueue = new Queue(AI_QUEUE, queueOptions);
    this.schedulingQueue = new Queue(SCHEDULING_QUEUE, queueOptions);
  }
}
