import { Module } from '@nestjs/common';
import { DomainSyncModule } from '../domain-sync/domain-sync.module';
import { DutiesController } from './duties.controller';
import { DutiesService } from './duties.service';

@Module({
  imports: [DomainSyncModule],
  controllers: [DutiesController],
  providers: [DutiesService]
})
export class DutiesModule {}
