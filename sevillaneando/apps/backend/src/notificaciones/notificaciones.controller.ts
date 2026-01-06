import { Controller, Get, Param, Patch } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';

@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Get('usuario/:usuarioId')
  async obtenerParaUsuario(@Param('usuarioId') usuarioId: string) {
    return this.notificacionesService.obtenerParaUsuario(usuarioId);
  }

  @Patch(':id/leida')
  async marcarLeida(@Param('id') id: string) {
    await this.notificacionesService.marcarLeida(id);
    return { ok: true };
  }
}
