import { gradientFor } from '@/constants/palettes';
import { useCouple } from '@/context/couple-context';

/**
 * The couple's two colours, plus the gradient between them.
 *
 * Everything that means "who" reads from here, so changing the palette in settings
 * repaints the whole app — including the mark — for both of you at once.
 */
export function usePalette() {
  const { palette } = useCouple();

  return {
    ...palette,
    gradient: gradientFor(palette),
  };
}
