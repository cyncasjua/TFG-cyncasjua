import { api } from './api';
import { PublicUser } from '../types/user';

export async function getUserProfile(userId: string): Promise<PublicUser | null> {
  const res = await api.get(`/users/${userId}`);
  return res.data as PublicUser | null;
}
