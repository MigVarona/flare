import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G } from 'react-native-svg';

import { ThemedText } from './themed-text';

import { Spinner } from '@/components/ui/spinner';
import { Brand, BrandGradient, Colors, glow, neonBorder, Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';

const theme = Colors.dark;

/**
 * The mark: two lights and the lens where they cross. The app's, not the couple's.
 *
 * Drawn rather than loaded, so it reads its colours from the brand instead of carrying a
 * copy of them baked into an image — change them in one place and the mark, the wordmark and
 * the launcher icon all move together.
 */
export function BrandMark({ size = 128 }: { size?: number }) {
  const radius = size * 0.25;
  const offset = radius * 0.62;

  // The canvas ends where the circles do. Drawn inside a square, the mark would carry empty
  // air on both sides, and nothing placed next to it could ever sit close — the gap you'd be
  // adjusting is not the gap you'd be seeing.
  const width = 2 * (offset + radius);
  const height = 2 * radius;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Circle cx={radius} cy={radius} r={radius} fill={Brand.left} />
      <Circle cx={radius + 2 * offset} cy={radius} r={radius} fill={Brand.right} />
      {/* Where they overlap, the light adds up: the lens is brighter than either one. */}
      <G clipPath="url(#lens)">
        <Circle cx={radius + 2 * offset} cy={radius} r={radius} fill={Brand.lens} />
      </G>
      <Defs>
        <ClipPath id="lens">
          <Circle cx={radius} cy={radius} r={radius} />
        </ClipPath>
      </Defs>
    </Svg>
  );
}

/**
 * The wordmark, carrying the same gradient as the mark: from one light, through the place
 * where they meet, to the other. It isn't decoration — it's the mark again, spelled out.
 *
 * The type is Gabarito ExtraBold: circular geometry, like the circles beside it. The gradient is
 * painted through the letters with a mask rather than drawn as SVG text, because on Android
 * a custom font only holds up when it goes through the normal text pipeline.
 */
export function Wordmark({ size = 56 }: { size?: number }) {
  const letters = (
    <ThemedText style={[styles.wordmark, { fontSize: size, lineHeight: size * 1.08 }]}>
      flare
    </ThemedText>
  );

  return (
    <MaskedView accessibilityLabel="Flare" maskElement={letters}>
      <LinearGradient colors={BrandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        {/* The same text again, invisible: it gives the gradient the exact shape to fill. */}
        <View style={styles.wordmarkGhost}>{letters}</View>
      </LinearGradient>
    </MaskedView>
  );
}

/**
 * The horizontal lockup: the mark and the name, side by side.
 *
 * Stacked, the two read as a splash screen — something that plants itself in the middle and
 * waits. Side by side they read as a product: short, and leaving room for whatever the page
 * is actually for. The word sits slightly larger than half the mark's height, which is what
 * makes them look like one object instead of two things placed near each other.
 */
export function BrandLockup({ size = 40 }: { size?: number }) {
  return (
    <View style={[styles.lockup, { gap: size * 0.08 }]} accessibilityLabel="Flare">
      <BrandMark size={size} />
      <Wordmark size={size * 0.66} />
    </View>
  );
}

/**
 * How every screen opens: its name, and the two of you underneath it.
 *
 * It used to be a small grey label above a big title, and on half the screens the label just
 * said the title again in capitals ("VUESTRAS FOTOS" over "Fotos"). Saying a thing twice
 * isn't emphasis, it's noise. What goes there instead is the only thing that's actually
 * true on every screen: two lights, one for each of you.
 */
export function ScreenHeader({ title }: { title: string }) {
  return (
    <View style={styles.screenHeader}>
      <ThemedText type="title">{title}</ThemedText>
      {/* On the same line as the name, not underneath it. Stacked, the two lights claimed a
          whole row of the screen to say something that fits in the gap after a word. */}
      <View style={styles.screenLights}>
        <IdentityDot isMine size={14} />
        <IdentityDot isMine={false} size={14} />
      </View>
    </View>
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

/**
 * A card drawn by its edge.
 *
 * The card used to be a lighter box with a faint outline and a wash of colour inside, which is
 * how most dark apps do it — and it's why they all look the same. Here the fill is a shade off
 * the background, close enough to disappear, and the *border* carries everything: a hairline of
 * light running from one person's colour to the other's.
 *
 * That single line is the whole design. It says who the card belongs to when it belongs to one
 * of you, and it says "both" when it doesn't — because then it runs the full length of the
 * brand, pink through the lens to blue.
 *
 * A gradient can't be a border in React Native, so it is one underneath: a lit rectangle with
 * the card laid on top of it, one pixel in from every side.
 */
export function GlowCard({
  children,
  color,
  style,
}: {
  children: ReactNode;
  /** One person's colour, when the card is theirs. Left out, the edge belongs to both of you. */
  color?: string;
  style?: ViewStyle;
}) {
  const palette = usePalette();

  // A card that isn't anybody's runs the whole pair, from one of you to the other. That's the
  // couple's pair, not the brand's — the brand belongs to Flare and stays where it is.
  const edge: readonly [string, string, string] = color
    ? [color, color, color]
    : palette.gradient;

  return (
    <LinearGradient
      colors={edge}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.cardEdge, glow(color ?? palette.accent, 26, '4D'), style]}>
      <View style={styles.card}>{children}</View>
    </LinearGradient>
  );
}

/**
 * The main action, in the brand's own gradient.
 *
 * Not the couple's colours, and on purpose: a button is the app speaking, not either of
 * them. Their colours mean *who made this*, and nobody made a button. It also has to work
 * before there is a couple at all — in onboarding, a gradient built from two people would be
 * painted with two people who don't exist yet.
 */
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
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || isLoading}
      style={({ pressed }) => [
        styles.gradientWrapper,
        glow(Brand.lens, 24, '66'),
        pressed && styles.pressed,
        (disabled || isLoading) && styles.disabled,
      ]}>
      <LinearGradient
        colors={BrandGradient}
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
  wordmark: {
    fontFamily: 'Gabarito_800ExtraBold',
    color: theme.text,
    letterSpacing: -1.5,
    textAlign: 'center',
  },
  wordmarkGhost: {
    opacity: 0,
  },
  lockup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[12],
    // The one breath between a screen's name and its contents. Same on every screen, so
    // moving between them doesn't feel like moving between apps.
    marginBottom: Spacing[24],
  },
  screenLights: {
    flexDirection: 'row',
    gap: Spacing[8],
    // Centred on the letters, not on the line box. Outfit reserves a tall ascender for accents
    // and caps, and that room sits above the word and is mostly empty — so the letters ride low
    // in their own box, and anything centred against the box lands above them. The margin puts
    // the lights back down onto the line the eye actually reads.
    marginTop: 8,
  },
  eyebrow: {
    fontFamily: 'Outfit_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    fontSize: 11,
    color: theme.textSecondary,
  },
  cardEdge: {
    borderRadius: Radius.large,
    // One pixel of light on every side. That's the border.
    padding: 1,
  },
  card: {
    backgroundColor: theme.backgroundElement,
    // A hair tighter than the edge, so the corner of the light doesn't square off.
    borderRadius: Radius.large - 1,
    padding: Spacing[24],
    gap: Spacing[8],
    overflow: 'hidden',
  },
  gradientWrapper: {
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  gradientFill: {
    paddingVertical: Spacing[16],
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientLabel: {
    fontFamily: 'Outfit_700Bold',
    color: theme.background,
    letterSpacing: 0.3,
  },
  ghost: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing[16],
    paddingHorizontal: Spacing[24],
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
