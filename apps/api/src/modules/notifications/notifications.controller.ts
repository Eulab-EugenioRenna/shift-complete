import { Controller, Get, Patch, Param, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('channels')
  channels() {
    return this.notificationsService.channelSummary();
  }

  @Get()
  list(@CurrentUser() user: { sub: string }) {
    return this.notificationsService.listForUser(user.sub);
  }

  @Get('deliveries/recent')
  deliveries(@Query('limit') limit?: string) {
    return this.notificationsService.recentDeliveries(Number(limit ?? 20) || 20);
  }

  @Patch(':notificationId/read')
  read(@Param('notificationId') notificationId: string, @CurrentUser() user: { sub: string }) {
    return this.notificationsService.markAsRead(notificationId, user.sub);
  }
}
