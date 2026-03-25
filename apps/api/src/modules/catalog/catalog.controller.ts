import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { SyncHolidayCalendarDto, UpsertPreferenceCatalogItemDto } from '@shift-complete/shared-types';
import { CatalogService } from './catalog.service';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('preferences')
  listCatalog(@Query('type') type?: string) {
    return this.catalogService.listCatalog(type);
  }

  @Roles(Role.administrator)
  @Post('preferences')
  upsertCatalogItem(@Body() body: UpsertPreferenceCatalogItemDto, @CurrentUser() _user: { sub: string }) {
    return this.catalogService.upsertCatalogItem(body);
  }

  @Roles(Role.administrator)
  @Delete('preferences/:id')
  removeCatalogItem(@Param('id') id: string, @CurrentUser() _user: { sub: string }) {
    return this.catalogService.removeCatalogItem(id);
  }

  @Get('holidays')
  listHolidays() {
    return this.catalogService.listHolidays();
  }

  @Roles(Role.administrator)
  @Post('holidays/sync')
  syncHolidays(@Body() body: SyncHolidayCalendarDto, @CurrentUser() _user: { sub: string }) {
    return this.catalogService.syncItalianHolidays(body);
  }
}
