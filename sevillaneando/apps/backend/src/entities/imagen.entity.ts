import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, BeforeInsert, BeforeUpdate } from 'typeorm';
import { Event } from '../events/event.entity';
import { User } from '../users/user.entity';

@Entity()
export class Imagen {
  
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  uri: string;

  @ManyToOne(() => Event, event => event.id)
  evento: Event;

  @ManyToOne(() => User, user => user.id)
  usuario: User;

  @Column('timestamp', { nullable: false })
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

  @BeforeInsert()
  @BeforeUpdate()
  validateImagen() {
    if (!this.uri || this.uri.trim().length === 0) {
      throw new Error('La URI de la imagen es obligatoria.');
    }
    if (this.uri && this.uri.length > 512) {
      throw new Error('La URI de la imagen no puede superar los 512 caracteres.');
    }
    if (!this.subida || isNaN(new Date(this.subida).getTime())) {
      throw new Error('La fecha de subida es obligatoria y debe ser válida.');
    }
  }
}
