/**
 * The six pairs. One belongs to the space, and both of you live inside it.
 *
 * This is not the ten-swatch system that used to be here. That one asked each of you to pick a
 * colour, then had to stop you from picking similar ones, then had to compute the shade in
 * between — three moving parts for a decision taken twice. This is one choice, made once, from
 * pairs that were already designed to work.
 *
 * Whoever opened the space takes the first light and whoever walked in takes the second, so
 * there is nothing to negotiate and nothing to store per person.
 *
 * The brand is not in here on purpose. Flare's own colours — the mark, the main action — stay
 * pink and blue whatever you choose. They belong to the app; this belongs to you.
 */
export type Palette = {
  id: string;
  name: string;
  /** The first person in. */
  left: string;
  /** The second. */
  right: string;
  /** Where the two overlap. Sampled, not computed: light adds up, it doesn't average. */
  lens: string;
};

export const Palettes: Palette[] = [
  { id: 'neon', name: 'Neón', left: '#F52E77', right: '#00C1E8', lens: '#FB99EA' },
  { id: 'brasa', name: 'Brasa', left: '#EFA201', right: '#F85763', lens: '#FD9B05' },
  { id: 'selva', name: 'Selva', left: '#B7E509', right: '#7BED4A', lens: '#F3FB77' },
  { id: 'cobalto', name: 'Cobalto', left: '#19ACF5', right: '#7132F2', lens: '#01B1FB' },
  { id: 'coral', name: 'Coral', left: '#E04392', right: '#F98145', lens: '#FC768E' },
  { id: 'lima', name: 'Lima', left: '#B7E408', right: '#25D6C3', lens: '#AEF65D' },
];

/** Neón, which is also the brand's own pair: the app looks like itself until you say otherwise. */
export const DefaultPalette = Palettes[0];

export function paletteById(id: string | null | undefined): Palette {
  return Palettes.find((palette) => palette.id === id) ?? DefaultPalette;
}
