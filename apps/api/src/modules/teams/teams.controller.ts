import { Body, Controller, Delete, Get, Param, Patch, Post, UsePipes } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { TeamsService } from './teams.service';
import {
  AddTeamMemberSchema,
  AssignMemberDutiesDto,
  AssignMemberDutiesSchema,
  CreateTeamJoinRequestDto,
  CreateTeamJoinRequestSchema,
  ResolveTeamJoinRequestDto,
  ResolveTeamJoinRequestSchema,
} from '@shift-complete/shared-types';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  list(@CurrentUser() user: { sub: string; role: Role }) {
    return this.teamsService.list(user.sub, user.role);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Post()
  create(@Body() body: CreateTeamDto, @CurrentUser() user: { sub: string; role: Role }) {
    return this.teamsService.create(body, user.sub, user.role);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Post(':teamId/members')
  @UsePipes(new ZodValidationPipe(AddTeamMemberSchema))
  addMember(@Param('teamId') teamId: string, @Body() body: { userId: string }, @CurrentUser() user: { sub: string; role: Role }) {
    return this.teamsService.addMember(teamId, body.userId, user.sub, user.role);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Delete(':teamId/members/:userId')
  removeMember(@Param('teamId') teamId: string, @Param('userId') userId: string, @CurrentUser() user: { sub: string; role: Role }) {
    return this.teamsService.removeMember(teamId, userId, user.sub, user.role);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Patch(':teamId/members/:userId/duties')
  @UsePipes(new ZodValidationPipe(AssignMemberDutiesSchema))
  assignMemberDuties(
    @Param('teamId') teamId: string,
    @Param('userId') userId: string,
    @Body() body: AssignMemberDutiesDto,
    @CurrentUser() user: { sub: string; role: Role }
  ) {
    return this.teamsService.assignMemberDuties(teamId, userId, body.dutyIds, user.sub, user.role);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Get('join-requests')
  listJoinRequests(@CurrentUser() user: { sub: string; role: Role }) {
    return this.teamsService.listJoinRequests(user.sub, user.role);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Post('join-requests')
  @UsePipes(new ZodValidationPipe(CreateTeamJoinRequestSchema))
  createJoinRequest(@Body() body: CreateTeamJoinRequestDto, @CurrentUser() user: { sub: string; role: Role }) {
    return this.teamsService.createJoinRequest(body.teamId, body.userId, user.sub, user.role);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Patch('join-requests/:requestId')
  @UsePipes(new ZodValidationPipe(ResolveTeamJoinRequestSchema))
  resolveJoinRequest(
    @Param('requestId') requestId: string,
    @Body() body: ResolveTeamJoinRequestDto,
    @CurrentUser() user: { sub: string; role: Role }
  ) {
    return this.teamsService.resolveJoinRequest(requestId, body.status, user.sub, user.role);
  }

  @Roles(Role.administrator)
  @Patch(':teamId')
  update(@Param('teamId') teamId: string, @Body() body: UpdateTeamDto, @CurrentUser() user: { sub: string }) {
    return this.teamsService.update(teamId, body, user.sub);
  }

  @Roles(Role.administrator)
  @Delete(':teamId')
  remove(@Param('teamId') teamId: string, @CurrentUser() user: { sub: string }) {
    return this.teamsService.remove(teamId, user.sub);
  }
}
