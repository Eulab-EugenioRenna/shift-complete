import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { SchedulingController } from './scheduling.controller';
import { SchedulingCacheService } from './scheduling-cache.service';
import { SchedulingService } from './scheduling.service';
import { SchedulingWorkerService } from './scheduling-worker.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [RealtimeModule, EventsModule, JobsModule],
  controllers: [SchedulingController],
  providers: [SchedulingService, SchedulingCacheService, SchedulingWorkerService],
  exports: [SchedulingService]
})
export class SchedulingModule {}
