import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, OneToMany, BeforeInsert, BeforeUpdate } from 'typeorm';
import { Categoria } from '../entities/categoria.entity';
import { User } from '../users/user.entity';
import { EstadoEnum } from '../enums/estado.enum';
import { Coordenadas } from '../entities/coordenadas.entity';
import { Imagen } from '../entities/imagen.entity';

interface GeoJsonPoint {
  type: 'Point';
  coordinates: [number, number]; 
}

@Entity({ name: 'events' })
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

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

  @Column('float', { nullable: false })
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

  @BeforeInsert()
  @BeforeUpdate()
  validateDates() {
    if (this.fechaFin && this.fechaInicio && this.fechaFin <= this.fechaInicio) {
      throw new Error('La fecha de fin debe ser posterior a la fecha de inicio.');
    }
    if (this.precio !== undefined && this.precio < 0) {
      throw new Error('El precio no puede ser negativo.');
    }
    if (this.title && (this.title.length < 3 || this.title.length > 100)) {
      throw new Error('El título debe tener entre 3 y 100 caracteres.');
    }
    if (this.description && this.description.length < 10) {
      throw new Error('La descripción debe tener al menos 10 caracteres.');
    }
    if (this.address && this.address.length > 255) {
      throw new Error('La dirección no puede superar los 255 caracteres.');
    }
    if (this.imagen && this.imagen.length > 512) {
      throw new Error('La URL de la imagen no puede superar los 512 caracteres.');
    }
  }

}