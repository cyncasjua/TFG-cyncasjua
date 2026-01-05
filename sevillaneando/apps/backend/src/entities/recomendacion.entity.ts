import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinTable, ManyToMany } from 'typeorm';
import { User } from '../users/user.entity';
import { Event } from '../events/event.entity';

@Entity()
export class Recomendacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  usuario: User;

  @ManyToMany(() => Event)
  @JoinTable()
  eventosRecomendados: Event[]; 

  @Column('simple-array', { nullable: true })
  criterios: string[];

  @Column('boolean', { default: false })
  vista: boolean;

  generarRecomendaciones() {}
  actualizarRecomendaciones() {}
}
