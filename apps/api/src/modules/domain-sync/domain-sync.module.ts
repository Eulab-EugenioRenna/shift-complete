import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { DomainSyncService } from './domain-sync.service';

@Module({
  imports: [RealtimeModule],
  providers: [DomainSyncService],
  exports: [DomainSyncService],
})
export class DomainSyncModule {}
