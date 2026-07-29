import { Pressable, View } from 'react-native';

import { LightSignal, Signals, type SignalId } from './light-signals';
import { ThemedText } from './themed-text';

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from '@/components/ui/actionsheet';
import { Colors, glow, neonBorder } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';

const theme = Colors.dark;

/**
 * Reacting is free — that's the whole point. It lets you say "I'm here" without
 * spending one of the five things you get to say.
 */
export function SignalPicker({
  isOpen,
  current,
  onPick,
  onClose,
}: {
  isOpen: boolean;
  current?: SignalId | null;
  onPick: (signal: SignalId | null) => void;
  onClose: () => void;
}) {
  const palette = usePalette();

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="pb-8">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <View className="w-full gap-2 px-2 pt-4">
          {Signals.map((signal) => {
            const isActive = signal.id === current;

            return (
              <Pressable
                key={signal.id}
                // Picking the one you already sent takes it back.
                onPress={() => onPick(isActive ? null : signal.id)}
                className="flex-row items-center gap-4 rounded-2xl px-4 py-3 active:opacity-70"
                style={[
                  neonBorder(isActive ? palette.you : theme.border, isActive ? 'AA' : 'FF'),
                  isActive ? glow(palette.you, 16, '44') : undefined,
                ]}>
                <LightSignal id={signal.id} color={palette.you} size={26} />
                <View className="gap-0.5">
                  <ThemedText type="smallBold">{signal.name}</ThemedText>
                  <ThemedText type="small" className="text-muted-foreground">
                    {signal.meaning}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ActionsheetContent>
    </Actionsheet>
  );
}
