import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, getIdTokenResult } from 'firebase/auth';
import { auth } from '../firebase/config';
import { api, setAuthToken } from '../services/api';
import type { User as AppUser } from '../types/user'; 

export type UserRole = 'admin' | 'moderator' | 'user';

type AuthContextValue = {
  user: AppUser | null;
  setUser: (user: AppUser | null) => void;
  role: UserRole;
  loading: boolean;
  token: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [role, setRole] = useState<UserRole>('user');
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string>('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (current) => {
      if (current) {
        const tokenResult = await getIdTokenResult(current, true);
        setAuthToken(tokenResult.token);
        setToken(tokenResult.token);

        try {
          const res = await api.get<AppUser>('/users/me');
          setUser(res.data);
          setRole(res.data.rol ?? 'user');
        } catch (err) {
          setUser(null);
          setRole('user');
        }
      } else {
        setUser(null);
        setAuthToken('');
        setToken('');
        setRole('user');
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = useMemo(
    () => ({
      user,
      setUser,
      role,
      loading,
      token,
      login: async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);
      },
      logout: async () => {
        await signOut(auth);
      }
    }),
    [user, role, loading, token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext debe usarse dentro de AuthProvider');
  return ctx;
}