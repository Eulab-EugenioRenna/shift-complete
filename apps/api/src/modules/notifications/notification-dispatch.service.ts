import { Injectable } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import { toJsonValue } from '../../common/utils/json.util';
import { PrismaService } from '../../database/prisma.service';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class NotificationDispatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService
  ) {}

  async queueDeliveries(notificationId: string, channels: NotificationChannel[], context: Record<string, unknown> = {}) {
    const notification = await this.prisma.notification.findUniqueOrThrow({
      where: { id: notificationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true
          }
        }
      }
    });

    for (const channel of channels) {
      const delivery = await this.prisma.notificationDelivery.create({
        data: {
          notificationId,
          channel,
          target: channel === NotificationChannel.email ? notification.user.email : undefined,
          payload: toJsonValue(context)
        }
      });

      await this.queueService.notificationQueue.add('dispatch', {
        deliveryId: delivery.id,
        notificationId,
        channel,
        context
      });
    }
  }
}
