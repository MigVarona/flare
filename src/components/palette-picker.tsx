import { Pressable, View } from 'react-native';

import { ThemedText } from './themed-text';

import { Palettes } from '@/constants/palettes';
import { glow, neonBorder } from '@/constants/theme';

/**
 * You pick the two colours you're made of. Each option shows the duo itself —
 * the two lights and the one between them — because that's what you're choosing,
 * not a label.
 */
export function PalettePicker({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <View className="mt-2 gap-2">
      {Palettes.map((palette) => {
        const isActive = palette.id === selectedId;

        return (
          <Pressable
            key={palette.id}
            onPress={() => onSelect(palette.id)}
            className="flex-row items-center gap-4 rounded-2xl px-4 py-4 active:opacity-70"
            style={[
              neonBorder(isActive ? palette.accent : '#2C2038', isActive ? 'AA' : 'FF'),
              isActive ? glow(palette.accent, 18, '44') : undefined,
            ]}>
            <View className="flex-row items-center">
              <View
                className="h-6 w-6 rounded-full"
                style={[{ backgroundColor: palette.you }, glow(palette.you, 10, '99')]}
              />
              <View
                className="-ml-2.5 h-6 w-6 rounded-full"
                style={[{ backgroundColor: palette.partner }, glow(palette.partner, 10, '99')]}
              />
            </View>

            <ThemedText
              type="smallBold"
              style={isActive ? { color: palette.accent } : undefined}
              className={isActive ? undefined : 'text-muted-foreground'}>
              {palette.name}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}
