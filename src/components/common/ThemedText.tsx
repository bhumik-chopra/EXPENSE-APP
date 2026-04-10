import { StyleProp, Text, TextProps, TextStyle } from 'react-native';

import { useAppTheme } from '@/src/theme/ThemeProvider';

type Props = TextProps & {
  variant?: 'title' | 'subtitle' | 'body' | 'caption' | 'badge';
  color?: string;
};

export function ThemedText({ variant = 'body', color, style, ...props }: Props) {
  const { theme } = useAppTheme();

  const variants: Record<NonNullable<Props['variant']>, StyleProp<TextStyle>> = {
    title: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: theme.colors.text },
    subtitle: { fontSize: 17, lineHeight: 24, fontWeight: '700', color: theme.colors.text },
    body: { fontSize: 15, lineHeight: 22, color: theme.colors.textSecondary },
    caption: { fontSize: 13, lineHeight: 18, color: theme.colors.textSecondary },
    badge: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: theme.colors.primary },
  };

  return <Text style={[variants[variant], color ? { color } : null, style]} {...props} />;
}
