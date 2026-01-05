import { Column } from 'typeorm';

export class Coordenadas {
  @Column('float')
  latitud: number;

  @Column('float')
  longitud: number;

  calcularDistancia(c1: Coordenadas, c2: Coordenadas): number {
    // Implementación de cálculo de distancia (Haversine o similar)
    // Placeholder
    return 0;
  }
}
