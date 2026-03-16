import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { NotificationChannel, NotificationDeliveryStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NOTIFICATION_QUEUE } from '../queue/queue.constants';
import { SmtpEmailProvider } from './providers/smtp-email.provider';
import { WebhookNotificationProvider } from './providers/webhook-notification.provider';

@Injectable()
export class NotificationWorkerService implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly smtpEmailProvider: SmtpEmailProvider,
    private readonly webhookNotificationProvider: WebhookNotificationProvider
  ) {}

  onModuleInit() {
    void this.bootstrapWorker();
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  private async process(job: Job<{ deliveryId: string; notificationId: string; channel: NotificationChannel; context?: Record<string, unknown> }>) {
    const delivery = await this.prisma.notificationDelivery.findUniqueOrThrow({
      where: { id: job.data.deliveryId },
      include: {
        notification: {
          include: {
            user: {
              select: { email: true, fullName: true }
            }
          }
        }
      }
    });

    try {
      if (job.data.channel === NotificationChannel.email) {
        const webAppUrl = String(job.data.context?.['webAppUrl'] ?? process.env.WEB_APP_URL ?? 'http://localhost:4200').replace(/\/$/, '');
        const relativeLink = typeof job.data.context?.['link'] === 'string' ? String(job.data.context?.['link']) : delivery.notification.link;
        const actionUrl = relativeLink ? `${webAppUrl}${relativeLink.startsWith('/') ? '' : '/'}${relativeLink}` : undefined;
        const result = await this.smtpEmailProvider.send({
          to: delivery.notification.user.email,
          subject: delivery.notification.subject,
          text: delivery.notification.body,
          html: this.buildEmailTemplate({
            subject: delivery.notification.subject,
            body: delivery.notification.body,
            recipientName: delivery.notification.user.fullName,
            actionUrl,
            kind: typeof job.data.context?.['template'] === 'string' ? String(job.data.context?.['template']) : undefined,
            tempPassword: typeof job.data.context?.['tempPassword'] === 'string' ? String(job.data.context?.['tempPassword']) : undefined
          })
        });

        if (!result.accepted) {
          throw new Error('SMTP provider non configurato o destinatario rifiutato');
        }
      }

      if (job.data.channel === NotificationChannel.webhook) {
        const result = await this.webhookNotificationProvider.send({
          event: 'notification.created',
          timestamp: new Date().toISOString(),
          payload: {
            notificationId: delivery.notificationId,
            subject: delivery.notification.subject,
            body: delivery.notification.body,
            link: delivery.notification.link,
            userEmail: delivery.notification.user.email,
            context: job.data.context ?? {}
          }
        });

        if (!result.delivered) {
          throw new Error(`Webhook delivery fallita (${result.statusCode ?? 0})`);
        }
      }

      if (job.data.channel === NotificationChannel.websocket) {
        this.realtimeGateway.broadcastNotificationCreated({
          notification: delivery.notification,
          deliveryId: delivery.id
        });
      }

      await this.prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: NotificationDeliveryStatus.sent,
          deliveredAt: new Date(),
          lastError: null
        }
      });

      this.realtimeGateway.broadcastNotificationDelivery({
        deliveryId: delivery.id,
        notificationId: delivery.notificationId,
        channel: delivery.channel,
        status: NotificationDeliveryStatus.sent
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Delivery fallita';

      await this.prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: NotificationDeliveryStatus.failed,
          lastError: message
        }
      });

      this.realtimeGateway.broadcastNotificationDelivery({
        deliveryId: delivery.id,
        notificationId: delivery.notificationId,
        channel: delivery.channel,
        status: NotificationDeliveryStatus.failed,
        error: message
      });

      throw error;
    }
  }

  private async bootstrapWorker() {
    const settings = await this.prisma.aiSetting.findUnique({ where: { id: 'global' } });
    this.worker = new Worker(
      NOTIFICATION_QUEUE,
      async (job) => this.process(job),
      {
        connection: {
          url: settings?.redisUrl ?? process.env.REDIS_URL ?? 'redis://localhost:6379'
        },
        concurrency: settings?.notificationJobConcurrency ?? Number(process.env.NOTIFICATION_JOB_CONCURRENCY ?? 5)
      }
    );
  }

  private buildEmailTemplate(payload: { subject: string; body: string; recipientName?: string | null; actionUrl?: string; kind?: string; tempPassword?: string }) {
    const bodyHtml = payload.body
      .split('\n')
      .filter(Boolean)
      .map((line) => `<p style="margin:0 0 12px;line-height:1.55;color:#334155;">${line}</p>`)
      .join('');

    const accent = payload.kind === 'credentials'
      ? '#0f766e'
      : payload.kind === 'assignment'
        ? '#7c3aed'
        : payload.kind === 'team'
          ? '#b45309'
          : '#3156b3';

    const extraBlock = payload.tempPassword
      ? `<div style="margin:18px 0;padding:16px;border:1px solid #cbd5e1;border-radius:14px;background:#f8fafc;"><div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#64748b;margin-bottom:8px;">Password temporanea</div><div style="font-family:Menlo,Consolas,monospace;font-size:18px;color:#0f172a;">${payload.tempPassword}</div></div>`
      : '';

    return `
      <div style="font-family:Inter,Segoe UI,Arial,sans-serif;background:#f8fafc;padding:32px;">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;box-shadow:0 18px 40px rgba(15,23,42,0.08);">
          <div style="padding:24px 28px;background:linear-gradient(135deg,${accent},#4979e6);color:#ffffff;">
            <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.82;">Shift Complete</div>
            <h1 style="margin:10px 0 0;font-size:22px;line-height:1.2;">${payload.subject}</h1>
          </div>
          <div style="padding:28px;">
            <p style="margin:0 0 16px;color:#0f172a;font-size:15px;">Ciao ${payload.recipientName ?? ''},</p>
            ${bodyHtml}
            ${extraBlock}
            ${payload.actionUrl ? `<a href="${payload.actionUrl}" style="display:inline-block;margin-top:12px;padding:12px 18px;border-radius:12px;background:#3156b3;color:#ffffff;text-decoration:none;font-weight:600;">Apri Shift Complete</a>` : ''}
          </div>
        </div>
      </div>
    `;
  }
}
