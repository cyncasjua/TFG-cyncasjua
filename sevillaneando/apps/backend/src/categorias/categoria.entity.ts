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
import { ApiProperty } from '@nestjs/swagger';

@Entity()
export class Categoria {
  @ApiProperty({ description: 'UUID de la categoría' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ description: 'Nombre único de la categoría', minLength: 3, maxLength: 50 })
  @Length(3, 50)
  @Column({ unique: true, nullable: false })
  nombre!: string;

  @ApiProperty({ description: 'Descripción de la categoría', minLength: 5, maxLength: 200 })
  @Length(5, 200)
  @Column({ nullable: true })
  descripcion!: string;

  @OneToMany(() => Event, (event) => event.categoria)
  eventos!: Event[];

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
