import { Body, Controller, Delete, Get, Param, Patch, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { Response } from 'express';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
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

  @Roles(Role.administrator, Role.service_leader)
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file: { originalname: string; buffer: Buffer; mimetype: string; size: number }, @Body('teamId') teamId: string | undefined, @CurrentUser() user: { sub: string; role: Role }) {
    return this.resourcesService.upload(file, teamId, user.sub, user.role);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Post('upload-async')
  @UseInterceptors(FileInterceptor('file'))
  uploadAsync(@UploadedFile() file: { originalname: string; buffer: Buffer; mimetype: string; size: number }, @Body('teamId') teamId: string | undefined, @CurrentUser() user: { sub: string; role: Role }) {
    return this.resourcesService.enqueueUpload(file, teamId, user.sub, user.role);
  }

  @Patch(':resourceId')
  update(@Param('resourceId') resourceId: string, @Body() body: UpdateResourceDto, @CurrentUser() user: { sub: string; role: Role }) {
    return this.resourcesService.update(resourceId, body, user.sub, user.role);
  }

  @Delete(':resourceId')
  remove(@Param('resourceId') resourceId: string, @CurrentUser() user: { sub: string; role: Role }) {
    return this.resourcesService.remove(resourceId, user.sub, user.role);
  }

  @Get(':resourceId/download')
  async download(@Param('resourceId') resourceId: string, @CurrentUser() user: { sub: string; role: Role }, @Res() response: Response) {
    const file = await this.resourcesService.download(resourceId, user.sub, user.role);
    response.download(file.path, file.name);
  }

  @Post(':resourceId/download-async')
  prepareDownload(@Param('resourceId') resourceId: string, @CurrentUser() user: { sub: string; role: Role }) {
    return this.resourcesService.prepareDownload(resourceId, user.sub, user.role);
  }
}
