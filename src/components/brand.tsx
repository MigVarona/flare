import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G } from 'react-native-svg';

import { ThemedText } from './themed-text';

import { Spinner } from '@/components/ui/spinner';
import { Colors, glow, neonBorder, Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';

const theme = Colors.dark;

/**
 * The mark: two lights, overlapping — and the lens between them, which only exists
 * because both are there. Drawn rather than shipped as an image, so it repaints when
 * the couple changes their colours.
 */
export function BrandMark({ size = 128 }: { size?: number }) {
  const palette = usePalette();

  const center = size / 2;
  const radius = size * 0.155;
  const offset = radius * 0.58;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <ClipPath id="left">
          <Circle cx={center - offset} cy={center} r={radius} />
        </ClipPath>
      </Defs>
      <Circle cx={center - offset} cy={center} r={radius} fill={palette.you} />
      <Circle cx={center + offset} cy={center} r={radius} fill={palette.partner} />
      <G clipPath="url(#left)">
        <Circle cx={center + offset} cy={center} r={radius} fill={palette.accent} />
      </G>
    </Svg>
  );
}

/** A single light standing for one person. */
export function IdentityDot({ isMine, size = 8 }: { isMine: boolean; size?: number }) {
  const palette = usePalette();
  const color = isMine ? palette.you : palette.partner;

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
  const palette = usePalette();

  const edge = color ?? palette.accent;
  const wash: readonly [string, string, string] = color
    ? [`${color}2E`, `${color}0D`, 'transparent']
    : [`${palette.you}1F`, `${palette.accent}12`, `${palette.partner}1A`];

  return (
    <View style={[styles.card, neonBorder(edge, color ? '66' : '33'), glow(edge, 26, '1F'), style]}>
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

/** The brand gradient as a button: the two of you, in the shape of an action. */
export function GradientButton({
  title,
  onPress,
  disabled,
  isLoading,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  /** Shows a spinner in place of the label, so the wait is visible instead of dead. */
  isLoading?: boolean;
}) {
  const palette = usePalette();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || isLoading}
      style={({ pressed }) => [
        styles.gradientWrapper,
        glow(palette.accent, 24, '66'),
        pressed && styles.pressed,
        (disabled || isLoading) && styles.disabled,
      ]}>
      <LinearGradient
        colors={palette.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradientFill}>
        {isLoading ? (
          <Spinner color={theme.background} />
        ) : (
          <ThemedText style={styles.gradientLabel}>{title}</ThemedText>
        )}
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
  const palette = usePalette();

  return (
    <LinearGradient
      colors={palette.gradient}
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
