import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AssignVolunteerDto } from './dto/assign-volunteer.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  list() {
    return this.eventsService.list();
  }

  @Roles(Role.administrator, Role.service_leader)
  @Post()
  create(@Body() body: CreateEventDto, @CurrentUser() user: { sub: string; role: Role }) {
    return this.eventsService.create(body, user.sub, user.role);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Post('assignments')
  assign(@Body() body: AssignVolunteerDto, @CurrentUser() user: { sub: string; role: Role }) {
    return this.eventsService.assignVolunteer(body, user.sub, user.role);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Patch(':eventId')
  update(@Param('eventId') eventId: string, @Body() body: UpdateEventDto, @CurrentUser() user: { sub: string; role: Role }) {
    return this.eventsService.update(eventId, body, user.sub, user.role);
  }

  @Roles(Role.administrator, Role.service_leader)
  @Delete(':eventId')
  remove(@Param('eventId') eventId: string, @CurrentUser() user: { sub: string; role: Role }) {
    return this.eventsService.remove(eventId, user.sub, user.role);
  }
}
