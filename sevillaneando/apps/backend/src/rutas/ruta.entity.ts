import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
  BeforeInsert,
  BeforeUpdate,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { Event } from '../events/event.entity';
import { User } from '../users/user.entity';
import { GeoJsonPoint } from '../common/geojson-point';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity({ name: 'rutas' })
export class Ruta {
  @ApiProperty({ description: 'UUID de la ruta' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ description: 'Título de la ruta', maxLength: 150 })
  @Column({ type: 'varchar', length: 150, nullable: false })
  titulo!: string;

  @ApiPropertyOptional({ description: 'Descripción de la ruta' })
  @Column({ type: 'text', nullable: true })
  descripcion?: string;

  @ApiProperty({ description: 'Array de puntos GeoJSON que forman el trayecto' })
  @Column('simple-json')
  trayecto!: GeoJsonPoint[];

  @ApiProperty({ description: 'Secuencia de eventos que componen la ruta', type: () => Event, isArray: true })
  @ManyToMany(() => Event)
  @JoinTable({
    name: 'ruta_eventos',
    joinColumn: { name: 'ruta_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'event_id', referencedColumnName: 'id' },
  })
  secuenciaEventos!: Event[];

  @ApiProperty({ description: 'Tiempo estimado total de la ruta en minutos' })
  @Column('int')
  temporizacion!: number;

  @ApiProperty({ description: 'Usuario creador de la ruta', type: () => User })
  @ManyToOne(() => User, (user) => user.rutas, { nullable: false, onDelete: 'CASCADE' })
  creador!: User;

  @ApiProperty({ description: 'Fecha de creación de la ruta' })
  @CreateDateColumn()
  fechaCreacion!: Date;

  @ApiProperty({ description: 'Puntuación media de la ruta (0-5)', minimum: 0, maximum: 5 })
  @Column({ type: 'float', default: 0 })
  puntuacionPromedio!: number;

  @ApiProperty({ description: 'Número de calificaciones recibidas' })
  @Column({ type: 'int', default: 0 })
  numCalificaciones!: number;

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
    if (!this.titulo || this.titulo.trim().length === 0) {
      throw new Error('El título de la ruta es obligatorio.');
    }
  }
}
