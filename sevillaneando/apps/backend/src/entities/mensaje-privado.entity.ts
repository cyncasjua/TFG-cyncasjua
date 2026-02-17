import { User } from 'src/users/user.entity';
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

@Entity('mensajes_privados')
export class MensajePrivado {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  contenido: string;

  @ManyToOne(() => User)
  emisor: User;

  @ManyToOne(() => User)
  receptor: User;

  @CreateDateColumn()
  fechaCreacion: Date;
}
