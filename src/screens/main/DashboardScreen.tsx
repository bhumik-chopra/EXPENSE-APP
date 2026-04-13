import Animated, { FadeInDown } from 'react-native-reanimated';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { BudgetProgressCard } from '@/src/components/dashboard/BudgetProgressCard';
import { ExpenseTable } from '@/src/components/dashboard/ExpenseTable';
import { UploadCard } from '@/src/components/dashboard/UploadCard';
import { StatsCard } from '@/src/components/dashboard/StatsCard';
import { EmptyState } from '@/src/components/common/EmptyState';
import { LoadingView } from '@/src/components/common/LoadingView';
import { Screen } from '@/src/components/common/Screen';
import { StatusBanner } from '@/src/components/common/StatusBanner';
import { ThemedText } from '@/src/components/common/ThemedText';
import { useExpenseData } from '@/src/providers/DataProvider';
import { useAppAuth } from '@/src/providers/AuthProvider';
import { useAppTheme } from '@/src/theme/ThemeProvider';
import { currency } from '@/src/utils/format';

export function DashboardScreen({ navigation }: any) {
  const { expenses, analytics, budget, loading, error, refreshAll } = useExpenseData();
  const { user } = useAppAuth();
  const { theme } = useAppTheme();
  const today = new Date().toISOString().slice(0, 10);
  const todaySpend = expenses
    .filter((expense) => String(expense.date).slice(0, 10) === today)
    .reduce((total, expense) => total + Number(expense.amount || 0), 0);
  const greetingName = user?.fullName?.split(' ')[0] || 'there';
  const quickActions = [
    { label: 'Scan receipt', icon: 'scan-outline', screen: 'Upload Receipt' },
    { label: 'View charts', icon: 'stats-chart-outline', screen: 'Charts' },
    { label: 'Export reports', icon: 'document-text-outline', screen: 'Reports' },
  ] as const;

  return (
    <Screen refreshing={loading} onRefresh={() => refreshAll()}>
      {error ? <StatusBanner message={error} /> : null}
      {loading && !analytics ? <LoadingView label="Refreshing dashboard..." /> : null}

      {/* Header Section */}
      <Animated.View entering={FadeInDown.springify()} style={styles.headerSection}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerCopy}>
            <ThemedText variant="caption" style={{ color: theme.colors.primary }}>
              Daily money pulse
            </ThemedText>
            <ThemedText variant="title">Hi, {greetingName}</ThemedText>
            <ThemedText style={{ color: theme.colors.textSecondary }}>
              Track spending, scan faster, and jump into the next action.
            </ThemedText>
          </View>
          <Pressable
            onPress={() => refreshAll()}
            style={({ pressed }) => [
              styles.refreshBadge,
              {
                backgroundColor: theme.mode === 'dark' ? 'rgba(139, 92, 246, 0.18)' : 'rgba(37, 99, 235, 0.1)',
                borderColor: theme.colors.border,
              },
              pressed ? styles.refreshPressed : null,
            ]}>
            <Ionicons name="sparkles-outline" size={18} color={theme.colors.primary} />
          </Pressable>
        </View>
        <LinearGradient
          colors={
            theme.mode === 'dark'
              ? ['rgba(139, 92, 246, 0.24)', 'rgba(236, 72, 153, 0.18)']
              : ['rgba(37, 99, 235, 0.14)', 'rgba(96, 165, 250, 0.18)']
          }
          style={[styles.spotlightCard, { borderColor: theme.colors.border }]}>
          <View style={styles.spotlightMetric}>
            <ThemedText variant="caption">Spent today</ThemedText>
            <ThemedText variant="title" style={styles.spotlightValue}>
              {currency(todaySpend)}
            </ThemedText>
          </View>
          <View style={styles.spotlightStatRow}>
            <View style={styles.inlineStat}>
              <Ionicons name="receipt-outline" size={16} color={theme.colors.primary} />
              <ThemedText variant="caption">{expenses.length} tracked</ThemedText>
            </View>
            <View style={styles.inlineStat}>
              <Ionicons name="pulse-outline" size={16} color={theme.colors.primary} />
              <ThemedText variant="caption">{analytics?.totalExpenses ?? expenses.length} entries</ThemedText>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(20).springify()}>
        <View style={styles.quickActionRow}>
          {quickActions.map((action, index) => (
            <Pressable
              key={action.label}
              onPress={() => navigation.navigate(action.screen)}
              style={({ pressed }) => [
                styles.quickAction,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
                pressed ? styles.quickActionPressed : null,
                index === quickActions.length - 1 ? styles.quickActionLast : null,
              ]}>
              <View
                style={[
                  styles.quickActionIcon,
                  {
                    backgroundColor: theme.mode === 'dark' ? 'rgba(139, 92, 246, 0.16)' : 'rgba(37, 99, 235, 0.1)',
                  },
                ]}>
                <Ionicons name={action.icon} size={18} color={theme.colors.primary} />
              </View>
              <ThemedText variant="caption" style={styles.quickActionLabel}>
                {action.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </Animated.View>

      {/* Quick Stats */}
      <Animated.View entering={FadeInDown.delay(30).springify()} style={styles.statsGrid}>
        <StatsCard
          label="Total Spent"
          value={currency(analytics?.totalSpent ?? 0)}
          tone="primary"
          hint="Open charts"
          onPress={() => navigation.navigate('Charts')}
        />
        <StatsCard
          label="Remaining"
          value={currency(budget?.remaining ?? 0)}
          tone={budget && budget.remaining >= 0 ? 'positive' : 'danger'}
          hint="Open reports"
          onPress={() => navigation.navigate('Reports')}
        />
      </Animated.View>

      {/* Upload Card */}
      <Animated.View entering={FadeInDown.delay(60).springify()}>
        <UploadCard onPress={() => navigation.navigate('Upload Receipt')} />
      </Animated.View>

      {/* Budget Card */}
      <Animated.View entering={FadeInDown.delay(100).springify()}>
        <BudgetProgressCard budget={budget} />
      </Animated.View>

      {/* Recent Expenses */}
      <Animated.View entering={FadeInDown.delay(150).springify()}>
        {expenses.length ? (
          <View>
            <ThemedText variant="subtitle" style={styles.sectionTitle}>Recent Expenses</ThemedText>
            <ExpenseTable expenses={expenses} />
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
    gap: 14,
  },
  headerTopRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  refreshBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  refreshPressed: {
    transform: [{ scale: 0.96 }],
  },
  spotlightCard: {
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    gap: 14,
  },
  spotlightMetric: {
    gap: 4,
  },
  spotlightValue: {
    fontSize: 30,
    lineHeight: 36,
  },
  spotlightStatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  inlineStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  quickAction: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 10,
  },
  quickActionPressed: {
    transform: [{ scale: 0.98 }],
  },
  quickActionLast: {
    marginRight: 0,
  },
  quickActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
});
