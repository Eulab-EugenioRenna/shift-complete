import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../../database/prisma.service';
import { EmailMessage, EmailProvider } from './email-provider.interface';

@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  constructor(private readonly prisma: PrismaService) {}

  async send(message: EmailMessage) {
    const settings = await this.prisma.aiSetting.findUnique({ where: { id: 'global' } });
    const host = settings?.smtpHost ?? process.env.SMTP_HOST;
    const fromEmail = settings?.smtpFromEmail ?? process.env.SMTP_FROM_EMAIL;

    if (!host || !fromEmail) {
      return { accepted: false, provider: 'smtp-disabled' };
    }

    const transporter = nodemailer.createTransport({
      host,
      port: settings?.smtpPort ?? Number(process.env.SMTP_PORT ?? 587),
      secure: settings?.smtpSecure ?? (process.env.SMTP_SECURE === 'true'),
      auth: (settings?.smtpUser ?? process.env.SMTP_USER)
        ? {
            user: settings?.smtpUser ?? process.env.SMTP_USER,
            pass: settings?.smtpPassword ?? process.env.SMTP_PASSWORD
          }
        : undefined
    });

    const info = await transporter.sendMail({
      from: {
        address: fromEmail,
        name: settings?.smtpFromName ?? process.env.SMTP_FROM_NAME ?? 'Shift Complete'
      },
      replyTo: (settings?.smtpReplyTo ?? process.env.SMTP_REPLY_TO) || undefined,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html
    });

    return {
      accepted: info.accepted.length > 0,
      provider: 'smtp',
      messageId: info.messageId
    };
  }
}
