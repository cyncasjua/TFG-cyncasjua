import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { User } from '../users/user.entity';
import { Event } from '../events/event.entity';

@Entity()
export class Resena {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, user => user.resenas)
  autor: User;

  @ManyToOne(() => Event)
  evento: Event;

  @Column()
  comentario: string;

  @Column('int')
  puntuacion: number;

  @Column('timestamp')
  fecha: Date;

  crearResena() {}
  editarResena() {}
  eliminarResena() {}
}
