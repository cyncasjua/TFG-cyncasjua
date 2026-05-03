import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Event } from './event.entity';
import { MaxLength } from 'class-validator';

@Entity()
export class Resena {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, (user) => user.resenas)
  autor!: User;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  evento!: Event;

  @MaxLength(500)
  @Column({ nullable: false })
  comentario!: string;

  @Column('int', { nullable: false })
  puntuacion!: number;

  @Column('timestamp', { nullable: false })
  fecha!: Date;

  crearResena() {}
  editarResena() {}
  eliminarResena() {}

  @BeforeInsert()
  @BeforeUpdate()
  validateResena() {
    if (!this.autor) {
      throw new Error('El autor de la reseña es obligatorio.');
    }
    if (!this.evento) {
      throw new Error('El evento de la reseña es obligatorio.');
    }
    if (this.comentario && this.comentario.length > 500) {
      throw new Error('El comentario no puede superar 500 caracteres.');
    }
    if (
      this.puntuacion === undefined ||
      this.puntuacion === null ||
      this.puntuacion < 1 ||
      this.puntuacion > 5
    ) {
      throw new Error('La puntuación debe estar entre 1 y 5.');
    }
    if (!this.fecha || isNaN(new Date(this.fecha).getTime())) {
      throw new Error('La fecha de la reseña es obligatoria y debe ser válida.');
    }
  }
}
