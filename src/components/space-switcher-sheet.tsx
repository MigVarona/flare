import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from '@/components/ui/actionsheet';
import { lightAt, paletteById } from '@/constants/palettes';
import { Colors, glow, Radius, Spacing } from '@/constants/theme';
import { useSpace, type Space } from '@/context/space-context';

const theme = Colors.dark;

/** How many lights a row shows before folding the rest into "+N" — past this, the row is
 * naming people, not showing them. */
const MaxRowLights = 3;

/**
 * The fast way to switch spaces, from wherever you are — one tap on the pill in the home
 * header, one tap on where you're going. The full spaces screen still exists for the slower
 * work (creating, joining, archiving); this is only ever for "which one am I looking at."
 */
export function SpaceSwitcherSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { spaces, spaceId, setActiveSpace } = useSpace();
  // Archived spaces are deliberately out of the way everywhere else; a quick switcher isn't
  // where that changes. They're still one tap away, inside "Gestionar espacios".
  const activeSpaces = spaces.filter((space) => !space.archived);

  const select = (id: string) => {
    setActiveSpace(id);
    onClose();
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <View style={styles.list}>
          {activeSpaces.map((space) => (
            <SwitcherRow
              key={space.id}
              space={space}
              isActive={space.id === spaceId}
              onPress={() => select(space.id)}
            />
          ))}
        </View>
        <Pressable
          onPress={() => {
            onClose();
            router.push('/spaces');
          }}
          style={({ pressed }) => [styles.manageRow, pressed && styles.pressed]}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Gestionar espacios
          </ThemedText>
        </Pressable>
      </ActionsheetContent>
    </Actionsheet>
  );
}

function SwitcherRow({
  space,
  isActive,
  onPress,
}: {
  space: Space;
  isActive: boolean;
  onPress: () => void;
}) {
  const spacePalette = paletteById(space.paletteId);
  const overflow = space.memberIds.length - MaxRowLights;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.rowLights}>
        {space.memberIds.slice(0, MaxRowLights).map((uid, index) => (
          <View
            key={uid}
            style={[
              styles.dot,
              { backgroundColor: lightAt(spacePalette, index) },
              glow(lightAt(spacePalette, index), 8, '66'),
            ]}
          />
        ))}
        {overflow > 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            +{overflow}
          </ThemedText>
        )}
      </View>
      <ThemedText type={isActive ? 'smallBold' : 'default'} style={styles.rowText} numberOfLines={1}>
        {space.kind === 'personal' ? 'Personal' : space.name}
      </ThemedText>
      {isActive && <View style={[styles.activeDot, { backgroundColor: spacePalette.lens }]} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing[4],
    paddingBottom: Spacing[8],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[12],
    paddingVertical: Spacing[12],
    paddingHorizontal: Spacing[4],
    borderRadius: Radius.medium,
  },
  rowLights: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[4],
    minWidth: 56,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: Radius.pill,
  },
  rowText: {
    flex: 1,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
  },
  manageRow: {
    marginTop: Spacing[8],
    paddingVertical: Spacing[16],
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  pressed: {
    opacity: 0.7,
  },
});
