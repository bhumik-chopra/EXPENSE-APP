import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/src/theme/ThemeProvider';

type Props = {
  name: string;
  size?: number;
};

export function AvatarBadge({ name, size = 44 }: Props) {
  const { theme } = useAppTheme();
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.mode === 'dark' ? 'rgba(168, 85, 247, 0.18)' : 'rgba(37, 99, 235, 0.14)',
          borderColor: theme.colors.border,
        },
      ]}>
      <Text style={[styles.text, { color: theme.colors.text }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  text: {
    fontWeight: '800',
    fontSize: 16,
  },
});
