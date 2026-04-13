import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { useAppTheme } from '@/src/theme/ThemeProvider';

export function ThemeToggle() {
  const { theme, toggleTheme } = useAppTheme();

  return (
    <Pressable
      onPress={toggleTheme}
      style={[
        styles.button,
        {
          backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.92)',
          borderColor: theme.colors.border,
        },
      ]}>
      <Ionicons
        name={theme.mode === 'dark' ? 'sunny-outline' : 'moon-outline'}
        size={18}
        color={theme.colors.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
