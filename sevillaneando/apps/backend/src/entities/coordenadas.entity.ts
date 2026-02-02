import { Column, BeforeInsert, BeforeUpdate } from 'typeorm';
export class Coordenadas {
  @Column('float', { nullable: false })
  latitud: number;

  @Column('float', { nullable: false })
  longitud: number;

  calcularDistancia(_c1: Coordenadas, _c2: Coordenadas): number {
    // Implementación de cálculo de distancia (Haversine o similar)
    // Placeholder
    return 0;
  }

  @BeforeInsert()
  @BeforeUpdate()
  validateCoordenadas() {
    if (this.latitud === undefined || this.latitud === null) {
      throw new Error('La latitud es obligatoria.');
    }
    if (this.longitud === undefined || this.longitud === null) {
      throw new Error('La longitud es obligatoria.');
    }
    if (this.latitud < -90 || this.latitud > 90) {
      throw new Error('La latitud debe estar entre -90 y 90.');
    }
    if (this.longitud < -180 || this.longitud > 180) {
      throw new Error('La longitud debe estar entre -180 y 180.');
    }
  }
}
