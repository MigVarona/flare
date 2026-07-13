import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from './themed-text';

import { BrandGradient, Colors, glow, neonBorder, Radius, Spacing } from '@/constants/theme';

const theme = Colors.dark;

/**
 * The mark: two lights, overlapping. Rose is you, cyan is them, and the place
 * they overlap is the app itself.
 */
export function BrandMark({ size = 128 }: { size?: number }) {
  return (
    <Image
      source={require('@/assets/images/splash-icon.png')}
      style={{ width: size, height: size }}
      contentFit="contain"
    />
  );
}

/** A single light standing for one person. */
export function IdentityDot({ isMine, size = 8 }: { isMine: boolean; size?: number }) {
  const color = isMine ? theme.you : theme.partner;
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        glow(color, size * 1.6, '99'),
      ]}
    />
  );
}

/** Small uppercase label. Carries hierarchy without needing an icon. */
export function Eyebrow({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <ThemedText type="small" style={[styles.eyebrow, color ? { color } : undefined]}>
      {children}
    </ThemedText>
  );
}

/** A surface in the night, edged with neon. */
export function GlowCard({
  children,
  color,
  style,
}: {
  children: ReactNode;
  color?: string;
  style?: ViewStyle;
}) {
  const edge = color ?? theme.accent;
  const wash: readonly [string, string, string] = color
    ? [`${color}2E`, `${color}0D`, 'transparent']
    : [`${theme.you}1F`, `${theme.accent}12`, `${theme.partner}1A`];

  return (
    <View
      style={[styles.card, neonBorder(edge, color ? '66' : '33'), glow(edge, 26, '1F'), style]}>
      <LinearGradient
        colors={wash}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardWash}
      />
      {children}
    </View>
  );
}

/** The brand gradient as a button. Reserved for the one action that matters most. */
export function GradientButton({
  title,
  onPress,
  disabled,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.gradientWrapper,
        glow(theme.accent, 24, '66'),
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <LinearGradient
        colors={BrandGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradientFill}>
        <ThemedText style={styles.gradientLabel}>{title}</ThemedText>
      </LinearGradient>
    </Pressable>
  );
}

/** A quiet button: no fill, just an edge of light. */
export function GhostButton({
  title,
  onPress,
  color,
  disabled,
}: {
  title: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
}) {
  const edge = color ?? theme.border;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.ghost,
        neonBorder(edge, color ? '66' : 'FF'),
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <ThemedText type="smallBold" style={color ? { color } : undefined}>
        {title}
      </ThemedText>
    </Pressable>
  );
}

/** A one-pixel line of brand gradient. Used to divide without adding weight. */
export function GradientRule() {
  return (
    <LinearGradient
      colors={BrandGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.rule}
    />
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    fontSize: 11,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  card: {
    backgroundColor: theme.backgroundElement,
    borderRadius: Radius.large,
    padding: Spacing.four,
    gap: Spacing.two,
    overflow: 'hidden',
  },
  cardWash: {
    ...StyleSheet.absoluteFill,
  },
  gradientWrapper: {
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  gradientFill: {
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientLabel: {
    color: '#0B0710',
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  ghost: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  rule: {
    height: 1,
    borderRadius: 1,
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.4,
  },
});
