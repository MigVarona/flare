import { StyleSheet, Text, type TextProps } from 'react-native';

import { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The type scale. Six sizes, and nothing outside them.
 *
 * The app had eleven — 34, 32, 30, 28, 20, 19, 18, 16, 14, 11 — invented one screen at a time
 * and related to each other by nothing. That is what "not quite right" looks like when you
 * can't name it: sizes so close together that they read as mistakes rather than as levels.
 *
 * These six are far enough apart to be told apart. Every line in the app is one of them.
 */
export type ThemedTextProps = TextProps & {
  type?: 'display' | 'title' | 'headline' | 'default' | 'small' | 'smallBold' | 'key';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        styles[type],
        style,
      ]}
      {...rest}
    />
  );
}

// Android ignores fontWeight once a custom family is set, so each weight has to be named as
// its own family rather than asked for numerically.
const styles = StyleSheet.create({
  /** The one line that owns a screen. Onboarding only. */
  display: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -1,
  },
  /** What every screen is called. */
  title: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 31,
    lineHeight: 37,
    letterSpacing: 0,
  },
  /** The thing a card is actually about: a reminder, a message, a name. */
  headline: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 19,
    lineHeight: 26,
  },
  default: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 16,
    lineHeight: 24,
  },
  small: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  smallBold: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
  },
  /** The invite key, and only that: letters spaced far enough apart to read one at a time. */
  key: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: 8,
  },
});
