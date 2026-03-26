import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';

type SocketContextType = {
  socket: Socket | null;
  isConnected: boolean;
  sendMessage: (event: string, data: any) => void;
};

const SocketContext = createContext<SocketContextType | undefined>(undefined);

const INACTIVITY_TIMEOUT = 24 * 60 * 60 * 1000;

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!token || socketRef.current?.connected) return;

    const socket = io(process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000', {
      auth: { token },
      reconnection: true,
    });

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socketRef.current = socket;
    resetInactivityTimeout();
  }, [token]);

  const disconnectDueToInactivity = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  };

  const resetInactivityTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(disconnectDueToInactivity, INACTIVITY_TIMEOUT);
  }, []);

  const sendMessage = useCallback((event: string, data: any) => {
    if (!socketRef.current || !socketRef.current.connected) {
      connect();
    }

    socketRef.current?.emit(event, data);
    resetInactivityTimeout();
  }, [connect, resetInactivityTimeout]);

  useEffect(() => {
    connect();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      socketRef.current?.disconnect();
    };
  }, [connect]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, isConnected, sendMessage }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket debe usarse dentro de SocketProvider');
  }
  return context;
};
