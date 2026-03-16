import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AddTeamMemberDto } from './dto/add-team-member.dto';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { TeamsService } from './teams.service';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  list() {
    return this.teamsService.list();
  }

  @Roles(Role.administrator)
  @Post()
  create(@Body() body: CreateTeamDto, @CurrentUser() user: { sub: string }) {
    return this.teamsService.create(body, user.sub);
  }

  @Roles(Role.administrator)
  @Post(':teamId/members')
  addMember(@Param('teamId') teamId: string, @Body() body: AddTeamMemberDto, @CurrentUser() user: { sub: string }) {
    return this.teamsService.addMember(teamId, body.userId, user.sub);
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
