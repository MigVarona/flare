import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { forwardRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from './themed-text';

import { Colors, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';

const theme = Colors.dark;
type TabName = 'Espacio' | 'Avisos' | 'Archivo' | 'Tablón';

/**
 * The bar: a piece of frosted glass with one light moving along it.
 *
 * The light used to be a pill drawn inside whichever tab was active, so it *teleported* —
 * gone from one, suddenly present in the next. And the active tab grew (`flex: 1.16`),
 * shoving the others aside as you moved. Both are the kind of thing you don't consciously
 * notice and that make an app feel unfinished.
 *
 * Now the light is a single object that lives above the tabs and **slides** to the one you
 * chose. Nothing resizes. And the bar is glass, so the screen goes on underneath it instead
 * of being cut off by a solid slab.
 */
export default function AppTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs>
      <TabSlot />

      {/* The bar *is* the TabList. It can't be wrapped in anything: Tabs walks its own
          children looking for triggers and steps straight over any View it meets, so a
          wrapper makes the tabs vanish. The glass and the light go inside it instead —
          TabList renders whatever you give it, and ignores what isn't a trigger. */}
      <TabList style={[styles.bar, { paddingBottom: insets.bottom + Spacing[8] }]}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.tint]} />

        <TabTrigger name="index" href="/" asChild>
          <TabButton>Espacio</TabButton>
        </TabTrigger>
        <TabTrigger name="reminders" href="/reminders" asChild>
          <TabButton>Avisos</TabButton>
        </TabTrigger>
        <TabTrigger name="archive" href="/archive" asChild>
          <TabButton>Archivo</TabButton>
        </TabTrigger>
        <TabTrigger name="board" href="/board" asChild>
          <TabButton>Tablón</TabButton>
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}

/**
 * The active tab says so once: its light comes on.
 *
 * It used to say so three times — a pill behind it, a filament above it, and a halo around
 * it — which isn't richness, it's not having decided. And the pill was misaligned anyway: it
 * offset itself by the bar's padding, which the tab's own position already included, so it
 * sat four pixels to the right of where it belonged.
 */
const TabButton = forwardRef<View, TabTriggerSlotProps>(function TabButton(
  { children, isFocused, onPress, ...props },
  ref,
) {
  const palette = usePalette();
  const label = String(children) as TabName;

  return (
    <Pressable
      ref={ref}
      {...props}
      onPress={(event) => {
        if (!isFocused) void Haptics.selectionAsync();
        onPress?.(event);
      }}
      style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
      <TabIcon
        name={label}
        color={isFocused ? palette.first : `${theme.textSecondary}D9`}
        focused={isFocused}
      />
      <ThemedText
        type="smallBold"
        numberOfLines={1}
        style={[isFocused ? { color: palette.first } : styles.labelIdle]}>
        {children}
      </ThemedText>
    </Pressable>
  );
});

function TabIcon({ name, color, focused }: { name: TabName; color: string; focused?: boolean }) {
  const strokeWidth = focused ? 2 : 1.75;

  return (
    <Svg width={25} height={25} viewBox="0 0 24 24">
      {name === 'Espacio' && (
        <Path
          d="M5.4 11.1 12 5.4l6.6 5.7v6.1a2 2 0 0 1-2 2h-2.5v-4.8H9.9v4.8H7.4a2 2 0 0 1-2-2v-6.1Z"
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {name === 'Avisos' && (
        <>
          <Path
            d="M7.3 10.3a4.7 4.7 0 0 1 9.4 0v3.3l1.5 2.2H5.8l1.5-2.2v-3.3Z"
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M10.1 18.1a2.05 2.05 0 0 0 3.8 0M12 5.1V3.9"
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </>
      )}
      {name === 'Archivo' && (
        <>
          <Rect
            x={4.6}
            y={6.1}
            width={14.8}
            height={11.8}
            rx={2.6}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <Circle cx={15.4} cy={9.5} r={1.1} fill={color} />
          <Path
            d="m6.9 16 3.1-3.2 2.6 2.5 1.5-1.4 3 2.1"
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {name === 'Tablón' && (
        <>
          <Path
            d="M5.2 8.5A2.5 2.5 0 0 1 7.7 6h8.6a2.5 2.5 0 0 1 2.5 2.5v4.7a2.5 2.5 0 0 1-2.5 2.5h-3.4l-4.2 3v-3h-1A2.5 2.5 0 0 1 5.2 13.2V8.5Z"
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  bar: {
    // Flat and against the edge, not a pill floating over the screen. A bar that hovers asks
    // to be looked at; this one gets out of the way and lets the content own the screen.
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: Spacing[8],
    backgroundColor: 'transparent',
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  tint: {
    // The blur alone leaves the bar too bright over a dark screen; this puts the night back.
    backgroundColor: 'rgba(1,3,15,0.78)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[4],
    paddingVertical: Spacing[4],
  },
  labelIdle: {
    color: theme.textSecondary,
  },
  pressed: {
    opacity: 0.7,
  },
});
