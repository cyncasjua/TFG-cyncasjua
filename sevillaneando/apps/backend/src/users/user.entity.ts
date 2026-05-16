import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  OneToMany,
  BeforeInsert,
  BeforeUpdate,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Notificacion } from '../notificaciones/notificacion.entity';
import { Event } from '../events/event.entity';
import { Resena } from '../events/resena.entity';
import { Ruta } from '../rutas/ruta.entity';
import type { GeoJsonPoint } from '../common/geojson-point';
import { RolEnum } from './enums/rol.enum';
import { Logger } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity({ name: 'users' })
export class User {
  private static readonly logger = new Logger(User.name);

  @ApiProperty({ description: 'UUID del usuario' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ description: 'Nombre del usuario', maxLength: 120 })
  @Column({ type: 'varchar', length: 120, nullable: false })
  nombre!: string;

  @ApiProperty({ description: 'Email del usuario', maxLength: 180 })
  @Column({ type: 'varchar', length: 180, unique: true, nullable: false })
  email!: string;

  @Column({ type: 'text', nullable: true })
  contrasena!: string | null;

  @ApiPropertyOptional({ description: 'Ubicación GeoJSON del usuario' })
  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326, nullable: true })
  ubicacion!: GeoJsonPoint | null;

  @ApiPropertyOptional({ description: 'URL de la foto de perfil' })
  @Column({ type: 'text', nullable: true })
  fotoPerfil!: string | null;

  @Column({ nullable: true })
  fotoPerfilPublicId!: string | null;

  @Column({ nullable: true })
  privacyAcceptedAt!: Date | null;

  @ApiProperty({ description: 'Categorías de interés del usuario', type: [String] })
  @Column({ type: 'text', array: true, default: '{}' })
  intereses!: string[];

  @ApiProperty({ description: 'Orden preferido de categorías', type: [String] })
  @Column({ type: 'text', array: true, default: '{}' })
  categoryOrder!: string[];

  @ApiProperty({ description: 'Radios de búsqueda personalizados (km)', type: [Number] })
  @Column({ type: 'double precision', array: true, default: '{}' })
  radiusOptions!: number[];

  @ApiProperty({ description: 'Rol del usuario', enum: RolEnum })
  @Column({ type: 'enum', enum: RolEnum, default: RolEnum.USER })
  rol!: RolEnum;

  @Column({ type: 'varchar', length: 128, unique: true })
  firebaseUid!: string;

  @OneToMany(() => Event, (event) => event.creador)
  @ApiPropertyOptional({
    description: 'Eventos creados por el usuario',
    type: () => Event,
    isArray: true,
  })
  eventos!: Event[];

  @OneToMany(() => Ruta, (ruta) => ruta.creador)
  rutas!: Ruta[];

  @OneToMany(() => Notificacion, (noti) => noti.usuario)
  notificaciones!: Notificacion[];

  @OneToMany(() => Resena, (resena) => resena.autor)
  resenas!: Resena[];

  @ManyToMany(() => Event, (event) => event.asistentes)
  @ApiPropertyOptional({
    description: 'Eventos a los que asiste el usuario',
    type: () => Event,
    isArray: true,
  })
  eventosAsistidos!: Event[];

  @ManyToMany(() => Event)
  @JoinTable({
    name: 'user_saved_events',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'event_id', referencedColumnName: 'id' },
  })
  @ApiPropertyOptional({
    description: 'Eventos guardados por el usuario',
    type: () => Event,
    isArray: true,
  })
  eventosGuardados!: Event[];

  @ManyToMany(() => Event)
  @JoinTable({
    name: 'user_shared_events',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'event_id', referencedColumnName: 'id' },
  })
  @ApiPropertyOptional({
    description: 'Eventos compartidos por el usuario',
    type: () => Event,
    isArray: true,
  })
  eventosCompartidos!: Event[];

  @ManyToMany(() => Event)
  @JoinTable({
    name: 'user_visited_events',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'event_id', referencedColumnName: 'id' },
  })
  @ApiPropertyOptional({
    description: 'Eventos visitados por el usuario',
    type: () => Event,
    isArray: true,
  })
  eventosVisitados!: Event[];

  @ManyToMany(() => User, (user) => user.seguidores)
  @JoinTable({
    name: 'user_seguidores',
    joinColumn: { name: 'seguidor_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'seguido_id', referencedColumnName: 'id' },
  })
  @ApiPropertyOptional({ description: 'Usuarios seguidos', type: () => User, isArray: true })
  seguidos!: User[];

  @ManyToMany(() => User, (user) => user.seguidos)
  @ApiPropertyOptional({ description: 'Usuarios seguidores', type: () => User, isArray: true })
  seguidores!: User[];

  iniciarSesion() {}
  cerrarSesion() {}
  verEventos() {}
  subirFoto() {}
  editarPerfil() {}
  añadirEvento() {}
  añadirReseña() {}

  @BeforeInsert()
  @BeforeUpdate()
  validateUser() {
    if (!this.nombre || this.nombre.trim().length === 0) {
      throw new Error('El nombre es obligatorio.');
    }
    if (this.nombre.length < 2 || this.nombre.length > 120) {
      throw new Error('El nombre debe tener entre 2 y 120 caracteres.');
    }
    if (!this.email || this.email.trim().length === 0) {
      throw new Error('El email es obligatorio.');
    }
    if (!/^\S+@\S+\.\S+$/.test(this.email)) {
      throw new Error('El email no es válido.');
    }
    if (!this.firebaseUid || this.firebaseUid.length === 0) {
      throw new Error('El UID de Firebase es obligatorio.');
    }
    if (this.firebaseUid.length > 128) {
      throw new Error('El UID de Firebase no puede superar los 128 caracteres.');
    }
    if (this.ubicacion) {
      const loc = typeof this.ubicacion === 'string' ? JSON.parse(this.ubicacion) : this.ubicacion;

      if (Object.keys(loc).length === 0) {
        this.ubicacion = null;
        return;
      }

      if (
        loc.type !== 'Point' ||
        !Array.isArray(loc.coordinates) ||
        loc.coordinates.length !== 2 ||
        typeof loc.coordinates[0] !== 'number' ||
        typeof loc.coordinates[1] !== 'number'
      ) {
        User.logger.error(
          `Validación de ubicación falló: ${JSON.stringify({
            type: loc.type,
            isArray: Array.isArray(loc.coordinates),
            length: loc.coordinates?.length,
            coord0Type: typeof loc.coordinates?.[0],
            coord1Type: typeof loc.coordinates?.[1],
          })}`
        );
        throw new Error('La ubicación debe ser un GeoJsonPoint válido.');
      }
    }
    if (this.fotoPerfil && this.fotoPerfil.length > 512) {
      throw new Error('La URL de la foto de perfil no puede superar los 512 caracteres.');
    }
  }
}
