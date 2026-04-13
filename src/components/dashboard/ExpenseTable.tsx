import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { GlowCard } from '@/src/components/common/GlowCard';
import { ThemedText } from '@/src/components/common/ThemedText';
import { useAppTheme } from '@/src/theme/ThemeProvider';
import { currency, currencyLabel, formatDate } from '@/src/utils/format';
import { Expense } from '@/src/types';

export function ExpenseTable({
  expenses,
}: {
  expenses: Expense[];
}) {
  const { theme } = useAppTheme();

  return (
    <GlowCard>
      {expenses.slice(0, 5).map((expense, index) => (
        <Animated.View
          key={expense.id}
          entering={FadeInDown.delay(index * 40).springify().damping(16).stiffness(180)}
          layout={LinearTransition.springify().damping(18).stiffness(160)}
          style={[styles.row, { borderBottomColor: theme.colors.border }]}>
          <View style={styles.grid}>
            <View style={styles.field}>
              <ThemedText variant="caption">Category</ThemedText>
              <ThemedText variant="subtitle">{expense.category}</ThemedText>
            </View>
            <View style={styles.field}>
              <ThemedText variant="caption">Currency</ThemedText>
              <ThemedText variant="subtitle">{currencyLabel(expense.currency)}</ThemedText>
            </View>
            <View style={styles.field}>
              <ThemedText variant="caption">Amount</ThemedText>
              <ThemedText variant="subtitle">{currency(expense.amount)}</ThemedText>
            </View>
            <View style={styles.field}>
              <ThemedText variant="caption">Date</ThemedText>
              <ThemedText variant="subtitle">{formatDate(expense.date)}</ThemedText>
            </View>
          </View>
        </Animated.View>
      ))}
    </GlowCard>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  field: {
    minWidth: '47%',
    gap: 2,
  },
});
