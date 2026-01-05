import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { User } from '../users/user.entity';
import { TipoEnum } from '../enums/tipo.enum';

@Entity()
export class Notificacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  UserDestino: User;

  @Column()
  mensaje: string;

  @Column({ type: 'enum', enum: TipoEnum })
  tipo: TipoEnum;

  @Column('timestamp')
  fechaEnvio: Date;

  enviarNotificacion() {
    this.fechaEnvio = new Date();
  }
}
