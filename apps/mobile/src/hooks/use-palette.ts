import { lightAt, paletteById } from '@/constants/palettes';
import { useSpace } from '@/context/space-context';

/**
 * The colours that mean *who*.
 *
 * They come from the ramp the space wears, and from the order people arrived in: whoever
 * opened it took the first light, whoever walked in next took the second, and so on. Every
 * phone reaches the same answer without asking, and a message keeps one colour wherever
 * it's read.
 *
 * What this is *not* is the brand. Flare's own colours — the mark, the wordmark, the main
 * action — are fixed and live in `theme.ts`. They belong to the app. These belong to you.
 */
export function usePalette() {
  const { space, myIndex, paletteId } = useSpace();
  const palette = paletteById(paletteId);
  const memberIds = space?.memberIds ?? [];

  return {
    /** The person holding this phone. */
    you: lightAt(palette, myIndex),
    /**
     * The light of whoever something belongs to. An unknown uid — someone who has left —
     * answers grey: an absence, not somebody else's colour.
     */
    colorFor(uid: string | null | undefined): string {
      return lightAt(palette, uid ? memberIds.indexOf(uid) : -1);
    },
    /**
     * The nearest other light. In a space of two this is exactly the old "partner" colour;
     * alone, it's the ramp's second light — the colour of the person who hasn't arrived yet.
     */
    partner: lightAt(palette, myIndex === 0 ? 1 : 0),
    /** Where the first two lights meet. */
    accent: palette.lens,
    /**
     * The space's first light, as it is — not "yours".
     *
     * For anything that belongs to the space rather than to a person: the tab bar is the
     * same bar on every phone, so it can't be tinted by whoever is holding one.
     */
    first: palette.lights[0],
    gradient: [palette.lights[0], palette.lens, palette.lights[1]] as const,
  };
}
