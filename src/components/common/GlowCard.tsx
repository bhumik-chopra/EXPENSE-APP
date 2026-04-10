import { PropsWithChildren } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { useAppTheme } from '@/src/theme/ThemeProvider';

type Props = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

export function GlowCard({ children, style }: Props) {
  const { theme } = useAppTheme();

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(16).stiffness(180)}
      layout={LinearTransition.springify().damping(18).stiffness(160)}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          shadowColor: theme.colors.primary,
        },
        style,
      ]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
    overflow: 'hidden',
    gap: 12,
  },
});
