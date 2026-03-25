import { Module } from '@nestjs/common';
import { DomainSyncModule } from '../domain-sync/domain-sync.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MeetingGroupsController } from './meeting-groups.controller';
import { MeetingGroupsService } from './meeting-groups.service';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';

@Module({
  imports: [NotificationsModule, DomainSyncModule],
  controllers: [MeetingGroupsController, MeetingsController],
  providers: [MeetingGroupsService, MeetingsService],
  exports: [MeetingGroupsService, MeetingsService]
})
export class MeetingsModule {}
