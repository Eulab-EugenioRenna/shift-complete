import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { InventoryService } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('summary')
  summary(@CurrentUser() user: { sub: string; role: Role }) {
    return this.inventoryService.summary(user.sub, user.role);
  }

  @Get()
  list(@CurrentUser() user: { sub: string; role: Role }) {
    return this.inventoryService.list(user.sub, user.role);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Post()
  create(@Body() body: CreateInventoryItemDto, @CurrentUser() user: { sub: string; role: Role }) {
    return this.inventoryService.create(body, user.sub, user.role);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Patch(':itemId')
  update(@Param('itemId') itemId: string, @Body() body: UpdateInventoryItemDto, @CurrentUser() user: { sub: string; role: Role }) {
    return this.inventoryService.update(itemId, body, user.sub, user.role);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Delete(':itemId')
  remove(@Param('itemId') itemId: string, @CurrentUser() user: { sub: string; role: Role }) {
    return this.inventoryService.remove(itemId, user.sub, user.role);
  }
}
