import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '@/src/theme/ThemeProvider';
import { ThemedText } from '@/src/components/common/ThemedText';

type Props = {
  label: string;
  value: string;
  tone: 'primary' | 'positive' | 'danger' | 'warning';
  hint?: string;
  onPress?: () => void;
};

export function StatsCard({ label, value, tone, hint, onPress }: Props) {
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
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.shell, pressed ? styles.pressed : null]}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}>
        <View style={styles.glowOrb} />
        <View style={styles.header}>
          <ThemedText variant="caption" color="rgba(255,255,255,0.8)">
            {label}
          </ThemedText>
          {onPress ? <Ionicons name="arrow-forward-circle" size={20} color="rgba(255,255,255,0.9)" /> : null}
        </View>
        <View style={styles.content}>
          <ThemedText variant="subtitle" color="#ffffff" style={styles.value}>
            {value}
          </ThemedText>
          {hint ? (
            <ThemedText variant="caption" color="rgba(255,255,255,0.78)">
              {hint}
            </ThemedText>
          ) : null}
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.95,
  },
  card: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 20,
    justifyContent: 'flex-end',
    minHeight: 120,
    overflow: 'hidden',
  },
  glowOrb: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    top: -18,
    right: -10,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  content: {
    gap: 8,
    marginTop: 18,
  },
  value: {
    fontSize: 22,
  },
});
