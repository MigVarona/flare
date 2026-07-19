import { paletteById } from '@/constants/palettes';
import { useCouple } from '@/context/couple-context';

/**
 * The colours that mean *who*.
 *
 * They come from the pair the space wears, and from the order you arrived in: whoever opened
 * it is the first light, whoever walked in is the second. So both phones reach the same answer
 * without asking each other, and a message keeps one colour wherever it's read.
 *
 * What this is *not* is the brand. Flare's own colours — the mark, the wordmark, the main
 * action — are fixed and live in `theme.ts`. They belong to the app. These belong to you.
 */
export function usePalette() {
  const { amFirst, paletteId } = useCouple();
  const palette = paletteById(paletteId);

  return {
    /** The person holding this phone. */
    you: amFirst ? palette.left : palette.right,
    /** The other one. */
    partner: amFirst ? palette.right : palette.left,
    /** Where the two meet. */
    accent: palette.lens,
    /**
     * The pair's first light, as it is — not "yours".
     *
     * For anything that belongs to the space rather than to a person: the tab bar is the same
     * bar on both phones, so it can't be tinted by whoever is holding one.
     */
    first: palette.left,
    gradient: [palette.left, palette.lens, palette.right] as const,
  };
}
