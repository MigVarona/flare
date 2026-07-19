import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path } from 'react-native-svg';

import { ThemedText } from './themed-text';

import { Palettes, type Palette } from '@/constants/palettes';
import { Colors, glow, neonBorder, Radius, Spacing } from '@/constants/theme';

const theme = Colors.dark;

/**
 * The six pairs, each drawn as the mark itself: two lights and the lens where they cross.
 *
 * Nothing else would say it as well. A pair of squares would be two colours; this is two
 * people, and the thing that only exists because there are two of them.
 *
 * A tap is the decision — there is no Save. A colour has no half-typed state to protect you
 * from, so asking you to confirm it would turn one gesture into two and leave you wondering
 * whether it took. The confirmation is that you can see it and feel it: the app changes
 * colour under your hand, the choice is ticked, and the phone answers.
 */
export function PalettePicker({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={styles.row}>
      {Palettes.map((palette) => {
        const isSelected = palette.id === selectedId;

        return (
          <Pressable
            key={palette.id}
            onPress={() => {
              if (!isSelected) void Haptics.selectionAsync();
              onSelect(palette.id);
            }}
            style={({ pressed }) => [
              styles.option,
              neonBorder(isSelected ? palette.lens : theme.border, isSelected ? 'CC' : 'FF'),
              isSelected && glow(palette.lens, 20, '66'),
              pressed && styles.pressed,
            ]}>
            <PairMark palette={palette} />
            <ThemedText
              type="small"
              themeColor={isSelected ? 'text' : 'textSecondary'}
              numberOfLines={1}>
              {palette.name}
            </ThemedText>

            {isSelected && (
              <View style={[styles.tick, { backgroundColor: palette.lens }]}>
                <Svg width={12} height={12} viewBox="0 0 12 12">
                  <Path
                    d="M2.6 6.3 4.8 8.5 9.4 3.9"
                    stroke={theme.background}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </Svg>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function PairMark({ palette, size = 38 }: { palette: Palette; size?: number }) {
  const radius = size * 0.3;
  const offset = radius * 0.62;
  const width = 2 * (offset + radius);
  const height = 2 * radius;
  const key = palette.id;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Circle cx={radius} cy={radius} r={radius} fill={palette.lights[0]} />
      <Circle cx={radius + 2 * offset} cy={radius} r={radius} fill={palette.lights[1]} />
      <G clipPath={`url(#lens-${key})`}>
        <Circle cx={radius + 2 * offset} cy={radius} r={radius} fill={palette.lens} />
      </G>
      <Defs>
        <ClipPath id={`lens-${key}`}>
          <Circle cx={radius} cy={radius} r={radius} />
        </ClipPath>
      </Defs>
    </Svg>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing[8],
  },
  option: {
    // Three across, whatever the phone: the row divides rather than scrolls.
    flexBasis: '31%',
    flexGrow: 1,
    alignItems: 'center',
    gap: Spacing[8],
    paddingVertical: Spacing[12],
    borderRadius: Radius.medium,
    backgroundColor: theme.background,
  },
  tick: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
