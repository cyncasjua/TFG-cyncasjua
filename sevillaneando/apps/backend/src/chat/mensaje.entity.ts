import { User } from '../users/user.entity';
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Event } from '../events/event.entity';

@Entity('mensajes')
export class Mensaje {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  contenido!: string;

  @Column({ nullable: true })
  imageUrl?: string | null;

  @ManyToOne(() => User)
  usuario!: User;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  evento!: Event;

  @CreateDateColumn({ type: 'timestamptz' })
  fechaCreacion!: Date;
}
