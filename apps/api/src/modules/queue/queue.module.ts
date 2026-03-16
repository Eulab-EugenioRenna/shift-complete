import { Global, Module } from '@nestjs/common';
import { InfraRedisModule } from '../infra/infra-redis.module';
import { QueueService } from './queue.service';

@Global()
@Module({
  imports: [InfraRedisModule],
  providers: [QueueService],
  exports: [QueueService]
})
export class QueueModule {}
