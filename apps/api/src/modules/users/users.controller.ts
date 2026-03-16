import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UsePipes } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ChangeMyPasswordDto, ChangeMyPasswordSchema, UpdateUserProfileDto, UpdateUserProfileSchema } from '@shift-complete/shared-types';
import { CreateManagedUserDto } from './dto/create-managed-user.dto';
import { UpdateManagedUserDto } from './dto/update-managed-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: { sub: string; email: string; role: string }) {
    return this.usersService.findById(user.sub);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Get()
  list(@CurrentUser() user: { sub: string; role: Role }, @Query('role') role?: string, @Query('teamId') teamId?: string) {
    return this.usersService.list(user.sub, user.role, role, teamId);
  }

  @Roles(Role.administrator)
  @Post()
  createManagedUser(@CurrentUser() user: { sub: string }, @Body() body: CreateManagedUserDto) {
    return this.usersService.createManagedUser(user.sub, body);
  }

  @Roles(Role.administrator)
  @Get(':userId/detail')
  detail(@CurrentUser() user: { sub: string }, @Param('userId') userId: string) {
    return this.usersService.detail(user.sub, userId);
  }

  @Roles(Role.administrator)
  @Patch(':userId')
  updateManagedUser(@CurrentUser() user: { sub: string }, @Param('userId') userId: string, @Body() body: UpdateManagedUserDto) {
    return this.usersService.updateManagedUser(user.sub, userId, body);
  }

  @Roles(Role.administrator)
  @Delete(':userId')
  removeManagedUser(@CurrentUser() user: { sub: string }, @Param('userId') userId: string) {
    return this.usersService.removeManagedUser(user.sub, userId);
  }

  @Roles(Role.administrator)
  @Post(':userId/send-credentials')
  sendCredentials(@CurrentUser() user: { sub: string }, @Param('userId') userId: string) {
    return this.usersService.sendCredentials(user.sub, userId);
  }

  @Roles(Role.administrator)
  @Post(':userId/suspend')
  suspend(@CurrentUser() user: { sub: string }, @Param('userId') userId: string) {
    return this.usersService.suspendUser(user.sub, userId);
  }

  @Roles(Role.administrator)
  @Post(':userId/resume')
  resume(@CurrentUser() user: { sub: string }, @Param('userId') userId: string) {
    return this.usersService.resumeUser(user.sub, userId);
  }

  @Patch('me')
  @UsePipes(new ZodValidationPipe(UpdateUserProfileSchema))
  updateMe(@CurrentUser() user: { sub: string }, @Body() body: UpdateUserProfileDto) {
    return this.usersService.updateProfile(user.sub, body);
  }

  @Patch('me/password')
  @UsePipes(new ZodValidationPipe(ChangeMyPasswordSchema))
  changeMyPassword(@CurrentUser() user: { sub: string }, @Body() body: ChangeMyPasswordDto) {
    return this.usersService.changeMyPassword(user.sub, body);
  }
}
