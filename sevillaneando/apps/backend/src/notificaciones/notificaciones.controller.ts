import { Controller, Get, Param, Patch, Delete, UseGuards } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { FirebaseAuthGuard } from '../auth/firebase.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { Notificacion } from './notificacion.entity';

@ApiTags('Notificaciones')
@ApiBearerAuth('firebase-jwt')
@Controller('notificaciones')
@UseGuards(FirebaseAuthGuard)
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Get('usuario/:usuarioId')
  @ApiOperation({ summary: 'Obtener notificaciones de un usuario' })
  @ApiParam({ name: 'usuarioId', description: 'UUID del usuario' })
  @ApiResponse({ status: 200, description: 'Lista de notificaciones del usuario', type: [Notificacion] })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async obtenerParaUsuario(@Param('usuarioId') usuarioId: string) {
    return this.notificacionesService.obtenerParaUsuario(usuarioId);
  }

  @Patch(':id/leida')
  @ApiOperation({ summary: 'Marcar una notificación como leída' })
  @ApiParam({ name: 'id', description: 'UUID de la notificación' })
  @ApiResponse({ status: 200, description: 'Notificación marcada como leída', schema: { example: { ok: true } } })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 404, description: 'Notificación no encontrada' })
  async marcarLeida(@Param('id') id: string) {
    await this.notificacionesService.marcarLeida(id);
    return { ok: true };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una notificación' })
  @ApiParam({ name: 'id', description: 'UUID de la notificación' })
  @ApiResponse({ status: 200, description: 'Notificación eliminada', schema: { example: { ok: true } } })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 404, description: 'Notificación no encontrada' })
  async delete(@Param('id') id: string) {
    await this.notificacionesService.delete(id);
    return { ok: true };
  }
}
