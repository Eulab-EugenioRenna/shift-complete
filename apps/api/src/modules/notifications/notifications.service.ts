import { Injectable } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationDispatchService } from './notification-dispatch.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly notificationDispatchService: NotificationDispatchService
  ) {}

  listForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
  }

  recentDeliveries(limit = 20) {
    return this.prisma.notificationDelivery.findMany({
      take: Math.min(limit, 100),
      orderBy: { createdAt: 'desc' },
      include: {
        notification: {
          select: {
            id: true,
            subject: true,
            body: true,
            user: {
              select: {
                id: true,
                email: true,
                fullName: true
              }
            }
          }
        }
      }
    });
  }

  channelSummary() {
    return ['in_app', 'email', 'websocket', 'webhook'];
  }

  async pushSystemNotification(userId: string, subject: string, body: string, link?: string, context: Record<string, unknown> = {}) {
    const settings = await this.prisma.aiSetting.findUnique({ where: { id: 'global' } });
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        channel: 'in_app',
        subject,
        body,
        link
      }
    });

    this.realtimeGateway.broadcastSchedulingUpdate({
      kind: 'notification.created',
      notification
    });

    this.realtimeGateway.broadcastNotificationCreated({ notification });

    const channels: NotificationChannel[] = [];
    if ((settings?.websocketNotificationsEnabled ?? (process.env.WEBSOCKET_NOTIFICATIONS_ENABLED !== 'false'))) channels.push(NotificationChannel.websocket);
    if ((settings?.emailNotificationsEnabled ?? (process.env.EMAIL_NOTIFICATIONS_ENABLED !== 'false'))) channels.push(NotificationChannel.email);
    if ((settings?.webhookEnabled ?? (process.env.WEBHOOK_NOTIFICATIONS_ENABLED === 'true'))) channels.push(NotificationChannel.webhook as NotificationChannel);

    if (channels.length) {
      await this.notificationDispatchService.queueDeliveries(notification.id, channels, {
        webAppUrl: settings?.webAppUrl ?? process.env.WEB_APP_URL,
        link,
        ...context
      });
    }

    return notification;
  }

  async markAsRead(notificationId: string, userId: string) {
    return this.prisma.notification.update({
      where: {
        id: notificationId,
        userId
      },
      data: {
        readAt: new Date()
      }
    });
  }
}
