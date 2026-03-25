import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UsePipes } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { TeamGroupsService } from './team-groups.service';
import {
  AssignMeetingGroupsToGroupDto,
  AssignMeetingGroupsToGroupSchema,
  AssignTeamsToGroupDto,
  AssignTeamsToGroupSchema,
  CreateTeamGroupDto,
  CreateTeamGroupSchema,
  UpdateTeamGroupDto,
  UpdateTeamGroupSchema,
} from '@shift-complete/shared-types';

@Controller('team-groups')
export class TeamGroupsController {
  constructor(private readonly teamGroupsService: TeamGroupsService) {}

  @Get()
  list() {
    return this.teamGroupsService.list();
  }

  @Roles(Role.administrator, Role.service_leader)
  @Post()
  @UsePipes(new ZodValidationPipe(CreateTeamGroupSchema))
  create(@Body() body: CreateTeamGroupDto, @CurrentUser() user: { sub: string }) {
    return this.teamGroupsService.create(body, user.sub);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Patch(':id')
  @UsePipes(new ZodValidationPipe(UpdateTeamGroupSchema))
  update(@Param('id') id: string, @Body() body: UpdateTeamGroupDto, @CurrentUser() user: { sub: string }) {
    return this.teamGroupsService.update(id, body, user.sub);
  }

  @Roles(Role.administrator)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.teamGroupsService.remove(id, user.sub);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Put(':id/teams')
  @UsePipes(new ZodValidationPipe(AssignTeamsToGroupSchema))
  assignTeams(@Param('id') id: string, @Body() body: AssignTeamsToGroupDto, @CurrentUser() user: { sub: string }) {
    return this.teamGroupsService.assignTeams(id, body.teamIds, user.sub);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Put(':id/meeting-groups')
  @UsePipes(new ZodValidationPipe(AssignMeetingGroupsToGroupSchema))
  assignMeetingGroups(@Param('id') id: string, @Body() body: AssignMeetingGroupsToGroupDto, @CurrentUser() user: { sub: string }) {
    return this.teamGroupsService.assignMeetingGroups(id, body.meetingGroupIds, user.sub);
  }
}
