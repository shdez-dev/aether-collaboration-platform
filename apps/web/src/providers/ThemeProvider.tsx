// apps/web/src/providers/ThemeProvider.tsx
// Simplified: dark-only. Light mode removed — future custom themes will extend this.

'use client';

import { createContext, useContext, useEffect } from 'react';

interface ThemeProviderProps {
  children: React.ReactNode;
}

interface ThemeProviderState {
  theme: 'dark';
}

const ThemeProviderContext = createContext<ThemeProviderState>({ theme: 'dark' });

export function ThemeProvider({ children }: ThemeProviderProps) {
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light');
    root.classList.add('dark');
    // Clear any stale theme value from localStorage
    localStorage.removeItem('aether-theme');
  }, []);

  return (
    <ThemeProviderContext.Provider value={{ theme: 'dark' }}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeProviderContext);
