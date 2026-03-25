import { Module } from '@nestjs/common';
import { DomainSyncModule } from '../domain-sync/domain-sync.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TeamGroupsController } from './team-groups.controller';
import { TeamGroupsService } from './team-groups.service';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  imports: [NotificationsModule, DomainSyncModule],
  controllers: [TeamsController, TeamGroupsController],
  providers: [TeamsService, TeamGroupsService]
})
export class TeamsModule {}
