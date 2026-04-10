import { palette } from './palette';

export const createTheme = (mode: 'light' | 'dark') => {
  const colors = palette[mode];

  return {
    mode,
    colors,
    spacing: {
      xs: 6,
      sm: 10,
      md: 16,
      lg: 20,
      xl: 28,
    },
    radius: {
      sm: 14,
      md: 20,
      lg: 26,
      pill: 999,
    },
  };
};

export type AppTheme = ReturnType<typeof createTheme>;
