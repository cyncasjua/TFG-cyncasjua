import type { GeoJsonPoint } from './geojson';

export type User = {
  id: string;
  nombre: string;
  email: string;
  contrasena: string | null;
  ubicacion: GeoJsonPoint | null;
  fotoPerfil: string | null;
  intereses: string[];
  categoryOrder?: string[];
  radiusOptions?: number[];
  rol: 'admin' | 'moderator' | 'user';
  firebaseUid: string;
};
