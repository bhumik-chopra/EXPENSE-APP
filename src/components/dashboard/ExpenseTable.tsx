import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { GlowCard } from '@/src/components/common/GlowCard';
import { ThemedText } from '@/src/components/common/ThemedText';
import { useAppTheme } from '@/src/theme/ThemeProvider';
import { formatDate } from '@/src/utils/format';
import { Expense } from '@/src/types';

export function ExpenseTable({
  expenses,
  onDelete,
}: {
  expenses: Expense[];
  onDelete: (expenseId: string) => void;
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
          <View style={[styles.iconCircle, { backgroundColor: `${theme.colors.primary}15` }]}>
            <Ionicons name="receipt-outline" size={16} color={theme.colors.primary} />
          </View>
          <View style={styles.copy}>
            <ThemedText variant="subtitle">{expense.category}</ThemedText>
            <ThemedText variant="caption">{formatDate(expense.date)}</ThemedText>
          </View>
          <View style={styles.amount}>
            <ThemedText variant="subtitle">{expense.currency} {expense.amount.toFixed(2)}</ThemedText>
            <Pressable
              onPress={() => onDelete(expense.id)}
              hitSlop={10}
              style={({ pressed }) => (pressed ? styles.deletePressed : null)}>
              <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
            </Pressable>
          </View>
        </Animated.View>
      ))}
    </GlowCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  amount: {
    alignItems: 'flex-end',
    gap: 6,
  },
  deletePressed: {
    opacity: 0.6,
    transform: [{ scale: 0.9 }],
  },
});
