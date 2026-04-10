import { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { GlowCard } from '@/src/components/common/GlowCard';
import { Screen } from '@/src/components/common/Screen';
import { ThemedText } from '@/src/components/common/ThemedText';
import { useAppTheme } from '@/src/theme/ThemeProvider';

export function AuthScaffold({
  title,
  subtitle,
  children,
}: PropsWithChildren<{ title: string; subtitle: string }>) {
  const { theme } = useAppTheme();
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

  return (
    <Screen>
      <View style={styles.hero}>
        <LinearGradient colors={[theme.colors.primary, theme.colors.accent]} style={styles.logo}>
          <ThemedText variant="subtitle" color="#ffffff">
            ET
          </ThemedText>
        </LinearGradient>
        <ThemedText variant="badge">Expense Tracker</ThemedText>
        <ThemedText variant="title">{title}</ThemedText>
        <ThemedText>{subtitle}</ThemedText>
        {__DEV__ ? (
          <ThemedText variant="caption" selectable>{`Clerk key: ${publishableKey || 'missing'}`}</ThemedText>
        ) : null}
      </View>
      <GlowCard style={styles.card}>{children}</GlowCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: 10,
    paddingTop: 24,
    paddingBottom: 8,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    paddingTop: 22,
  },
});
