import { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { useAppTheme } from '@/src/theme/ThemeProvider';

export function AppBackground({ children }: PropsWithChildren) {
  const { theme } = useAppTheme();
  const isDark = theme.mode === 'dark';

  return (
    <LinearGradient
      colors={
        isDark
          ? ['#050509', '#0b0b0f', '#17131f']
          : ['#f8fbff', '#eff6ff', '#dbeafe']
      }
      style={styles.container}>
      <View
        style={[
          styles.glow,
          {
            backgroundColor: theme.colors.glow,
            top: -40,
            right: -20,
          },
        ]}
      />
      <View
        style={[
          styles.glow,
          {
            backgroundColor: isDark ? 'rgba(236, 72, 153, 0.12)' : 'rgba(96, 165, 250, 0.16)',
            bottom: 100,
            left: -30,
          },
        ]}
      />
      <BlurView intensity={isDark ? 25 : 18} tint={isDark ? 'dark' : 'light'} style={styles.overlay}>
        {children}
      </BlurView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
  glow: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
  },
});
