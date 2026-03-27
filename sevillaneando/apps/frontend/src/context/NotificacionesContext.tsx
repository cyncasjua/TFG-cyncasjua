import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';

const NotificacionesContext = createContext({ unread: 0, refresh: () => {} });

export const NotificacionesProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  const fetchUnread = useCallback(async () => {
    if (!user) return setUnread(0);
    try {
      const res = await api.get(`/notificaciones/usuario/${user.id}`);
      setUnread(res.data.filter((n: { leida: boolean }) => !n.leida).length);
    } catch {
      setUnread(0);
    }
  }, [user]);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [user, fetchUnread]);

  return (
    <NotificacionesContext.Provider value={{ unread, refresh: fetchUnread }}>
      {children}
    </NotificacionesContext.Provider>
  );
};

export const useNotificaciones = () => useContext(NotificacionesContext);
