import axios from 'axios';
import type { Event } from '../types/event';

const baseURL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export const api = axios.create({ baseURL });

export function setAuthToken(token: string) {
  if (!token) {
    delete api.defaults.headers.common.Authorization;
  } else {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  }
}

function parsePoint(location?: string | any) {
  if (!location) return null;
  
  if (typeof location === 'object' && location.coordinates) {
    const [lon, lat] = location.coordinates;
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return { latitude: lat, longitude: lon };
    }
  }
  
  if (typeof location === 'string') {
    // Accepts "SRID=4326;POINT(lon lat)" or "POINT(lon lat)"
    const match = location.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
    if (!match) return null;
    const lon = parseFloat(match[1]);
    const lat = parseFloat(match[2]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { latitude: lat, longitude: lon };
  }
  
  return null;
}

export async function getEvents(): Promise<Event[]> {
  const res = await api.get('/events');
  return (res.data as any[]).map((event) => {
    const coords = parsePoint(event.location);
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      address: event.address,
      location: event.location,
      latitude: coords?.latitude ?? event.latitude,
      longitude: coords?.longitude ?? event.longitude
    } satisfies Event;
  });
}
