export type User = {
  id: string;
  nombre: string;
  email: string;
  contrasena: string | null;
  ubicacion: string | null;
  fotoPerfil: string | null;
  intereses: string[];
  rol: 'admin' | 'moderator' | 'user';
  firebaseUid: string;
};
