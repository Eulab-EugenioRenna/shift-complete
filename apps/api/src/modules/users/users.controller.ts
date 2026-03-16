import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: { sub: string; email: string; role: string }) {
    return this.usersService.findById(user.sub);
  }

  @Roles(Role.administrator)
  @Get()
  list(@Query('role') role?: string) {
    return this.usersService.list(role);
  }
}
