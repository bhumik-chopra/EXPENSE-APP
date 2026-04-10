import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './ThemedText';

type Props = {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
};

export function SectionHeader({ title, actionLabel, onActionPress }: Props) {
  return (
    <View style={styles.row}>
      <ThemedText variant="subtitle">{title}</ThemedText>
      {actionLabel ? (
        <Pressable
          onPress={onActionPress}
          hitSlop={8}
          style={({ pressed }) => (pressed ? styles.actionPressed : null)}>
          <ThemedText variant="badge">{actionLabel}</ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.85,
  },
});
