import { useCallback } from 'react';

import { Toast, ToastDescription, useToast } from '@/components/ui/toast';
import { glow, neonBorder } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';

/** Whose action this is. The notice carries their colour, like everything else. */
type Voice = 'you' | 'partner' | 'both';

/**
 * A short confirmation that something happened. Keep the text to a few words —
 * a notice is a reassurance, not an explanation.
 */
export function useNotice() {
  const toast = useToast();
  const palette = usePalette();

  return useCallback(
    (message: string, voice: Voice = 'you') => {
      const color =
        voice === 'you' ? palette.you : voice === 'partner' ? palette.partner : palette.accent;

      toast.show({
        placement: 'top',
        duration: 2200,
        render: ({ id }) => (
          <Toast
            nativeID={`notice-${id}`}
            action="muted"
            variant="solid"
            className="mt-2 rounded-2xl bg-card px-4 py-3"
            style={[neonBorder(color, '88'), glow(color, 22, '55')]}>
            <ToastDescription className="font-semibold text-foreground">{message}</ToastDescription>
          </Toast>
        ),
      });
    },
    [toast, palette],
  );
}
