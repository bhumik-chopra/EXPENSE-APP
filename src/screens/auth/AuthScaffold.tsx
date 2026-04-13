import { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { GlowCard } from '@/src/components/common/GlowCard';
import { Screen } from '@/src/components/common/Screen';
import { ThemedText } from '@/src/components/common/ThemedText';
import { useAppTheme } from '@/src/theme/ThemeProvider';

export function AuthScaffold({
  title,
  subtitle,
  children,
}: PropsWithChildren<{ title: string; subtitle: string }>) {
  const { theme } = useAppTheme();
  const badges = [
    { label: 'Fast sign in', icon: 'flash-outline' },
    { label: 'Email verify', icon: 'mail-open-outline' },
    { label: 'Smart tracking', icon: 'sparkles-outline' },
  ] as const;

  return (
    <Screen>
      <Animated.View entering={FadeInDown.springify().damping(16)} style={styles.hero}>
        <View style={styles.heroTopRow}>
          <LinearGradient colors={[theme.colors.primary, theme.colors.accent]} style={styles.logo}>
            <ThemedText variant="subtitle" color="#ffffff">
              ET
            </ThemedText>
          </LinearGradient>
          <View
            style={[
              styles.heroMiniCard,
              {
                backgroundColor: theme.mode === 'dark' ? 'rgba(20, 18, 30, 0.72)' : 'rgba(255,255,255,0.84)',
                borderColor: theme.colors.border,
              },
            ]}>
            <ThemedText variant="caption">Welcome to Smart Spending</ThemedText>
            <ThemedText variant="subtitle">Secure by design</ThemedText>
          </View>
        </View>
        <ThemedText variant="badge">Expense Tracker</ThemedText>
        <ThemedText variant="title">{title}</ThemedText>
        <ThemedText>{subtitle}</ThemedText>
        <View style={styles.badgeRow}>
          {badges.map((badge) => (
            <View
              key={badge.label}
              style={[
                styles.featureBadge,
                {
                  backgroundColor: theme.mode === 'dark' ? 'rgba(139, 92, 246, 0.14)' : 'rgba(37, 99, 235, 0.08)',
                  borderColor: theme.colors.border,
                },
              ]}>
              <Ionicons name={badge.icon} size={14} color={theme.colors.primary} />
              <ThemedText variant="caption" style={styles.featureBadgeText}>
                {badge.label}
              </ThemedText>
            </View>
          ))}
        </View>
      </Animated.View>
      <GlowCard style={styles.card}>{children}</GlowCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: 10,
    paddingTop: 24,
    paddingBottom: 8,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMiniCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  featureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  featureBadgeText: {
    fontSize: 12,
  },
  card: {
    paddingTop: 22,
  },
});
