import { Pressable, PressableProps, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';

import { useAppTheme } from '@/src/theme/ThemeProvider';

type Props = Omit<PressableProps, 'style'> & {
  label: string;
  style?: StyleProp<ViewStyle>;
};

export function SecondaryButton({ label, style, ...props }: Props) {
  const { theme } = useAppTheme();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: theme.mode === 'dark' ? 'rgba(139, 92, 246, 0.12)' : 'rgba(37, 99, 235, 0.08)',
          borderColor: theme.colors.border,
        },
        style,
        pressed ? styles.pressed : null,
      ]}
      {...props}>
      <Text style={[styles.text, { color: theme.colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.85,
  },
});
