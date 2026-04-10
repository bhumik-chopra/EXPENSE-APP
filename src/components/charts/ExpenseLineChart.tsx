import { LineChart } from 'react-native-gifted-charts';

import { useAppTheme } from '@/src/theme/ThemeProvider';

type Props = {
  data: { label: string; value: number }[];
};

export function ExpenseLineChart({ data }: Props) {
  const { theme } = useAppTheme();

  return (
    <LineChart
      areaChart
      curved
      color={theme.colors.primary}
      startFillColor={theme.colors.primary}
      endFillColor="transparent"
      startOpacity={0.26}
      endOpacity={0}
      data={
        data.length
          ? data.map((entry) => ({ value: entry.value, label: entry.label.slice(0, 3) }))
          : [{ value: 0, label: '' }]
      }
      hideDataPoints={false}
      dataPointsColor={theme.colors.accent}
      thickness={3}
      xAxisColor={theme.colors.border}
      yAxisColor={theme.colors.border}
      yAxisTextStyle={{ color: theme.colors.textSecondary }}
      xAxisLabelTextStyle={{ color: theme.colors.textSecondary }}
      rulesColor={theme.colors.border}
      noOfSections={4}
      width={280}
    />
  );
}
