import { Body, Controller, Get, Param, Patch, Post, UsePipes } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CreateReplacementDto, CreateReplacementSchema, ResolveReplacementDto, ResolveReplacementSchema } from '@shift-complete/shared-types';
import { ReplacementsService } from './replacements.service';

@Controller('replacements')
export class ReplacementsController {
  constructor(private readonly replacementsService: ReplacementsService) {}

  @Get()
  list(@CurrentUser() user: { sub: string; role: Role }) {
    return this.replacementsService.list(user.sub, user.role);
  }

  @Roles(Role.administrator, Role.service_leader, Role.volunteer)
  @Post()
  @UsePipes(new ZodValidationPipe(CreateReplacementSchema))
  create(@CurrentUser() user: { sub: string; role: Role }, @Body() body: CreateReplacementDto) {
    return this.replacementsService.create(user.sub, user.role, body);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Patch(':replacementId/resolve')
  @UsePipes(new ZodValidationPipe(ResolveReplacementSchema))
  resolve(
    @Param('replacementId') replacementId: string,
    @CurrentUser() user: { sub: string; role: Role },
    @Body() body: ResolveReplacementDto
  ) {
    return this.replacementsService.resolve(replacementId, user.sub, user.role, body);
  }
}
