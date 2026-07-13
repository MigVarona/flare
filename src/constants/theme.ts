/**
 * Churriapp is a shared, private night-space for two people.
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
  text: '#F4EEF7',
  textSecondary: '#9A8AA6',
  background: '#0B0710',
  backgroundElement: '#150E1B',
  backgroundSelected: '#221830',
  border: '#2C2038',
  /** The colour of the person holding the phone. */
  you: '#FF3D8A',
  /** The colour of the other one. */
  partner: '#37E2FF',
  /** Where the two meet. */
  accent: '#A855F7',
} as const;

export const Colors = {
  light: night,
  dark: night,
} as const;

export type ThemeColor = keyof typeof night;

/** The brand gradient: you → the space between → them. */
export const BrandGradient = ['#FF3D8A', '#A855F7', '#37E2FF'] as const;

/** A neon halo in a given colour. Needs a dark surface behind it to read. */
export function glow(color: string, radius = 20, alpha = '55') {
  return { boxShadow: `0px 0px ${radius}px ${color}${alpha}` };
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

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  small: 10,
  medium: 16,
  large: 22,
  pill: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/**
 * How many messages the space holds. Not a setting — it's the rule the app is built on:
 * only what's present exists, so what you say has to be worth the room it takes.
 */
export const MessageCapacity = 5;
