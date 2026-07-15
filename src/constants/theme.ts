/**
 * Churri is a shared, private night-space for two people.
 *
 * The core idea of the system: colour means *who*, not *what*. Each member of the
 * couple owns one end of the brand gradient — you are rose, your partner is cyan —
 * and everything they create in the app carries their colour. The gradient between
 * the two (rose → violet → cyan) is the brand itself: the two of you, meeting.
 *
 * The palette is night-only on purpose. Neon needs darkness to glow.
 */

import '@/global.css';

import { Platform } from 'react-native';

const night = {
  text: '#F2F3F5',
  textSecondary: '#8A90A6',
  // Night blue, not plum. The distinction matters: a purple-tinted black under pink light
  // reads as a nightclub, and we spent a while getting away from that. Blue reads as dark,
  // not as a mood.
  background: '#01030F',
  // Barely lighter than the background, and that's the point: a surface here is not a lighter
  // box, it's an edge of light. The colour lives in the border, not in the fill.
  backgroundElement: '#070B19',
  backgroundSelected: '#0E1428',
  border: '#1E2540',
  /** The colour of the person holding the phone. */
  you: '#F72E79',
  /** The colour of the other one. */
  partner: '#17A9F5',
  /** Where the two meet. */
  accent: '#BD66DD',
  /** The one thing that isn't either of you: something about to be lost. Matches --destructive. */
  destructive: '#FF6467',
} as const;

export const Colors = {
  light: night,
  dark: night,
} as const;

export type ThemeColor = keyof typeof night;

/**
 * The app's own colours, taken from the logo: two lights and the lens where they cross.
 *
 * These are fixed. They belong to Churri, not to the couple — a product whose logo
 * changed depending on who was looking wouldn't have an identity at all. The colours
 * that mean *who* live in `identity.ts` and only ever tint content.
 */
export const Brand = {
  left: '#F72E79',
  right: '#17A9F5',
  /** The lens: where the two lights overlap, and the light adds up rather than mixing down. */
  lens: '#F19AF5',
} as const;

/**
 * The wordmark travels the same road the mark does: from one light, through the place they
 * meet, to the other. That's why it can be coloured without saying something new — it is the
 * mark again, spelled out.
 */
export const BrandGradient = [Brand.left, '#BD66DD', Brand.right] as const;

/**
 * A halo in a given colour — the edge of the light, not a haze.
 *
 * Kept deliberately tight: a wide, soft bloom over a dark surface reads as sultry,
 * and this is a place for the everyday, not a mood.
 */
export function glow(color: string, radius = 20, alpha = '55') {
  const restrained = Math.round(radius * 0.6);
  const softened = Math.round(parseInt(alpha, 16) * 0.55)
    .toString(16)
    .padStart(2, '0');

  return { boxShadow: `0px 0px ${restrained}px ${color}${softened}` };
}

/** A hairline border in a colour, at low opacity — the edge of the neon. */
export function neonBorder(color: string, alpha = '4D') {
  return { borderWidth: 1, borderColor: `${color}${alpha}` };
}

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/**
 * The scale, named after what it is.
 *
 * It used to be `one, two, three…` — and `three` was 16, not 12. Half the app styles with
 * Tailwind classes, where `3` means 12, so the two halves believed they were speaking the same
 * language and were not. Nobody could see it; everything was just faintly out of true.
 *
 * Named by their pixels, the steps can't lie: Spacing[16] *is* p-4, on both sides.
 */
export const Spacing = {
  2: 2,
  4: 4,
  8: 8,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  32: 32,
  48: 48,
  64: 64,
} as const;

/**
 * The corners, lined up with the classes the other half of the app uses. `large` was 22 while
 * `rounded-3xl` is 24 — two different corners for the same kind of thing, two pixels apart:
 * far too close to look deliberate, far too different to look right.
 */
export const Radius = {
  /** rounded-xl */
  small: 12,
  /** rounded-2xl */
  medium: 16,
  /** rounded-3xl */
  large: 24,
  pill: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/**
 * How many messages the space holds. Not a setting — it's the rule the app is built on:
 * only what's present exists, so what you say has to be worth the room it takes.
 */
export const MessageCapacity = 5;
