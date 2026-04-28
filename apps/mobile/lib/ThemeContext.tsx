import React, { createContext, ReactNode, useContext, useState } from 'react';
import { useColorScheme } from 'react-native';
import { darkTheme, lightTheme, Theme } from './theme';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// ThemeProvider component to wrap the app and provide theme context, wrapped at the root level in app/_layout.tsx
export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme(); // Auto-detect system preference
  const [mode, setMode] = useState<ThemeMode>('system');
  
  // Determine which theme to use
  const getActiveTheme = (): Theme => {
    if (mode === 'system') {
      return systemColorScheme === 'dark' ? darkTheme : lightTheme;
    }
    return mode === 'dark' ? darkTheme : lightTheme;
  };
  
  const currentTheme = getActiveTheme();
  const isDark = mode === 'dark' || (mode === 'system' && systemColorScheme === 'dark');

  return (
    <ThemeContext.Provider value={{ theme: currentTheme, mode, setMode, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}