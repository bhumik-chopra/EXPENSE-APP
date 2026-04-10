import { Appearance } from 'react-native';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ThemeMode } from '@/src/types';
import { storage, storageKeys } from '@/src/utils/storage';

import { AppTheme, createTheme } from './theme';

type ThemeContextValue = {
  colorScheme: ThemeMode;
  theme: AppTheme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function AppThemeProvider({ children }: PropsWithChildren) {
  const [colorScheme, setColorScheme] = useState<ThemeMode>('light');

  useEffect(() => {
    let mounted = true;

    storage.get<ThemeMode>(storageKeys.themeMode).then((savedMode) => {
      if (!mounted) return;

      const systemMode = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
      setColorScheme(savedMode ?? systemMode);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const toggleTheme = useCallback(async () => {
    const nextMode = colorScheme === 'dark' ? 'light' : 'dark';
    setColorScheme(nextMode);
    await storage.set(storageKeys.themeMode, nextMode);
  }, [colorScheme]);

  const value = useMemo(
    () => ({
      colorScheme,
      theme: createTheme(colorScheme),
      toggleTheme,
    }),
    [colorScheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useAppTheme must be used within AppThemeProvider');
  }

  return context;
}
