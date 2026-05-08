import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { User } from '../users/user.entity';
import { TipoEnum } from './enums/tipo.enum';
import { ApiProperty } from '@nestjs/swagger';

@Entity()
export class Notificacion {
  @ApiProperty({ description: 'UUID de la notificación' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  usuario!: User;

  @ApiProperty({ description: 'Texto de la notificación' })
  @Column({ nullable: false })
  mensaje!: string;

  @ApiProperty({ description: 'Tipo de notificación', enum: TipoEnum })
  @Column({ type: 'enum', enum: TipoEnum, nullable: false })
  tipo!: TipoEnum;

  @ApiProperty({ description: 'Fecha de la notificación' })
  @Column('timestamp', { nullable: false })
  fecha!: Date;

  @ApiProperty({ description: 'Si la notificación ha sido leída' })
  @Column({ default: false })
  leida!: boolean;

  enviarNotificacion() {
    this.fecha = new Date();
  }

  @BeforeInsert()
  @BeforeUpdate()
  validateNotificacion() {
    if (!this.mensaje || this.mensaje.trim().length === 0) {
      throw new Error('El mensaje de la notificación es obligatorio.');
    }
    if (this.mensaje && this.mensaje.length > 500) {
      throw new Error('El mensaje de la notificación no puede superar los 500 caracteres.');
    }
    if (!this.tipo) {
      throw new Error('El tipo de notificación es obligatorio.');
    }
    if (!this.fecha || isNaN(new Date(this.fecha).getTime())) {
      throw new Error('La fecha de la notificación es obligatoria y debe ser válida.');
    }
  }
}
