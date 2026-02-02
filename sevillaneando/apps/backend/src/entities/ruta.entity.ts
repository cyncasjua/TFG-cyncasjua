import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { Coordenadas } from './coordenadas.entity';
import { Event } from '../events/event.entity';

@Entity()
export class Ruta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('simple-json')
  trayecto: Coordenadas[];

  @ManyToMany(() => Event)
  @JoinTable()
  secuenciaEventos: Event[];

  @Column('int')
  temporizacion: number;

  @BeforeInsert()
  @BeforeUpdate()
  validateRuta() {
    if (!this.trayecto || !Array.isArray(this.trayecto) || this.trayecto.length === 0) {
      throw new Error('El trayecto de la ruta es obligatorio y debe contener al menos un punto.');
    }
    if (
      !this.secuenciaEventos ||
      !Array.isArray(this.secuenciaEventos) ||
      this.secuenciaEventos.length === 0
    ) {
      throw new Error('Debe haber al menos un evento en la secuencia de la ruta.');
    }
    if (
      this.temporizacion === undefined ||
      this.temporizacion === null ||
      this.temporizacion <= 0
    ) {
      throw new Error('La temporización debe ser un número positivo.');
    }
  }
}
