import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UsePipes } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CreateDutyDto, CreateDutySchema, UpdateDutyDto, UpdateDutySchema, UpdateTeamCompetenciesDto, UpdateTeamCompetenciesSchema } from '@shift-complete/shared-types';
import { DutiesService } from './duties.service';

@Controller('duties')
export class DutiesController {
  constructor(private readonly dutiesService: DutiesService) {}

  @Get()
  list(@Query('teamId') teamId: string | undefined, @CurrentUser() user: { sub: string; role: Role }) {
    return this.dutiesService.list(user.sub, user.role, teamId);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Post()
  @UsePipes(new ZodValidationPipe(CreateDutySchema))
  create(@Body() body: CreateDutyDto, @CurrentUser() user: { sub: string; role: Role }) {
    return this.dutiesService.create(body, user.sub, user.role);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Patch(':dutyId')
  @UsePipes(new ZodValidationPipe(UpdateDutySchema))
  update(@Param('dutyId') dutyId: string, @Body() body: UpdateDutyDto, @CurrentUser() user: { sub: string; role: Role }) {
    return this.dutiesService.update(dutyId, body, user.sub, user.role);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Patch(':dutyId/competencies')
  @UsePipes(new ZodValidationPipe(UpdateTeamCompetenciesSchema))
  updateCompetencies(@Param('dutyId') dutyId: string, @Body() body: UpdateTeamCompetenciesDto, @CurrentUser() user: { sub: string; role: Role }) {
    return this.dutiesService.updateCompetencies(dutyId, body.competencyValues, user.sub, user.role);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Delete(':dutyId')
  remove(@Param('dutyId') dutyId: string, @CurrentUser() user: { sub: string; role: Role }) {
    return this.dutiesService.remove(dutyId, user.sub, user.role);
  }
}
