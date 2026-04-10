import { PropsWithChildren } from 'react';
import { RefreshControl, ScrollView, ScrollViewProps, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/src/theme/ThemeProvider';

import { AppBackground } from './AppBackground';

type ScreenProps = PropsWithChildren<
  ScrollViewProps & {
    scrollable?: boolean;
    refreshing?: boolean;
    onRefresh?: () => void;
  }
>;

export function Screen({
  children,
  scrollable = true,
  refreshing,
  onRefresh,
  contentContainerStyle,
  ...props
}: ScreenProps) {
  const { theme } = useAppTheme();
  const refreshControl =
    onRefresh ? (
      <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={theme.colors.primary} />
    ) : undefined;

  return (
    <AppBackground>
      <SafeAreaView style={styles.safeArea}>
        {scrollable ? (
          <ScrollView
            contentContainerStyle={[styles.content, contentContainerStyle]}
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
            {...props}>
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, contentContainerStyle]}>{children}</View>
        )}
      </SafeAreaView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 120,
    gap: 16,
  },
});
