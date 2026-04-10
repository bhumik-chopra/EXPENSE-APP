import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '@/src/theme/ThemeProvider';
import { ThemedText } from '@/src/components/common/ThemedText';

export function UploadCard({ onPress }: { onPress: () => void }) {
  const { theme } = useAppTheme();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => (pressed ? styles.pressed : null)}>
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}>
        <View style={styles.iconContainer}>
          <Ionicons name="camera-outline" size={32} color="#ffffff" />
        </View>
        <View style={styles.content}>
          <ThemedText variant="subtitle" color="#ffffff">Quick Upload</ThemedText>
          <ThemedText color="rgba(255,255,255,0.85)">Snap or upload a receipt</ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#ffffff" />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 16,
    marginBottom: 16,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 4,
  },
});
