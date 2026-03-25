import { Module } from '@nestjs/common';
import { DomainSyncModule } from '../domain-sync/domain-sync.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { ReplacementsController } from './replacements.controller';
import { ReplacementsService } from './replacements.service';

@Module({
  imports: [NotificationsModule, SchedulingModule, DomainSyncModule],
  controllers: [ReplacementsController],
  providers: [ReplacementsService]
})
export class ReplacementsModule {}
