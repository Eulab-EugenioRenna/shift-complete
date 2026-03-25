import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UsePipes } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { MeetingsService } from './meetings.service';
import {
  CreateMeetingDto,
  CreateMeetingSchema,
  ExtendedUpdateMeetingDto,
  ExtendedUpdateMeetingSchema,
} from '@shift-complete/shared-types';

@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Get()
  list(
    @Query('start') start?: string,
    @Query('end') end?: string
  ) {
    return this.meetingsService.list(start, end);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Post()
  @UsePipes(new ZodValidationPipe(CreateMeetingSchema))
  create(@Body() body: CreateMeetingDto, @CurrentUser() user: { sub: string; role: Role }) {
    return this.meetingsService.create(body, user.sub, user.role);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Patch(':id')
  @UsePipes(new ZodValidationPipe(ExtendedUpdateMeetingSchema))
  update(@Param('id') id: string, @Body() body: ExtendedUpdateMeetingDto, @CurrentUser() user: { sub: string; role: Role }) {
    return this.meetingsService.update(id, body, user.sub, user.role);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Query('mode') mode: 'single' | 'series',
    @Query('occurrenceStart') occurrenceStart: string,
    @CurrentUser() user: { sub: string; role: Role }
  ) {
    return this.meetingsService.remove(id, user.sub, user.role, mode, occurrenceStart);
  }
}
