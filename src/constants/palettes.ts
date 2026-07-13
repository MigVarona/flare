/**
 * The couple picks the two colours they are made of.
 *
 * Each palette is a duo plus the colour where they meet — never a "his and hers".
 * The pairs are chosen for contrast, so you can always tell at a glance who did what,
 * and none of them lean on the tired blue/pink shorthand for gender.
 */
export type Palette = {
  id: string;
  name: string;
  /** The person holding the phone. */
  you: string;
  /** The other one. */
  partner: string;
  /** Where the two overlap. */
  accent: string;
};

export const Palettes: Palette[] = [
  {
    id: 'neon',
    name: 'Neón',
    you: '#FF3D8A',
    partner: '#37E2FF',
    accent: '#A855F7',
  },
  {
    id: 'brasa',
    name: 'Brasa',
    you: '#FFB020',
    partner: '#FF3D5A',
    accent: '#FF7A2F',
  },
  {
    id: 'selva',
    name: 'Selva',
    you: '#B6FF3D',
    partner: '#2EE6C5',
    accent: '#5BFF8A',
  },
  {
    id: 'cobalto',
    name: 'Cobalto',
    you: '#FF9F1C',
    partner: '#4D8BFF',
    accent: '#8B7BFF',
  },
];

export const DefaultPalette = Palettes[0];

export function paletteById(id: string | null | undefined) {
  return Palettes.find((palette) => palette.id === id) ?? DefaultPalette;
}

/** The brand gradient for a palette: you → the space between → them. */
export function gradientFor(palette: Palette): readonly [string, string, string] {
  return [palette.you, palette.accent, palette.partner] as const;
}
