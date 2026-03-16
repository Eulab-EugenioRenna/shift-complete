import { Body, Controller, Post } from '@nestjs/common';
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
}
