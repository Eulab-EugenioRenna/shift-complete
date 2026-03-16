import { Body, Controller, Get, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateResourceDto } from './dto/create-resource.dto';
import { ResourcesService } from './resources.service';

@Controller('resources')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Get()
  list(@CurrentUser() user: { sub: string; role: Role }) {
    return this.resourcesService.list(user.sub, user.role);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Post()
  create(@Body() body: CreateResourceDto, @CurrentUser() user: { sub: string; role: Role }) {
    return this.resourcesService.create(body, user.sub, user.role);
  }
}
