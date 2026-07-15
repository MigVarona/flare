import { useCallback } from 'react';

import { Toast, ToastDescription, useToast } from '@/components/ui/toast';

/**
 * The app speaks only when something went wrong.
 *
 * Everything that works is already on screen — the reminder is in the list, the photo is
 * in the grid, the colour has changed — and announcing it again is noise. So this is for
 * failures, and it looks like one: nobody's colour, because a failure belongs to neither
 * of you.
 */
export function useNotice() {
  const toast = useToast();

  return useCallback(
    (message: string) => {
      toast.show({
        placement: 'top',
        duration: 2600,
        render: ({ id }) => (
          <Toast
            nativeID={`notice-${id}`}
            action="error"
            variant="solid"
            className="mt-2 rounded-2xl border border-destructive/60 bg-card px-4 py-3">
            <ToastDescription className="font-semibold text-destructive">
              {message}
            </ToastDescription>
          </Toast>
        ),
      });
    },
    [toast],
  );
}
