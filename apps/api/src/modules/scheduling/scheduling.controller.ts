import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { GenerateScheduleDto } from './dto/generate-schedule.dto';
import { SchedulingService } from './scheduling.service';

@Controller('scheduling')
export class SchedulingController {
  constructor(private readonly schedulingService: SchedulingService) {}

  @Roles(Role.administrator, Role.service_leader)
  @Post('generate')
  generateCycle(@Body() body: GenerateScheduleDto, @CurrentUser() user: { sub: string; role: Role }) {
    return this.schedulingService.generatePreview(body, user.sub, user.role);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Post('apply')
  applyCycle(@Body() body: GenerateScheduleDto, @CurrentUser() user: { sub: string; role: Role }) {
    return this.schedulingService.applyPlan(body as GenerateScheduleDto & { applyScope: 'event' | 'month' | 'cycle' | 'year' | 'all' }, user.sub, user.role);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Get('plans')
  listPlans(@CurrentUser() user: { sub: string; role: Role }, @Query('eventId') eventId?: string) {
    return this.schedulingService.listPlans(user.sub, user.role, eventId);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Get('plans/:planId')
  getPlan(@Param('planId') planId: string, @CurrentUser() user: { sub: string; role: Role }) {
    return this.schedulingService.getPlan(planId, user.sub, user.role);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Get('metrics')
  metrics(@CurrentUser() user: { sub: string; role: Role }) {
    return this.schedulingService.metrics(user.sub, user.role);
  }

  @Roles(Role.administrator)
  @Post('metrics/reset')
  resetMetrics(@CurrentUser() user: { sub: string; role: Role }) {
    return this.schedulingService.resetMetrics(user.sub, user.role);
  }
}
