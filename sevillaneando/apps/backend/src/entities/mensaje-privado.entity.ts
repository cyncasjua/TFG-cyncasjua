import { User } from '../users/user.entity';
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

@Entity('mensajes_privados')
export class MensajePrivado {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  contenido!: string;

  @Column({ type: 'text', nullable: true })
  imageUrl?: string | null;

  @ManyToOne(() => User)
  emisor!: User;

  @ManyToOne(() => User)
  receptor!: User;

  @CreateDateColumn({ type: 'timestamptz' })
  fechaCreacion!: Date;

  @Column({ default: false })
  leido!: boolean;
}
