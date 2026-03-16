import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway
  ) {}

  listForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
  }

  channelSummary() {
    return ['in_app', 'email', 'websocket'];
  }

  async pushSystemNotification(userId: string, subject: string, body: string) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        channel: 'in_app',
        subject,
        body
      }
    });

    this.realtimeGateway.broadcastSchedulingUpdate({
      kind: 'notification.created',
      notification
    });

    return notification;
  }
}
