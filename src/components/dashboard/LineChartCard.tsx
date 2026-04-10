import { StyleSheet, View } from 'react-native';

import { ExpenseLineChart } from '@/src/components/charts/ExpenseLineChart';
import { GlowCard } from '@/src/components/common/GlowCard';
import { ThemedText } from '@/src/components/common/ThemedText';
import { AnalyticsSummary } from '@/src/types';

export function LineChartCard({ analytics }: { analytics: AnalyticsSummary | null }) {
  return (
    <GlowCard style={styles.compact}>
      <ThemedText variant="subtitle" style={styles.title}>
        Trend
      </ThemedText>
      <View style={styles.chartWrap}>
        <ExpenseLineChart data={analytics?.spendingTrend ?? []} />
      </View>
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
  },
});
