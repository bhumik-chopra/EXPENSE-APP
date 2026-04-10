import Animated, { FadeInDown } from 'react-native-reanimated';
import { StyleSheet, View } from 'react-native';

import { BudgetProgressCard } from '@/src/components/dashboard/BudgetProgressCard';
import { ExpenseTable } from '@/src/components/dashboard/ExpenseTable';
import { LineChartCard } from '@/src/components/dashboard/LineChartCard';
import { PieChartCard } from '@/src/components/dashboard/PieChartCard';
import { UploadCard } from '@/src/components/dashboard/UploadCard';
import { StatsCard } from '@/src/components/dashboard/StatsCard';
import { EmptyState } from '@/src/components/common/EmptyState';
import { LoadingView } from '@/src/components/common/LoadingView';
import { Screen } from '@/src/components/common/Screen';
import { StatusBanner } from '@/src/components/common/StatusBanner';
import { ThemedText } from '@/src/components/common/ThemedText';
import { useExpenseData } from '@/src/providers/DataProvider';
import { useAppTheme } from '@/src/theme/ThemeProvider';
import { currency } from '@/src/utils/format';

export function DashboardScreen({ navigation }: any) {
  const { expenses, analytics, budget, loading, error, refreshAll, removeExpense } = useExpenseData();
  const { theme } = useAppTheme();

  return (
    <Screen refreshing={loading} onRefresh={() => refreshAll()}>
      {error ? <StatusBanner message={error} /> : null}
      {loading && !analytics ? <LoadingView label="Refreshing dashboard..." /> : null}

      {/* Header Section */}
      <Animated.View entering={FadeInDown.springify()} style={styles.headerSection}>
        <ThemedText variant="title">Dashboard</ThemedText>
        <ThemedText style={{ color: theme.colors.textSecondary }}>Track your spending</ThemedText>
      </Animated.View>

      {/* Quick Stats */}
      <Animated.View entering={FadeInDown.delay(30).springify()} style={styles.statsGrid}>
        <StatsCard
          label="Total Spent"
          value={currency(analytics?.totalSpent ?? 0)}
          tone="primary"
        />
        <StatsCard
          label="Remaining"
          value={currency(budget?.remaining ?? 0)}
          tone={budget && budget.remaining >= 0 ? 'positive' : 'danger'}
        />
      </Animated.View>

      {/* Upload Card */}
      <Animated.View entering={FadeInDown.delay(60).springify()}>
        <UploadCard onPress={() => navigation.navigate('Upload Receipt')} />
      </Animated.View>

      {/* Charts Section */}
      <Animated.View entering={FadeInDown.delay(100).springify()}>
        <View style={styles.chartsContainer}>
          <Animated.View style={{ flex: 1 }} entering={FadeInDown.delay(120).springify()}>
            <PieChartCard analytics={analytics} />
          </Animated.View>
          <Animated.View style={{ flex: 1 }} entering={FadeInDown.delay(150).springify()}>
            <LineChartCard analytics={analytics} />
          </Animated.View>
        </View>
      </Animated.View>

      {/* Budget Card */}
      <Animated.View entering={FadeInDown.delay(200).springify()}>
        <BudgetProgressCard budget={budget} />
      </Animated.View>

      {/* Recent Expenses */}
      <Animated.View entering={FadeInDown.delay(250).springify()}>
        {expenses.length ? (
          <View>
            <ThemedText variant="subtitle" style={styles.sectionTitle}>Recent Expenses</ThemedText>
            <ExpenseTable expenses={expenses} onDelete={(id) => removeExpense(id)} />
          </View>
        ) : (
          <EmptyState title="No Expenses Yet" body="Start by uploading a receipt or adding an expense manually to see them here." />
        )}
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerSection: {
    marginBottom: 24,
    gap: 4,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  chartsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
});
