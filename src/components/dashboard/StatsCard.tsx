import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useAppTheme } from '@/src/theme/ThemeProvider';
import { ThemedText } from '@/src/components/common/ThemedText';

type Props = {
  label: string;
  value: string;
  tone: 'primary' | 'positive' | 'danger' | 'warning';
};

export function StatsCard({ label, value, tone }: Props) {
  const { theme } = useAppTheme();

  const gradientColors: readonly [string, string] =
    tone === 'primary'
      ? [theme.colors.primary, theme.colors.accent]
      : tone === 'positive'
        ? ['#10b981', '#059669']
        : tone === 'danger'
          ? ['#ef4444', '#dc2626']
          : ['#f59e0b', '#d97706'];

  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}>
      <View style={styles.content}>
        <ThemedText variant="caption" color="rgba(255,255,255,0.8)">
          {label}
        </ThemedText>
        <ThemedText variant="subtitle" color="#ffffff" style={styles.value}>
          {value}
        </ThemedText>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 20,
    justifyContent: 'flex-end',
    minHeight: 120,
  },
  content: {
    gap: 8,
  },
  value: {
    fontSize: 22,
  },
});
