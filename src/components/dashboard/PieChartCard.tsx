import { StyleSheet, View } from 'react-native';

import { ExpensePieChart } from '@/src/components/charts/ExpensePieChart';
import { GlowCard } from '@/src/components/common/GlowCard';
import { ThemedText } from '@/src/components/common/ThemedText';
import { AnalyticsSummary } from '@/src/types';

export function PieChartCard({ analytics }: { analytics: AnalyticsSummary | null }) {
  return (
    <GlowCard style={styles.compact}>
      <ThemedText variant="subtitle" style={styles.title}>
        By Category
      </ThemedText>
      <View style={styles.chartWrap}>
        <ExpensePieChart data={analytics?.categoryBreakdown ?? []} />
      </View>
      {(analytics?.categoryBreakdown ?? [])
        .slice(0, 2)
        .map((entry) => (
          <View key={entry.label} style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: entry.color }]} />
            <ThemedText style={styles.label}>{entry.label}</ThemedText>
            <ThemedText variant="caption">${entry.value.toFixed(0)}</ThemedText>
          </View>
        ))}
    </GlowCard>
  );
}

const styles = StyleSheet.create({
  compact: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  title: {
    marginBottom: 8,
    fontSize: 15,
  },
  chartWrap: {
    alignItems: 'center',
    marginVertical: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    flex: 1,
    fontSize: 13,
  },
});
