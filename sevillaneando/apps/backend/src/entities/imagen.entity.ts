import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Event } from '../events/event.entity';
import { User } from '../users/user.entity';

@Entity()
export class Imagen {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  uri: string;

  @ManyToOne(() => Event, event => event.id)
  evento: Event;

  @ManyToOne(() => User, user => user.id)
  usuario: User;

  @Column('timestamp')
  subida: Date;

  @Column({ default: false })
  moderada: boolean;

  subirImagen() {
    this.subida = new Date();
  }

  analizarContenido() {
    // Lógica de análisis de contenido
  }

  eliminarImagen() {
    // Lógica de eliminación
  }
}
