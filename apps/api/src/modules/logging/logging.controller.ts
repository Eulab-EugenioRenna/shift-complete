import { Controller, Get } from '@nestjs/common';

@Controller('logs')
export class LoggingController {
  @Get('health')
  health() {
    return {
      auditTrail: true,
      structuredLogging: true,
      retentionDays: 180
    };
  }
}
