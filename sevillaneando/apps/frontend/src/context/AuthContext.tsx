import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User, getIdTokenResult } from 'firebase/auth';
import { auth } from '../firebase/config';
import { api, setAuthToken } from '../services/api';

export type UserRole = 'admin' | 'moderator' | 'user';

type AuthContextValue = {
  user: User | null;
  role: UserRole;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>('user');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (current) => {
      setUser(current);
      if (current) {
        const tokenResult = await getIdTokenResult(current, true);
        const token = tokenResult.token;
        setAuthToken(token);

        // Obtener rol desde la BD
        try {
          const res = await api.get<any>('/users/me');
          const userRole = (res.data?.rol as UserRole | undefined) ?? 'user';
          setRole(userRole);
        } catch (err) {
          console.warn('No se pudo obtener rol desde BD, usando default:', err);
          setRole('user');
        }
      } else {
        setAuthToken('');
        setRole('user');
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = useMemo(
    () => ({
      user,
      role,
      loading,
      login: async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);
      },
      logout: async () => {
        await signOut(auth);
      }
    }),
    [user, role, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext debe usarse dentro de AuthProvider');
  return ctx;
}
