import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { FirebaseAuthGuard } from '../auth/firebase.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('admin', 'moderator')
  @Post()
  create(@Body() dto: CreateEventDto) {
    return this.eventsService.create(dto);
  }

  @Get()
  findAll() {
    return this.eventsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('admin', 'moderator')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.eventsService.update(id, dto);
  }

  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.eventsService.remove(id);
  }
}
