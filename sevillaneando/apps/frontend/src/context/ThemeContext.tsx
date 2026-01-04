import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Theme = 'light' | 'dark';

interface Colors {
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  primary: string;
  border: string;
  error: string;
  success: string;
}

interface ThemeContextType {
  theme: Theme;
  colors: Colors;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const lightColors: Colors = {
  background: '#FFFFFF',
  card: '#F5F5F5',
  text: '#000000',
  textSecondary: '#666666',
  primary: '#007AFF',
  border: '#E5E5E5',
  error: '#FF3B30',
  success: '#34C759'
};

const darkColors: Colors = {
  background: '#000000',
  card: '#1C1C1E',
  text: '#FFFFFF',
  textSecondary: '#999999',
  primary: '#0A84FF',
  border: '#38383A',
  error: '#FF453A',
  success: '#32D74B'
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>('light');

  // Cargar preferencia guardada
  useEffect(() => {
    const loadPreference = async () => {
      try {
        const stored = await AsyncStorage.getItem('themePreference');
        if (stored === 'light' || stored === 'dark') {
          setThemeState(stored);
        }
      } catch (err) {
        console.warn('No se pudo leer la preferencia de tema', err);
      }
    };
    loadPreference();
  }, []);

  const colors = theme === 'dark' ? darkColors : lightColors;

  const persistPreference = async (value: Theme) => {
    setThemeState(value);
    try {
      await AsyncStorage.setItem('themePreference', value);
    } catch (err) {
      console.warn('No se pudo guardar la preferencia de tema', err);
    }
  };

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    persistPreference(next);
  };

  const setTheme = (newTheme: Theme) => {
    persistPreference(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, colors, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within ThemeProvider');
  }
  return context;
};
