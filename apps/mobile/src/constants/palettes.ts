/**
 * The six palettes. One belongs to the space, and everyone in it lives inside it.
 *
 * A palette used to be a pair, because a space used to be a pair. Now it is a ramp of eight
 * lights in a fixed order: whoever opened the space wears the first, whoever walked in next
 * wears the second, and so on. Your position in the arrival list *is* your colour — nothing
 * to negotiate, nothing to store per person, and every phone reaches the same answer alone.
 *
 * The first two lights of every ramp are the exact pair the palette always had, so a space
 * of two people looks precisely as it did before there could be more.
 *
 * The brand is not in here on purpose. Flare's own colours — the mark, the main action — stay
 * pink and blue whatever you choose. They belong to the app; this belongs to you.
 */
export type Palette = {
  id: string;
  name: string;
  /** The ramp, in arrival order. lights[0] and lights[1] are the palette's original pair. */
  lights: string[];
  /** Where the first two overlap. Sampled, not computed: light adds up, it doesn't average. */
  lens: string;
};

/** How many people fit in a space — the ramps are designed for exactly this many. */
export const MaxMembers = 8;

export const Palettes: Palette[] = [
  {
    id: 'neon',
    name: 'Neón',
    lens: '#FB99EA',
    lights: ['#F52E77', '#00C1E8', '#A855F7', '#22E584', '#FFB020', '#FF5CA8', '#4D7CFE', '#D8F050'],
  },
  {
    id: 'brasa',
    name: 'Brasa',
    lens: '#FD9B05',
    lights: ['#EFA201', '#F85763', '#FF7A2F', '#E23B4E', '#FFC53D', '#FF8F6B', '#D96A29', '#F0B8A0'],
  },
  {
    id: 'selva',
    name: 'Selva',
    lens: '#F3FB77',
    lights: ['#B7E509', '#7BED4A', '#2ED573', '#D4F04F', '#0BCB8B', '#98E8B0', '#8AB80F', '#5EE6CE'],
  },
  {
    id: 'cobalto',
    name: 'Cobalto',
    lens: '#01B1FB',
    lights: ['#19ACF5', '#7132F2', '#3B5BFF', '#9D7BFF', '#00D1D1', '#5A8DFF', '#B14DFF', '#67D6F0'],
  },
  {
    id: 'coral',
    name: 'Coral',
    lens: '#FC768E',
    lights: ['#E04392', '#F98145', '#FF6B6B', '#F4A25C', '#D9578E', '#FFB0A0', '#C74E6B', '#FFD08A'],
  },
  {
    id: 'lima',
    name: 'Lima',
    lens: '#AEF65D',
    lights: ['#B7E408', '#25D6C3', '#8AE234', '#3EE8A0', '#D8F050', '#0FBFA5', '#9CCF20', '#6FE8D8'],
  },
];

/** Neón, which is also the brand's own pair: the app looks like itself until you say otherwise. */
export const DefaultPalette = Palettes[0];

export function paletteById(id: string | null | undefined): Palette {
  return Palettes.find((palette) => palette.id === id) ?? DefaultPalette;
}

/**
 * The light for a given arrival position. Beyond the ramp (which the member cap makes
 * impossible) or before it (an unknown uid), it answers grey — a person the space no
 * longer knows is shown as an absence, not as somebody else's colour.
 */
export function lightAt(palette: Palette, index: number): string {
  return palette.lights[index] ?? '#6B7280';
}
