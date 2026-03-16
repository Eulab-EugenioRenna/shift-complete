import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { QueueModule } from '../queue/queue.module';
import { NotificationsService } from './notifications.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationDispatchService } from './notification-dispatch.service';
import { NotificationWorkerService } from './notification-worker.service';
import { SmtpEmailProvider } from './providers/smtp-email.provider';
import { WebhookNotificationProvider } from './providers/webhook-notification.provider';

@Module({
  imports: [RealtimeModule, QueueModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationDispatchService,
    NotificationWorkerService,
    SmtpEmailProvider,
    WebhookNotificationProvider
  ],
  exports: [NotificationsService, SmtpEmailProvider, WebhookNotificationProvider]
})
export class NotificationsModule {}
