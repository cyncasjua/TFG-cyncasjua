import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MensajePrivado } from '../chat/mensaje-privado.entity';

const DIAS_RETENCION = 30;

@Injectable()
export class PurgaDatosScheduler {
  private readonly logger = new Logger(PurgaDatosScheduler.name);

  constructor(
    @InjectRepository(MensajePrivado)
    private readonly mensajesPrivadosRepo: Repository<MensajePrivado>
  ) {}

  // Purga mensajes privados donde emisor Y receptor son NULL (ambos usuarios eliminados)
  // y llevan más de DIAS_RETENCION días en ese estado, cumpliendo la política de privacidad.
  async purgarMensajesHuerfanos(): Promise<void> {
    this.logger.log('Iniciando purga RGPD de mensajes privados huérfanos...');

    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - DIAS_RETENCION);

    const resultado = await this.mensajesPrivadosRepo.manager.query(
      `DELETE FROM mensajes_privados
       WHERE "emisorId" IS NULL
         AND "receptorId" IS NULL
         AND "fechaCreacion" < $1`,
      [fechaLimite]
    );

    const affected = Array.isArray(resultado) ? resultado[1] : (resultado?.rowCount ?? 0);
    this.logger.log(`Purga RGPD completada: ${affected} mensajes privados eliminados.`);
  }
}
