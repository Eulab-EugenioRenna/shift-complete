import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { WebhookPayload, WebhookProvider } from './webhook-provider.interface';

@Injectable()
export class WebhookNotificationProvider implements WebhookProvider {
  constructor(private readonly prisma: PrismaService) {}

  async send(message: WebhookPayload) {
    const settings = await this.prisma.aiSetting.findUnique({ where: { id: 'global' } });
    const enabled = settings?.webhookEnabled ?? (process.env.WEBHOOK_NOTIFICATIONS_ENABLED === 'true');
    const url = settings?.webhookUrl ?? process.env.WEBHOOK_NOTIFICATIONS_URL;

    if (!enabled || !url) {
      return { delivered: false, statusCode: 0 };
    }

    const body = JSON.stringify(message);
    const secret = settings?.webhookSecret ?? process.env.WEBHOOK_NOTIFICATIONS_SECRET;
    const signature = secret
      ? createHmac('sha256', secret).update(body).digest('hex')
      : undefined;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(signature ? { 'x-shift-signature': signature } : {})
      },
      body
    });

    return {
      delivered: response.ok,
      statusCode: response.status
    };
  }
}
