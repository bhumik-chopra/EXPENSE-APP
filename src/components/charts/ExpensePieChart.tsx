import { useMemo } from 'react';
import { View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';

import { useAppTheme } from '@/src/theme/ThemeProvider';

type Props = {
  data: { label: string; value: number; color: string }[];
};

export function ExpensePieChart({ data }: Props) {
  const { theme } = useAppTheme();

  const pieData = useMemo(
    () =>
      data.map((entry) => ({
        value: entry.value,
        color: entry.color,
        text: entry.label,
      })),
    [data],
  );

  return (
    <View>
      <PieChart
        donut
        radius={84}
        innerRadius={48}
        data={pieData.length ? pieData : [{ value: 1, color: theme.colors.border, text: 'No data' }]}
        textColor={theme.colors.text}
        textSize={11}
        focusOnPress
      />
    </View>
  );
}
