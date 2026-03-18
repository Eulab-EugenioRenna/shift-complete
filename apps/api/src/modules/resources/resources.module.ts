import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { QueueModule } from '../queue/queue.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ResourceStorageService } from './resource-storage.service';
import { ResourcesController } from './resources.controller';
import { ResourcesService } from './resources.service';
import { ResourcesWorkerService } from './resources-worker.service';

@Module({
  imports: [JobsModule, QueueModule, RealtimeModule],
  controllers: [ResourcesController],
  providers: [ResourceStorageService, ResourcesService, ResourcesWorkerService]
})
export class ResourcesModule {}
