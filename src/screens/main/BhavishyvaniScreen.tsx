import { StyleSheet, View } from 'react-native';

import { GlowCard } from '@/src/components/common/GlowCard';
import { Screen } from '@/src/components/common/Screen';
import { SectionHeader } from '@/src/components/common/SectionHeader';
import { StatusBanner } from '@/src/components/common/StatusBanner';
import { ThemedText } from '@/src/components/common/ThemedText';
import { useExpenseData } from '@/src/providers/DataProvider';
import { useAppTheme } from '@/src/theme/ThemeProvider';
import { currency } from '@/src/utils/format';

export function BhavishyvaniScreen() {
  const { predictions, loading, error, refreshAll } = useExpenseData();
  const { theme } = useAppTheme();

  const riskColor =
    predictions?.risk === 'overspending'
      ? theme.colors.danger
      : predictions?.risk === 'warning'
        ? theme.colors.warning
        : theme.colors.positive;

  return (
    <Screen refreshing={loading} onRefresh={() => refreshAll()}>
      <SectionHeader title="BHAVISHYVANI" actionLabel="Refresh" onActionPress={() => refreshAll()} />
      {error ? <StatusBanner message={error} /> : null}
      <GlowCard style={{ backgroundColor: theme.colors.surfaceTint }}>
        <ThemedText variant="badge">Prediction Logic</ThemedText>
        <ThemedText variant="title">Month-end forecast</ThemedText>
        <ThemedText variant="subtitle">{currency(predictions?.predictedMonthEndSpend ?? 0)}</ThemedText>
        <View style={[styles.riskPill, { backgroundColor: `${riskColor}20`, borderColor: riskColor }]}>
          <ThemedText variant="badge" color={riskColor}>
            {predictions?.riskLabel ?? 'On Track'}
          </ThemedText>
        </View>
      </GlowCard>
      <GlowCard>
        <ThemedText variant="subtitle">Prediction details</ThemedText>
        <ThemedText>Predicted next 7 days spend: {currency(predictions?.predictedNext7DaysSpend ?? 0)}</ThemedText>
        <ThemedText>Predicted top category: {predictions?.predictedTopCategory ?? 'Other'}</ThemedText>
        <ThemedText>Budget: {currency(predictions?.budget ?? 0)}</ThemedText>
        <ThemedText>Current spend context: {currency(predictions?.currentSpend ?? 0)}</ThemedText>
      </GlowCard>
      <GlowCard>
        <ThemedText variant="subtitle">Insights</ThemedText>
        {(predictions?.insights ?? []).map((insight, index) => (
          <ThemedText key={index}>{`\u2022 ${insight}`}</ThemedText>
        ))}
      </GlowCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  riskPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
