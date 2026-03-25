import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UsePipes } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { MeetingGroupsService } from './meeting-groups.service';
import { z } from 'zod';
import {
  CreateMeetingGroupDto,
  CreateMeetingGroupSchema,
  UpdateMeetingGroupDto,
  UpdateMeetingGroupSchema,
} from '@shift-complete/shared-types';

const AssignMembersSchema = z.object({
  userIds: z.array(z.string().cuid().or(z.string().uuid()))
});

@Controller('meeting-groups')
export class MeetingGroupsController {
  constructor(private readonly meetingGroupsService: MeetingGroupsService) {}

  @Get()
  list() {
    return this.meetingGroupsService.list();
  }

  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser() user: { sub: string; role: Role }) {
    return this.meetingGroupsService.getById(id, user.sub, user.role);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Post()
  @UsePipes(new ZodValidationPipe(CreateMeetingGroupSchema))
  create(@Body() body: CreateMeetingGroupDto, @CurrentUser() user: { sub: string }) {
    return this.meetingGroupsService.create(body, user.sub);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Patch(':id')
  @UsePipes(new ZodValidationPipe(UpdateMeetingGroupSchema))
  update(@Param('id') id: string, @Body() body: UpdateMeetingGroupDto, @CurrentUser() user: { sub: string }) {
    return this.meetingGroupsService.update(id, body, user.sub);
  }

  @Roles(Role.administrator)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.meetingGroupsService.remove(id, user.sub);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Put(':id/members')
  @UsePipes(new ZodValidationPipe(AssignMembersSchema))
  assignMembers(@Param('id') id: string, @Body() body: { userIds: string[] }, @CurrentUser() user: { sub: string }) {
    return this.meetingGroupsService.assignMembers(id, body.userIds, user.sub);
  }
}
