import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GlowCard } from '@/src/components/common/GlowCard';
import { FormField } from '@/src/components/common/FormField';
import { PrimaryButton } from '@/src/components/common/PrimaryButton';
import { Screen } from '@/src/components/common/Screen';
import { SectionHeader } from '@/src/components/common/SectionHeader';
import { StatusBanner } from '@/src/components/common/StatusBanner';
import { ThemedText } from '@/src/components/common/ThemedText';
import { useExpenseData } from '@/src/providers/DataProvider';
import { currency, currencyLabel, formatDate, monthLabel, toMonthInputValue } from '@/src/utils/format';

export function ReportsScreen() {
  const { expenses, loading, error, refreshAll } = useExpenseData();
  const [selectedMonth, setSelectedMonth] = useState(toMonthInputValue(new Date()));
  const [message, setMessage] = useState('');

  const filteredExpenses = useMemo(
    () => expenses.filter((expense) => expense.date.slice(0, 7) === selectedMonth),
    [expenses, selectedMonth],
  );

  const totalAmount = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  const exportCsv = async () => {
    const csv = ['Date,Category,Amount,Currency']
      .concat(filteredExpenses.map((expense) => `${expense.date},${expense.category},${expense.amount},${currencyLabel(expense.currency)}`))
      .join('\n');
    const uri = `${FileSystem.cacheDirectory}expense-report-${selectedMonth}.csv`;
    await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(uri);
    setMessage('CSV export ready through the native share flow.');
  };

  const exportPdf = async () => {
    const html = `
      <html><body>
      <h1>Expense Tracker Report</h1>
      <h2>${selectedMonth}</h2>
      <p>Total expenses: ${filteredExpenses.length}</p>
      <p>Total amount: ${currency(totalAmount)}</p>
      <table border="1" cellspacing="0" cellpadding="8">
      <tr><th>Date</th><th>Category</th><th>Amount</th></tr>
      ${filteredExpenses.map((expense) => `<tr><td>${expense.date}</td><td>${expense.category}</td><td>${currency(expense.amount)} (${currencyLabel(expense.currency)})</td></tr>`).join('')}
      </table>
      </body></html>
    `;
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri);
    setMessage('PDF export ready through the native share flow.');
  };

  return (
    <Screen refreshing={loading} onRefresh={() => refreshAll()}>
      <SectionHeader title="Reports" actionLabel="Refresh" onActionPress={() => refreshAll()} />
      {error ? <StatusBanner message={error} /> : null}
      {message ? <StatusBanner message={message} tone="success" /> : null}
      <GlowCard>
        <FormField label="Selected Month" value={selectedMonth} onChangeText={setSelectedMonth} placeholder="YYYY-MM" />
        <View style={styles.statsRow}>
          <ThemedText>Total expenses: {filteredExpenses.length}</ThemedText>
          <ThemedText>Total amount: {currency(totalAmount)}</ThemedText>
          <ThemedText>Selected period: {monthLabel(new Date(`${selectedMonth}-01`))}</ThemedText>
        </View>
        <PrimaryButton label="Export CSV" onPress={exportCsv} />
        <PrimaryButton label="Export PDF" onPress={exportPdf} />
      </GlowCard>
      <GlowCard>
        <ThemedText variant="subtitle">Monthly expense list</ThemedText>
        {filteredExpenses.map((expense) => (
          <View key={expense.id} style={styles.expenseRow}>
            <View style={styles.expenseGrid}>
              <View style={styles.field}>
                <ThemedText variant="caption">Category</ThemedText>
                <ThemedText>{expense.category}</ThemedText>
              </View>
              <View style={styles.field}>
                <ThemedText variant="caption">Currency</ThemedText>
                <ThemedText>{currencyLabel(expense.currency)}</ThemedText>
              </View>
              <View style={styles.field}>
                <ThemedText variant="caption">Amount</ThemedText>
                <ThemedText>{currency(expense.amount)}</ThemedText>
              </View>
              <View style={styles.field}>
                <ThemedText variant="caption">Date</ThemedText>
                <ThemedText>{formatDate(expense.date)}</ThemedText>
              </View>
            </View>
          </View>
        ))}
      </GlowCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    gap: 8,
  },
  expenseRow: {
    paddingVertical: 10,
  },
  expenseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  field: {
    minWidth: '47%',
    gap: 2,
  },
});
