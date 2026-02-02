export interface Event {
  id: string;
  title: string;
  description: string;
  address: string;
  location: { type: string; coordinates: [number, number] };
  fechaInicio: string;
  fechaFin: string;
  precio: number;
  categoria: { id: string; nombre: string; descripcion: string };
  estado: string;
  creador: { id: string; nombre: string; email: string };
  latitude?: number;
  longitude?: number;
  imagen?: string;
}
