import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '@/src/theme/ThemeProvider';
import { GlowCard } from './GlowCard';
import { ThemedText } from './ThemedText';

export function EmptyState({ title, body }: { title: string; body: string }) {
  const { theme } = useAppTheme();

  return (
    <GlowCard>
      <View style={styles.content}>
        <View style={[styles.iconBox, { backgroundColor: `${theme.colors.primary}15` }]}>
          <Ionicons name="file-tray-outline" size={40} color={theme.colors.primary} />
        </View>
        <ThemedText variant="subtitle" style={styles.title}>
          {title}
        </ThemedText>
        <ThemedText style={styles.body}>{body}</ThemedText>
      </View>
    </GlowCard>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
    lineHeight: 20,
  },
});
