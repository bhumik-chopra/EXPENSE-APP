import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/src/theme/ThemeProvider';

import { ThemedText } from './ThemedText';

export function LoadingView({ label = 'Loading...' }: { label?: string }) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.container}>
      <ActivityIndicator color={theme.colors.primary} size="large" />
      <ThemedText>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 12,
  },
});
