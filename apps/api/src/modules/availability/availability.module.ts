import { Module } from '@nestjs/common';
import { DomainSyncModule } from '../domain-sync/domain-sync.module';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';

@Module({
  imports: [DomainSyncModule],
  controllers: [AvailabilityController],
  providers: [AvailabilityService]
})
export class AvailabilityModule {}
