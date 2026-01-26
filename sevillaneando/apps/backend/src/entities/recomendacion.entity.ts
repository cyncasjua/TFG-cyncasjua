import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinTable, ManyToMany, BeforeInsert, BeforeUpdate } from 'typeorm';
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

  @BeforeInsert()
  @BeforeUpdate()
  validateRecomendacion() {
    if (!this.usuario) {
      throw new Error('El usuario de la recomendación es obligatorio.');
    }
    if (!this.eventosRecomendados || this.eventosRecomendados.length === 0) {
      throw new Error('Debe haber al menos un evento recomendado.');
    }
  }
}
