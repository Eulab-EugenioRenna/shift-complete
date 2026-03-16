import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CONNECTION } from './redis.constants';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CONNECTION,
      useFactory: () => new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
        maxRetriesPerRequest: null,
        enableReadyCheck: false
      })
    }
  ],
  exports: [REDIS_CONNECTION]
})
export class InfraRedisModule {}
