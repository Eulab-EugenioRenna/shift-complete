import { Module } from '@nestjs/common';
import { LoggingController } from './logging.controller';

@Module({
  controllers: [LoggingController]
})
export class LoggingModule {}
