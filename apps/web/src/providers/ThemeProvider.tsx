// apps/web/src/providers/ThemeProvider.tsx
// Keep the chosen lavender theme consistent across routes and reloads.

'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

interface ThemeProviderProps {
  children: React.ReactNode;
}

interface ThemeProviderState {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

const ThemeProviderContext = createContext<ThemeProviderState>({ theme: 'light', setTheme: () => {} });

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<'light' | 'dark'>('light');

  const setTheme = useCallback((next: 'light' | 'dark') => {
    setThemeState(next);
    window.localStorage.setItem('aether-theme', next);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem('aether-theme');
    if (saved === 'dark' || saved === 'light') setThemeState(saved);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeProviderContext);
