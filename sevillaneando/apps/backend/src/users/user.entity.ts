import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  OneToMany,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { Notificacion } from '../entities/notificacion.entity';
import { Event } from '../events/event.entity';
import { Resena } from '../entities/resena.entity';
import type { GeoJsonPoint } from '../common/geojson-point';

export enum RolEnum {
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  USER = 'user',
}

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120, nullable: false })
  nombre!: string;

  @Column({ type: 'varchar', length: 180, unique: true, nullable: false })
  email!: string;

  @Column({ type: 'text', nullable: true })
  contrasena!: string | null;

  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326, nullable: true })
  ubicacion!: GeoJsonPoint | null;

  @Column({ type: 'text', nullable: true })
  fotoPerfil!: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  intereses!: string[];

  @Column({ type: 'enum', enum: RolEnum, default: RolEnum.USER })
  rol!: RolEnum;

  @Column({ type: 'varchar', length: 128, unique: true })
  firebaseUid!: string;

  @OneToMany(() => Event, (event) => event.creador)
  eventos!: Event[];

  @OneToMany(() => Notificacion, (noti) => noti.usuario)
  notificaciones!: Notificacion[];

  @OneToMany(() => Resena, (resena) => resena.autor)
  resenas!: Resena[];

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
        console.error('Validación de ubicación falló:', {
          type: loc.type,
          isArray: Array.isArray(loc.coordinates),
          length: loc.coordinates?.length,
          coord0Type: typeof loc.coordinates?.[0],
          coord1Type: typeof loc.coordinates?.[1],
        });
        throw new Error('La ubicación debe ser un GeoJsonPoint válido.');
      }
    }
    if (this.fotoPerfil && this.fotoPerfil.length > 512) {
      throw new Error('La URL de la foto de perfil no puede superar los 512 caracteres.');
    }
  }
}
