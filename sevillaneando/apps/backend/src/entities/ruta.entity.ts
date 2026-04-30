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

@Entity({ name: 'rutas' })
export class Ruta {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 150, nullable: false })
  titulo!: string;

  @Column({ type: 'text', nullable: true })
  descripcion?: string;

  @Column('simple-json')
  trayecto!: GeoJsonPoint[];

  @ManyToMany(() => Event)
  @JoinTable({
    name: 'ruta_eventos',
    joinColumn: { name: 'ruta_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'event_id', referencedColumnName: 'id' },
  })
  secuenciaEventos!: Event[];

  @Column('int')
  temporizacion!: number;

  @ManyToOne(() => User, (user) => user.rutas, { nullable: false })
  creador!: User;

  @CreateDateColumn()
  fechaCreacion!: Date;

  @Column({ type: 'float', default: 0 })
  puntuacionPromedio!: number;

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
