import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UsePipes } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EventsService } from './events.service';
import { 
  CreateEventSchema, CreateEventDto, 
  ExtendedUpdateEventSchema, ExtendedUpdateEventDto,
  AssignVolunteerSchema, AssignVolunteerDto 
} from '@shift-complete/shared-types';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  list(@CurrentUser() user: { sub: string; role: Role }) {
    return this.eventsService.list(user.sub, user.role);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Post()
  @UsePipes(new ZodValidationPipe(CreateEventSchema))
  create(@Body() body: CreateEventDto, @CurrentUser() user: { sub: string; role: Role }) {
    return this.eventsService.create(body as any, user.sub, user.role); // as any because service might expect old DTO type, we'll fix service next
  }

  @Roles(Role.administrator, Role.service_leader)
  @Post('assignments')
  @UsePipes(new ZodValidationPipe(AssignVolunteerSchema))
  assign(@Body() body: AssignVolunteerDto, @CurrentUser() user: { sub: string; role: Role }) {
    return this.eventsService.assignVolunteer(body as any, user.sub, user.role);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Patch(':eventId')
  @UsePipes(new ZodValidationPipe(ExtendedUpdateEventSchema))
  update(@Param('eventId') eventId: string, @Body() body: ExtendedUpdateEventDto, @CurrentUser() user: { sub: string; role: Role }) {
    return this.eventsService.update(eventId, body as any, user.sub, user.role);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Delete(':eventId')
  remove(
    @Param('eventId') eventId: string,
    @CurrentUser() user: { sub: string; role: Role },
    @Query('mode') mode?: 'single' | 'series',
    @Query('occurrenceStart') occurrenceStart?: string
  ) {
    return this.eventsService.remove(eventId, user.sub, user.role, mode, occurrenceStart);
  }
}
