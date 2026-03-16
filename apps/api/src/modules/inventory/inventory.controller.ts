import { Body, Controller, Get, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { InventoryService } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('summary')
  summary(@CurrentUser() user: { sub: string; role: Role }) {
    return this.inventoryService.summary(user.sub, user.role);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Post()
  create(@Body() body: CreateInventoryItemDto, @CurrentUser() user: { sub: string; role: Role }) {
    return this.inventoryService.create(body, user.sub, user.role);
  }
}
