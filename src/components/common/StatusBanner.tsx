import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/src/theme/ThemeProvider';

import { ThemedText } from './ThemedText';

type Props = {
  message: string;
  tone?: 'error' | 'success' | 'warning';
};

export function StatusBanner({ message, tone = 'error' }: Props) {
  const { theme } = useAppTheme();
  const color =
    tone === 'success' ? theme.colors.positive : tone === 'warning' ? theme.colors.warning : theme.colors.danger;

  return (
    <View style={[styles.container, { borderColor: color, backgroundColor: `${color}15` }]}>
      <ThemedText variant="caption" color={color}>
        {message}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
