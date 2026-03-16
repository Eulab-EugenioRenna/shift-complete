import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UsePipes } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  CreateAvailabilityDto,
  CreateAvailabilitySchema,
  UpdateAvailabilityDto,
  UpdateAvailabilitySchema,
} from '@shift-complete/shared-types';
import { AvailabilityService } from './availability.service';

@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get()
  list(@CurrentUser() user: { sub: string; role: Role }, @Query('userId') userId?: string) {
    return this.availabilityService.list(user.sub, user.role, userId);
  }

  @Roles(Role.administrator, Role.service_leader, Role.volunteer)
  @Post()
  @UsePipes(new ZodValidationPipe(CreateAvailabilitySchema))
  create(
    @CurrentUser() user: { sub: string; role: Role },
    @Body() body: CreateAvailabilityDto,
    @Query('userId') userId?: string
  ) {
    return this.availabilityService.create(user.sub, user.role, body, userId);
  }

  @Roles(Role.administrator, Role.service_leader, Role.volunteer)
  @Patch(':availabilityId')
  @UsePipes(new ZodValidationPipe(UpdateAvailabilitySchema))
  update(
    @Param('availabilityId') availabilityId: string,
    @CurrentUser() user: { sub: string; role: Role },
    @Body() body: UpdateAvailabilityDto
  ) {
    return this.availabilityService.update(availabilityId, user.sub, user.role, body);
  }

  @Roles(Role.administrator, Role.service_leader, Role.volunteer)
  @Delete(':availabilityId')
  remove(@Param('availabilityId') availabilityId: string, @CurrentUser() user: { sub: string; role: Role }) {
    return this.availabilityService.remove(availabilityId, user.sub, user.role);
  }
}
