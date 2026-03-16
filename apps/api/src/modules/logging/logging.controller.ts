import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Controller('logs')
export class LoggingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  health() {
    return {
      auditTrail: true,
      structuredLogging: true,
      retentionDays: 180
    };
  }

  @Get('recent')
  recent(@Query('limit') limit?: string) {
    const take = Math.min(Number(limit ?? 20) || 20, 100);
    return this.prisma.auditLog.findMany({
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, fullName: true, email: true }
        }
      }
    });
  }
}
