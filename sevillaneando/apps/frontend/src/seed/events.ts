import { Event } from '../types/event';

export const events: Event[] = [
  {
    id: '1',
    title: 'Feria de Abril',
    description: 'Celebra la tradición sevillana con casetas, música y gastronomía local.',
    latitude: 37.3772,
    longitude: -6.0014,
    address: 'Recinto Ferial, Sevilla',
    location: { type: 'Point', coordinates: [37.3772, -6.0014] },
    fechaInicio: '2026-04-10T18:00:00',
    fechaFin: '2026-04-17T23:59:00',
    precio: 0,
    categoria: { id: 'cat1', nombre: 'Fiestas', descripcion: 'Eventos festivos y celebraciones' },
    estado: 'Pendiente',
    creador: { id: 'user1', nombre: 'Usuario de Prueba', email: 'prueba@correo.com' }
  },
  {
    id: '2',
    title: 'Concierto en la Plaza de España',
    description: 'Música al aire libre con artistas locales e internacionales.',
    latitude: 37.3775,
    longitude: -5.9869,
    address: 'Plaza de España, Sevilla',
    location: { type: 'Point', coordinates: [37.3775, -5.9869] },
    fechaInicio: '2026-05-01T20:00:00',
    fechaFin: '2026-05-01T23:00:00',
    precio: 15,
    categoria: { id: 'cat1', nombre: 'Fiestas', descripcion: 'Eventos festivos y celebraciones' },
    estado: 'Pendiente',
    creador: { id: 'user1', nombre: 'Usuario de Prueba', email: 'prueba@correo.com' }
  },
  {
    id: '3',
    title: 'Ruta gastronómica por Triana',
    description: 'Tapas y flamenco en uno de los barrios más emblemáticos de Sevilla.',
    latitude: 37.3822,
    longitude: -6.0077,
    address: 'Barrio de Triana, Sevilla',
    location: { type: 'Point', coordinates: [37.3822, -6.0077] },
    fechaInicio: '2026-06-05T12:00:00',
    fechaFin: '2026-06-05T18:00:00',
    precio: 25,
    categoria: { id: 'cat1', nombre: 'Fiestas', descripcion: 'Eventos festivos y celebraciones' },
    estado: 'Pendiente',
    creador: { id: 'user1', nombre: 'Usuario de Prueba', email: 'prueba@correo.com' }
  }
];