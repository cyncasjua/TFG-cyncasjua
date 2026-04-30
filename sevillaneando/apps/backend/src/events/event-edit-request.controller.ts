import { Controller, Post, Param, Body, Patch, Get } from '@nestjs/common';
import { EventEditRequestService } from './event-edit-request.service';
import { EventEditRequestDto } from './dto/event-edit-request.dto';

@Controller('event-edit-requests')
export class EventEditRequestController {
  constructor(private readonly editRequestService: EventEditRequestService) {}

  @Post(':eventId/:userId')
  create(
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
    @Body() dto: EventEditRequestDto
  ) {
    return this.editRequestService.create(eventId, userId, dto);
  }

  @Patch(':requestId/approve')
  approve(@Param('requestId') requestId: string) {
    return this.editRequestService.approve(requestId);
  }

  @Patch(':requestId/reject')
  reject(@Param('requestId') requestId: string, @Body('motivoRechazo') motivoRechazo?: string) {
    return this.editRequestService.reject(requestId, motivoRechazo);
  }

  @Get('pending/:eventId')
  findPendingByEvent(@Param('eventId') eventId: string) {
    return this.editRequestService.findPendingByEvent(eventId);
  }

  @Get()
  findAll() {
    return this.editRequestService.findAll();
  }
}
