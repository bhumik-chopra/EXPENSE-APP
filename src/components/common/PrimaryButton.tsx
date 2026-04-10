import { ActivityIndicator, Pressable, PressableProps, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useAppTheme } from '@/src/theme/ThemeProvider';

type Props = Omit<PressableProps, 'style'> & {
  label: string;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({ label, loading, style, disabled, ...props }: Props) {
  const { theme } = useAppTheme();

  return (
    <Pressable
      disabled={disabled || loading}
      style={({ pressed }) => [
        style,
        styles.pressable,
        pressed && !disabled && !loading ? styles.pressed : null,
      ]}
      {...props}>
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.button, disabled ? styles.disabled : null]}>
        {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.text}>{label}</Text>}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: 12,
  },
  pressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.88,
  },
  button: {
    minHeight: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  text: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
});
