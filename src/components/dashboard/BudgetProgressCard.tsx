import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { GlowCard } from '@/src/components/common/GlowCard';
import { ThemedText } from '@/src/components/common/ThemedText';
import { useAppTheme } from '@/src/theme/ThemeProvider';
import { Budget } from '@/src/types';
import { currency } from '@/src/utils/format';

export function BudgetProgressCard({ budget }: { budget: Budget | null }) {
  const { theme } = useAppTheme();
  const utilization = budget?.utilization ?? 0;
  const isOverBudget = utilization > 100;

  const fillColor =
    utilization >= 90
      ? theme.colors.danger
      : utilization >= 70
        ? theme.colors.warning
        : theme.colors.positive;

  return (
    <GlowCard>
      <View style={styles.header}>
        <ThemedText variant="subtitle">Budget</ThemedText>
        <ThemedText variant="badge" color={fillColor}>
          {Math.min(utilization, 100)}%
        </ThemedText>
      </View>

      <Animated.View entering={FadeInDown} style={[styles.track, { backgroundColor: theme.colors.border }]}>
        <Animated.View
          style={[
            styles.fill,
            {
              width: `${Math.min(utilization, 100)}%`,
              backgroundColor: fillColor,
            },
          ]}
        />
      </Animated.View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <ThemedText variant="caption">Spent</ThemedText>
          <ThemedText variant="subtitle">{currency(budget?.spent ?? 0)}</ThemedText>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <ThemedText variant="caption">Budget</ThemedText>
          <ThemedText variant="subtitle">{currency(budget?.monthlyBudget ?? 0)}</ThemedText>
        </View>
        <View style={styles.divider} />
        <View style={[styles.stat, { alignItems: 'flex-end' }]}>
          <ThemedText variant="caption">Remaining</ThemedText>
          <ThemedText
            variant="subtitle"
            color={budget && budget.remaining >= 0 ? theme.colors.positive : theme.colors.danger}>
            {currency(Math.abs(budget?.remaining ?? 0))}
          </ThemedText>
        </View>
      </View>

      {isOverBudget && (
        <View style={[styles.warning, { backgroundColor: `${theme.colors.danger}15`, borderColor: theme.colors.danger }]}>
          <ThemedText variant="caption" color={theme.colors.danger}>
            Over budget by {currency((budget?.spent ?? 0) - (budget?.monthlyBudget ?? 0))}
          </ThemedText>
        </View>
      )}
    </GlowCard>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  track: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 16,
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stat: {
    flex: 1,
    gap: 4,
  },
  divider: {
    width: 1,
    height: 32,
    opacity: 0.2,
  },
  warning: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 12,
  },
});
