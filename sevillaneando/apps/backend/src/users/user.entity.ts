import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

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
}
