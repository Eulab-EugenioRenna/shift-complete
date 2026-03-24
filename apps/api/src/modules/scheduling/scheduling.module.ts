import { Module } from '@nestjs/common';
import { SchedulingController } from './scheduling.controller';
import { SchedulingService } from './scheduling.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [RealtimeModule, EventsModule],
  controllers: [SchedulingController],
  providers: [SchedulingService]
})
export class SchedulingModule {}
