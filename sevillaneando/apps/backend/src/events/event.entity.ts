import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, OneToMany } from 'typeorm';
import { Categoria } from '../entities/categoria.entity';
import { User } from '../users/user.entity';
import { EstadoEnum } from '../enums/estado.enum';
import { Coordenadas } from '../entities/coordenadas.entity';
import { Imagen } from '../entities/imagen.entity';

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

  // Uso de tipo geography para PostGIS (lat, lon)
  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  location!: object;

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

  @OneToMany(() => Imagen, imagen => imagen.evento)
  imagenes!: Imagen[];

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