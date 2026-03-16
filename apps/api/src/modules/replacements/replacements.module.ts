import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReplacementsController } from './replacements.controller';
import { ReplacementsService } from './replacements.service';

@Module({
  imports: [NotificationsModule],
  controllers: [ReplacementsController],
  providers: [ReplacementsService]
})
export class ReplacementsModule {}
