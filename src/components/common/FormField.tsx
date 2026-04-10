import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, TextInputProps, View } from 'react-native';

import { useAppTheme } from '@/src/theme/ThemeProvider';

import { ThemedText } from './ThemedText';

type Props = TextInputProps & {
  label: string;
  helperText?: string;
  showPasswordToggle?: boolean;
};

export function FormField({ label, helperText, style, secureTextEntry, showPasswordToggle, ...props }: Props) {
  const { theme } = useAppTheme();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const canTogglePassword = Boolean(showPasswordToggle && secureTextEntry);

  return (
    <View style={styles.container}>
      <ThemedText variant="caption" color={theme.colors.text}>
        {label}
      </ThemedText>
      <View
        style={[
          styles.inputShell,
          {
            borderColor: theme.colors.border,
            backgroundColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.82)',
          },
        ]}>
        <TextInput
          placeholderTextColor={theme.colors.textSecondary}
          style={[
            styles.input,
            {
              color: theme.colors.text,
            },
            style,
          ]}
          secureTextEntry={canTogglePassword ? !isPasswordVisible : secureTextEntry}
          {...props}
        />
        {canTogglePassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
            hitSlop={10}
            onPress={() => setIsPasswordVisible((current) => !current)}
            style={styles.toggleButton}>
            <Ionicons
              name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={theme.colors.textSecondary}
            />
          </Pressable>
        ) : null}
      </View>
      {helperText ? <ThemedText variant="caption">{helperText}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  inputShell: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    paddingLeft: 14,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    fontSize: 15,
    flex: 1,
    minHeight: 50,
  },
  toggleButton: {
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
