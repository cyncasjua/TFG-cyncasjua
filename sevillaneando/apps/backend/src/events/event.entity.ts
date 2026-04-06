import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  BeforeInsert,
  BeforeUpdate,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { Categoria } from '../entities/categoria.entity';


import { EstadoEnum } from '../enums/estado.enum';
import type { GeoJsonPoint } from '../common/geojson-point';
import { User } from '../users/user.entity';

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

  @Column('timestamp', { nullable: true })
  fechaInicio!: Date | null;

  @Column('timestamp', { nullable: true })
  fechaFin!: Date | null;

  @Column({ type: 'boolean', default: false })
  hasMultipleDatesAvailable!: boolean;

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

  @ManyToOne(() => Categoria, (categoria) => categoria.eventos)
  categoria!: Categoria;

  @Column({ type: 'enum', enum: EstadoEnum, default: EstadoEnum.Pendiente })
  estado!: EstadoEnum;

  /*@Column(type => Coordenadas)
  ubicacion!: Coordenadas;*/

  @ManyToOne(() => User, (user) => user.eventos)
  creador!: User;

  /*@OneToMany(() => Imagen, imagen => imagen.evento)
  imagenes!: Imagen[];*/

  @Column({ type: 'varchar', length: 512, nullable: true })
  imagen?: string;

  @Column('simple-array', { nullable: true })
  imagenes?: string[];

  @ManyToMany(() => User, (user) => user.eventosAsistidos)
  @JoinTable({
    name: 'event_asistentes',
    joinColumn: { name: 'event_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'user_id', referencedColumnName: 'id' },
  })
  asistentes!: User[];

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
      throw new BadRequestException('La fecha de fin debe ser posterior a la fecha de inicio.');
    }
    if (this.precio != null && this.precio < 0) {
      throw new BadRequestException('El precio no puede ser negativo.');
    }
    if (this.precioMin != null && this.precioMin < 0) {
      throw new BadRequestException('El precio mínimo no puede ser negativo.');
    }
    if (this.precioMax != null && this.precioMax < 0) {
      throw new BadRequestException('El precio máximo no puede ser negativo.');
    }
    if (this.precioMin != null && this.precioMax != null && this.precioMin >= this.precioMax) {
      throw new BadRequestException('El precio mínimo debe ser menor que el precio máximo.');
    }
    if (this.precio != null && (this.precioMin != null || this.precioMax != null)) {
      throw new BadRequestException('No puedes especificar un precio fijo junto con un intervalo. Deja vacío el campo de precio fijo si has especificado un intervalo, y viceversa.');
    }
    if (this.precioMin != null && this.precioMax == null) {
      throw new BadRequestException('Si especificas un precio mínimo, también debes especificar un precio máximo.');
    }
    if (this.precioMax != null && this.precioMin == null) {
      throw new BadRequestException('Si especificas un precio máximo, también debes especificar un precio mínimo.');
    }
    if (this.title && (this.title.length < 3 || this.title.length > 100)) {
      throw new BadRequestException('El título debe tener entre 3 y 100 caracteres.');
    }
    if (this.description && this.description.length < 10) {
      throw new BadRequestException('La descripción debe tener al menos 10 caracteres.');
    }
    if (this.address && this.address.length > 255) {
      throw new BadRequestException('La dirección no puede superar los 255 caracteres.');
    }
    if (this.imagen && this.imagen.length > 512) {
      throw new BadRequestException('La URL de la imagen no puede superar los 512 caracteres.');
    }
    if (this.imagenes && this.imagenes.length > 5) {
      throw new BadRequestException('No puedes subir más de 5 imágenes para un evento.');
    }
  }
}
