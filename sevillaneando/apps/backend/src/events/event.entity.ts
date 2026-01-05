import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, OneToMany } from 'typeorm';
import { Categoria } from '../entities/categoria.entity';
import { User } from '../users/user.entity';
import { EstadoEnum } from '../enums/estado.enum';
import { Coordenadas } from '../entities/coordenadas.entity';
import { Imagen } from '../entities/imagen.entity';

interface GeoJsonPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

@Entity({ name: 'events' })
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'varchar', length: 255 })
  address!: string;

  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  location!: GeoJsonPoint;

  @Column('timestamp')
  fechaInicio!: Date;

  @Column('timestamp')
  fechaFin!: Date;

  @Column('float')
  precio!: number;

  @ManyToOne(() => Categoria, categoria => categoria.eventos)
  categoria!: Categoria;

  @Column({ type: 'enum', enum: EstadoEnum, default: EstadoEnum.Pendiente })
  estado!: EstadoEnum;

  /*@Column(type => Coordenadas)
  ubicacion!: Coordenadas;*/

  @ManyToOne(() => User, user => user.eventos)
  creador!: User;

  /*@OneToMany(() => Imagen, imagen => imagen.evento)
  imagenes!: Imagen[];*/

  @Column({ type: 'varchar', length: 512, nullable: true })
  imagen?: string;

  aprobarEvento() {
    this.estado = EstadoEnum.Aprobado;
  }

  rechazarEvento() {
    this.estado = EstadoEnum.Rechazado;
  }

  obtenerUbicacion() {
    return this.location;
  }
}