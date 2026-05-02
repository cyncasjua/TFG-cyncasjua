import { Controller, Get, Param, Patch, Delete, UseGuards } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { FirebaseAuthGuard } from '../auth/firebase.guard';

@Controller('notificaciones')
@UseGuards(FirebaseAuthGuard)
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

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.notificacionesService.delete(id);
    return { ok: true };
  }
}
