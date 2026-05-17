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
import { Categoria } from '../categorias/categoria.entity';

import { EstadoEnum } from './enums/estado.enum';
import { RecurrenciaEnum } from './enums/recurrencia.enum';
import type { GeoJsonPoint } from '../common/geojson-point';
import { User } from '../users/user.entity';
import { countEventImages, stringifyEventImages } from './event-images.util';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity({ name: 'events' })
export class Event {
  @ApiProperty({ description: 'UUID del evento' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiPropertyOptional({ description: 'Título del evento', maxLength: 100 })
  @Column({ length: 100, nullable: true })
  title!: string | null;

  @ApiProperty({ description: 'Descripción del evento' })
  @Column({ type: 'text', nullable: false })
  description!: string;

  @ApiProperty({ description: 'Dirección del evento', maxLength: 255 })
  @Column({ type: 'varchar', length: 255, nullable: false })
  address!: string;

  @ApiProperty({
    description: 'Ubicación GeoJSON (Point)',
    example: { type: 'Point', coordinates: [-5.9845, 37.3891] },
  })
  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  location!: GeoJsonPoint;

  @ApiPropertyOptional({ description: 'Fecha y hora de inicio' })
  @Column('timestamp', { nullable: true })
  fechaInicio!: Date | null;

  @ApiPropertyOptional({ description: 'Fecha y hora de fin' })
  @Column('timestamp', { nullable: true })
  fechaFin!: Date | null;

  @ApiProperty({ description: 'Si el evento tiene múltiples fechas disponibles' })
  @Column({ type: 'boolean', default: false })
  hasMultipleDatesAvailable!: boolean;

  @ApiPropertyOptional({ description: 'Tipo de recurrencia', enum: RecurrenciaEnum })
  @Column({ type: 'enum', enum: RecurrenciaEnum, nullable: true })
  recurrencia?: RecurrenciaEnum | null;

  @ApiPropertyOptional({ description: 'Fecha de fin de la recurrencia' })
  @Column('timestamp', { nullable: true })
  recurrenciaFin?: Date | null;

  @ApiPropertyOptional({ description: 'Precio fijo de entrada (0 = gratuito)', minimum: 0 })
  @Column('float', { nullable: true })
  precio?: number | null;

  @ApiPropertyOptional({ description: 'Precio mínimo (rango)', minimum: 0 })
  @Column('float', { nullable: true })
  precioMin?: number | null;

  @ApiPropertyOptional({ description: 'Precio máximo (rango)', minimum: 0 })
  @Column('float', { nullable: true })
  precioMax?: number | null;

  @ApiPropertyOptional({ description: 'Si el evento es privado' })
  @Column({ type: 'boolean', nullable: true })
  privado?: boolean | null;

  @ApiPropertyOptional({ description: 'Token de acceso para eventos privados' })
  @Column({ type: 'varchar', length: 255, nullable: true })
  linkAcceso?: string | null;

  @ApiProperty({ description: 'Categoría del evento', type: () => Categoria })
  @ManyToOne(() => Categoria, (categoria) => categoria.eventos)
  categoria!: Categoria;

  @ApiProperty({ description: 'Estado de moderación del evento', enum: EstadoEnum })
  @Column({ type: 'enum', enum: EstadoEnum, default: EstadoEnum.Pendiente })
  estado!: EstadoEnum;

  @ApiProperty({ description: 'Usuario creador del evento', type: () => User })
  @ManyToOne(() => User, (user) => user.eventos, { nullable: false, onDelete: 'CASCADE' })
  creador!: User;

  @ApiPropertyOptional({ description: 'URL de la imagen principal' })
  @Column({ type: 'varchar', length: 512, nullable: true })
  imagen?: string;

  @ApiPropertyOptional({ description: 'URLs de imágenes adicionales (hasta 5)' })
  @Column({ type: 'text', nullable: true })
  imagenes?: string | string[] | null;

  @ApiPropertyOptional({ description: 'Asistentes del evento', type: () => User, isArray: true })
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
    if (this.imagenes) {
      this.imagenes = stringifyEventImages(this.imagenes);
    }

    if (this.fechaFin && this.fechaInicio && this.fechaFin <= this.fechaInicio) {
      throw new BadRequestException('La fecha de fin debe ser posterior a la fecha de inicio.');
    }
    const precio = this.precio != null ? Number(this.precio) : null;
    const precioMin = this.precioMin != null ? Number(this.precioMin) : null;
    const precioMax = this.precioMax != null ? Number(this.precioMax) : null;

    if (precio != null && precio < 0) {
      throw new BadRequestException('El precio no puede ser negativo.');
    }
    if (precioMin != null && precioMin < 0) {
      throw new BadRequestException('El precio mínimo no puede ser negativo.');
    }
    if (precioMax != null && precioMax < 0) {
      throw new BadRequestException('El precio máximo no puede ser negativo.');
    }
    if (precioMin != null && precioMax != null && precioMin >= precioMax) {
      throw new BadRequestException('El precio mínimo debe ser menor que el precio máximo.');
    }
    if (precio != null && (precioMin != null || precioMax != null)) {
      throw new BadRequestException(
        'No puedes especificar un precio fijo junto con un intervalo. Deja vacío el campo de precio fijo si has especificado un intervalo, y viceversa.'
      );
    }
    if (precioMin != null && precioMax == null) {
      throw new BadRequestException(
        'Si especificas un precio mínimo, también debes especificar un precio máximo.'
      );
    }
    if (precioMax != null && precioMin == null) {
      throw new BadRequestException(
        'Si especificas un precio máximo, también debes especificar un precio mínimo.'
      );
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
    if (this.imagenes) {
      const imagenCount = countEventImages(this.imagenes);
      if (imagenCount > 5) {
        throw new BadRequestException('No puedes subir más de 5 imágenes para un evento.');
      }
    }
  }
}
