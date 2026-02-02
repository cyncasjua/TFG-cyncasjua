import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { Event } from '../events/event.entity';
import { Length } from 'class-validator';

@Entity()
export class Categoria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Length(3, 50)
  @Column({ unique: true, nullable: false })
  nombre: string;

  @Length(5, 200)
  @Column({ nullable: true })
  descripcion: string;

  @OneToMany(() => Event, (event) => event.categoria)
  eventos: Event[];

  listarEventosPorCategoria(): Event[] {
    return this.eventos;
  }

  @BeforeInsert()
  @BeforeUpdate()
  validateCategoria() {
    if (this.nombre) {
      this.nombre = this.nombre.trim();
      if (this.nombre.length < 3 || this.nombre.length > 50) {
        throw new Error('El nombre debe tener entre 3 y 50 caracteres.');
      }
    } else {
      throw new Error('El nombre es obligatorio.');
    }
    if (this.descripcion) {
      this.descripcion = this.descripcion.trim();
      if (this.descripcion.length < 5 || this.descripcion.length > 200) {
        throw new Error('La descripción debe tener entre 5 y 200 caracteres.');
      }
    } else {
      throw new Error('La descripción es obligatoria.');
    }
  }
}
