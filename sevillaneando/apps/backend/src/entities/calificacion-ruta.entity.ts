import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Unique,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Ruta } from './ruta.entity';

@Entity('calificacion_ruta')
@Unique(['usuario', 'ruta'])
export class CalificacionRuta {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  usuario!: User;

  @ManyToOne(() => Ruta, { eager: true, onDelete: 'CASCADE' })
  ruta!: Ruta;

  @Column('int', { nullable: false })
  puntuacion!: number;

  @CreateDateColumn()
  fechaCreacion!: Date;

  @UpdateDateColumn()
  fechaActualizacion!: Date;
}
