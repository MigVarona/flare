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
type TabName = 'Espacio' | 'Avisos' | 'Fotos' | 'Mensajes';

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
        <TabTrigger name="gallery" href="/gallery" asChild>
          <TabButton>Fotos</TabButton>
        </TabTrigger>
        <TabTrigger name="chat" href="/chat" asChild>
          <TabButton>Mensajes</TabButton>
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
  // The Espacio icon is the two of you — the same two circles as the mark — so it wears the
  // pair you chose, not the brand's. Everything else here is a plain shape and takes the
  // active colour like any other.
  const palette = usePalette();
  const strokeWidth = focused ? 2.35 : 2;

  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      {name === 'Espacio' && (
        <>
          <Circle cx={9.2} cy={12} r={5.2} fill={focused ? palette.you : 'none'} stroke={color} strokeWidth={strokeWidth} />
          <Circle cx={14.8} cy={12} r={5.2} fill={focused ? palette.partner : 'none'} stroke={color} strokeWidth={strokeWidth} />
          <Circle cx={12} cy={12} r={2.2} fill={focused ? palette.accent : color} opacity={focused ? 0.9 : 0.55} />
        </>
      )}
      {name === 'Avisos' && (
        <>
          <Path
            d="M7.2 10.5a4.8 4.8 0 0 1 9.6 0v3.1l1.5 2.3H5.7l1.5-2.3v-3.1Z"
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M10 18.1a2.15 2.15 0 0 0 4 0M12 4.9V3.7"
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </>
      )}
      {name === 'Fotos' && (
        <>
          <Rect
            x={4.2}
            y={5.8}
            width={15.6}
            height={12.8}
            rx={3.4}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
          />
          <Circle cx={15.7} cy={9.5} r={1.25} fill={color} />
          <Path
            d="m6.7 16.1 3.4-3.5 2.8 2.6 1.6-1.5 2.9 2.4"
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {name === 'Mensajes' && (
        <>
          <Path
            d="M5 8.1A2.6 2.6 0 0 1 7.6 5.5h8.8A2.6 2.6 0 0 1 19 8.1v4.8a2.6 2.6 0 0 1-2.6 2.6h-3.7L8.6 18.7v-3.2h-1A2.6 2.6 0 0 1 5 12.9V8.1Z"
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M8.6 10.1h6.8M8.6 12.8h4.2"
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
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
