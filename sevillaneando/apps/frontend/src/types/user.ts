
interface GeoJsonPoint {
  type: 'Point';
  coordinates: [number, number]; 
}

export type User = {
  id: string;
  nombre: string;
  email: string;
  contrasena: string | null;
  ubicacion: GeoJsonPoint | null;
  fotoPerfil: string | null;
  intereses: string[];
  rol: 'admin' | 'moderator' | 'user';
  firebaseUid: string;
};
