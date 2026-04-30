import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notificacion } from '../entities/notificacion.entity';
import { User } from '../users/user.entity';
import { TipoEnum } from '../enums/tipo.enum';

@Injectable()
export class NotificacionesService {
  constructor(
    @InjectRepository(Notificacion)
    private readonly notificacionesRepo: Repository<Notificacion>
  ) {}

  async crearParaUsuario(usuario: User, mensaje: string, tipo: TipoEnum) {
    const noti = this.notificacionesRepo.create({
      usuario,
      mensaje,
      tipo,
      fecha: new Date(),
    });
    return this.notificacionesRepo.save(noti);
  }

  async obtenerParaUsuario(usuarioId: string) {
    return this.notificacionesRepo.find({
      where: { usuario: { id: usuarioId } },
      order: { fecha: 'DESC' },
    });
  }

  async marcarLeida(id: string) {
    await this.notificacionesRepo.update(id, { leida: true });
  }

  async delete (id: string) {
    await this.notificacionesRepo.delete(id);
  }
}
