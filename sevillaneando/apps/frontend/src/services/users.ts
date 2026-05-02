import { api } from './api';
import { PublicUser } from '../types/user';

export async function getUserProfile(userId: string): Promise<PublicUser | null> {
  const res = await api.get(`/users/${userId}`);
  return res.data as PublicUser | null;
}

export async function seguirUsuario(userId: string): Promise<void> {
  await api.post(`/users/${userId}/seguir`);
}

export async function dejarDeSeguirUsuario(userId: string): Promise<void> {
  await api.delete(`/users/${userId}/seguir`);
}

export async function checkSiguiendo(userId: string): Promise<boolean> {
  const res = await api.get(`/users/${userId}/siguiendo`);
  return (res.data as { siguiendo: boolean }).siguiendo;
}

export async function getSeguidos(userId: string): Promise<PublicUser[]> {
  const res = await api.get(`/users/${userId}/seguidos`);
  return res.data as PublicUser[];
}

export async function getSeguidores(userId: string): Promise<PublicUser[]> {
  const res = await api.get(`/users/${userId}/seguidores`);
  return res.data as PublicUser[];
}

export async function searchUsers(query: string): Promise<PublicUser[]> {
  const res = await api.get('/users/search', { params: { q: query } });
  return res.data as PublicUser[];
}
