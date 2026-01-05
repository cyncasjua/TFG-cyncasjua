import { Entity, PrimaryGeneratedColumn, Column, ManyToMany,JoinTable } from 'typeorm';
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
}
