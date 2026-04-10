import { GlowCard } from '@/src/components/common/GlowCard';
import { Screen } from '@/src/components/common/Screen';
import { SectionHeader } from '@/src/components/common/SectionHeader';
import { StatusBanner } from '@/src/components/common/StatusBanner';
import { ThemedText } from '@/src/components/common/ThemedText';
import { ExpenseLineChart } from '@/src/components/charts/ExpenseLineChart';
import { ExpensePieChart } from '@/src/components/charts/ExpensePieChart';
import { useExpenseData } from '@/src/providers/DataProvider';

export function ChartsScreen() {
  const { analytics, loading, error, refreshAll } = useExpenseData();

  return (
    <Screen refreshing={loading} onRefresh={() => refreshAll()}>
      <SectionHeader title="Charts" actionLabel="Refresh" onActionPress={() => refreshAll()} />
      {error ? <StatusBanner message={error} /> : null}
      <GlowCard>
        <ThemedText variant="subtitle">Category spend distribution</ThemedText>
        <ExpensePieChart data={analytics?.categoryBreakdown ?? []} />
      </GlowCard>
      <GlowCard>
        <ThemedText variant="subtitle">Spending trend</ThemedText>
        <ExpenseLineChart data={analytics?.spendingTrend ?? []} />
      </GlowCard>
    </Screen>
  );
}
