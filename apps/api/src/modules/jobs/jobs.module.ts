import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { BackgroundJobsService } from './background-jobs.service';

@Module({
  controllers: [JobsController],
  providers: [BackgroundJobsService],
  exports: [BackgroundJobsService]
})
export class JobsModule {}
