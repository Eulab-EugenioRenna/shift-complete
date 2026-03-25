import { Injectable } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationDispatchService } from './notification-dispatch.service';

type NotificationBackfillMatch = {
  notificationId: string;
  dutyId: string;
  teamName: string;
};

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
      try {
        await this.notificationDispatchService.queueDeliveries(notification.id, channels, {
          webAppUrl: settings?.webAppUrl ?? process.env.WEB_APP_URL,
          link,
          ...context
        });
      } catch (error) {
        console.warn('Notification delivery queue unavailable, keeping in-app notification only.', error);
      }
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

  async backfillAssignmentDutyIds(): Promise<{ updated: number }> {
    const notifications = await this.prisma.notification.findMany({
      where: {
        subject: 'Nuova assegnazione turno',
      },
      select: {
        id: true,
        body: true,
      },
    });

    const matches = notifications
      .map((notification) => this.extractAssignmentBodyMatch(notification.id, notification.body))
      .filter((item): item is NotificationBackfillMatch => Boolean(item));

    if (!matches.length) {
      return { updated: 0 };
    }

    const dutyIds = Array.from(new Set(matches.map((item) => item.dutyId)));
    const duties = await this.prisma.duty.findMany({
      where: { id: { in: dutyIds } },
      select: { id: true, name: true },
    });
    const dutyMap = new Map(duties.map((duty) => [duty.id, duty.name]));

    let updated = 0;
    for (const match of matches) {
      const dutyName = dutyMap.get(match.dutyId);
      if (!dutyName) {
        continue;
      }

      await this.prisma.notification.update({
        where: { id: match.notificationId },
        data: {
          body: `Sei stato assegnato al servizio ${dutyName} del team ${match.teamName}.`,
        },
      });
      updated += 1;
    }

    return { updated };
  }

  private extractAssignmentBodyMatch(notificationId: string, body: string): NotificationBackfillMatch | null {
    const match = body.match(/^Sei stato assegnato al servizio ([a-z0-9]+) del team (.+)\.$/i);
    if (!match) {
      return null;
    }

    return {
      notificationId,
      dutyId: match[1],
      teamName: match[2],
    };
  }
}
