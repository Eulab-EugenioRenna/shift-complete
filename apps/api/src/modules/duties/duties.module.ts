import { Module } from '@nestjs/common';
import { DutiesController } from './duties.controller';
import { DutiesService } from './duties.service';

@Module({
  controllers: [DutiesController],
  providers: [DutiesService]
})
export class DutiesModule {}
