import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Event } from './event.entity';
import { User } from '../users/user.entity';
import { GeoJsonPoint } from '../common/geojson-point';

@Entity({ name: 'event_edit_requests' })
export class EventEditRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Event, (event) => event.id, { nullable: false, onDelete: 'CASCADE' })
  event!: Event;

  @ManyToOne(() => User, (user) => user.id, { nullable: false })
  requestedBy!: User;

  @Column({ length: 100, nullable: true })
  title!: string | null;

  @Column({ type: 'text', nullable: false })
  description!: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  address!: string;

  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  location!: GeoJsonPoint;

  @Column('timestamp', { nullable: false })
  fechaInicio!: Date;

  @Column('timestamp', { nullable: false })
  fechaFin!: Date;

  @Column('float', { nullable: true })
  precio?: number | null;

  @Column('float', { nullable: true })
  precioMin?: number | null;

  @Column('float', { nullable: true })
  precioMax?: number | null;

  @Column({ type: 'boolean', nullable: true })
  privado?: boolean | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  linkAcceso?: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  imagen?: string;

  @Column('simple-array', { nullable: true })
  imagenes?: string[];

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: 'enum', enum: ['pendiente', 'aprobada', 'rechazada'], default: 'pendiente' })
  status!: 'pendiente' | 'aprobada' | 'rechazada';

  @Column({ type: 'text', nullable: true })
  motivoRechazo?: string;
}
