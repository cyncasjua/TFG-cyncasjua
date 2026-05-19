import { Controller, Post, Param, Body, Patch, Get, UseGuards } from '@nestjs/common';
import { EventEditRequestService } from './event-edit-request.service';
import { EventEditRequestDto } from './dto/event-edit-request.dto';
import { ApiTags, ApiOperation, ApiParam, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../auth/firebase.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Solicitudes de edición')
@Controller('event-edit-requests')
export class EventEditRequestController {
  constructor(private readonly editRequestService: EventEditRequestService) {}

  @Post(':eventId/:userId')
  @ApiOperation({ summary: 'Crear una solicitud de edición de evento' })
  @ApiParam({ name: 'eventId', description: 'UUID del evento' })
  @ApiParam({ name: 'userId', description: 'UUID del usuario solicitante' })
  @ApiResponse({ status: 201, description: 'Solicitud creada correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  create(
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
    @Body() dto: EventEditRequestDto
  ) {
    return this.editRequestService.create(eventId, userId, dto);
  }

  @Patch(':requestId/approve')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('moderator')
  @ApiBearerAuth('firebase-jwt')
  @ApiOperation({ summary: 'Aprobar una solicitud de edición (moderator)' })
  @ApiParam({ name: 'requestId', description: 'UUID de la solicitud' })
  @ApiResponse({ status: 200, description: 'Solicitud aprobada' })
  approve(@Param('requestId') requestId: string) {
    return this.editRequestService.approve(requestId);
  }

  @Patch(':requestId/reject')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('moderator')
  @ApiBearerAuth('firebase-jwt')
  @ApiOperation({ summary: 'Rechazar una solicitud de edición (moderator)' })
  @ApiParam({ name: 'requestId', description: 'UUID de la solicitud' })
  @ApiResponse({ status: 200, description: 'Solicitud rechazada' })
  reject(@Param('requestId') requestId: string, @Body('motivoRechazo') motivoRechazo?: string) {
    return this.editRequestService.reject(requestId, motivoRechazo);
  }

  @Get('pending/:eventId')
  @ApiOperation({ summary: 'Listar solicitudes pendientes de un evento' })
  @ApiParam({ name: 'eventId', description: 'UUID del evento' })
  @ApiResponse({ status: 200, description: 'Lista de solicitudes pendientes' })
  findPendingByEvent(@Param('eventId') eventId: string) {
    return this.editRequestService.findPendingByEvent(eventId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas las solicitudes de edición' })
  @ApiResponse({ status: 200, description: 'Lista de solicitudes de edición' })
  findAll() {
    return this.editRequestService.findAll();
  }
}
