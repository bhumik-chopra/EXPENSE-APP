import { PropsWithChildren } from 'react';
import { ImageBackground, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { useAppTheme } from '@/src/theme/ThemeProvider';

const appBackgroundImage = require('@/assets/images/image.png');

export function AppBackground({ children }: PropsWithChildren) {
  const { theme } = useAppTheme();
  const isDark = theme.mode === 'dark';

  return (
    <ImageBackground source={appBackgroundImage} resizeMode="cover" style={styles.container} imageStyle={styles.image}>
      <LinearGradient
        colors={
          isDark
            ? ['rgba(8, 8, 12, 0.9)', 'rgba(12, 12, 18, 0.92)', 'rgba(18, 14, 26, 0.94)']
            : ['rgba(255, 255, 255, 0.58)', 'rgba(255, 255, 255, 0.66)', 'rgba(255, 255, 255, 0.74)']
        }
        style={styles.container}>
        <BlurView intensity={isDark ? 18 : 6} tint={isDark ? 'dark' : 'light'} style={styles.overlay}>
          {children}
        </BlurView>
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  image: {
    opacity: 1,
  },
  overlay: {
    flex: 1,
  },
});
