import { Column, Entity, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Notificacion } from '../entities/notificacion.entity';
import { Event } from '../events/event.entity';
import { Resena } from '../entities/resena.entity';

export enum RolEnum {
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  USER = 'user'
}

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  nombre!: string;

  @Column({ type: 'varchar', length: 180, unique: true })
  email!: string;

  @Column({ type: 'text', nullable: true })
  contrasena!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  ubicacion!: string | null;

  @Column({ type: 'text', nullable: true })
  fotoPerfil!: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  intereses!: string[];

  @Column({ type: 'enum', enum: RolEnum, default: RolEnum.USER })
  rol!: RolEnum;

  @Column({ type: 'varchar', length: 128, unique: true })
  firebaseUid!: string;


  @OneToMany(() => Event, event => event.creador)
  eventos!: Event[];

  @OneToMany(() => Notificacion, noti => noti.usuario)
  notificaciones!: Notificacion[];

  @OneToMany(() => Resena, resena => resena.autor)
  resenas!: Resena[];

  iniciarSesion() {}
  cerrarSesion() {}
  verEventos() {}
  subirFoto() {}
  editarPerfil() {}
  añadirEvento() {}
  añadirReseña() {}
}
