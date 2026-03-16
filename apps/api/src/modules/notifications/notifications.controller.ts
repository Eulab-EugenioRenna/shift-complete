import { Controller, Get } from '@nestjs/common';
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
}
