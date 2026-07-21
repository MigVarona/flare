import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

import { lightAt, paletteById } from '@/constants/palettes';
import { Colors, glow, Radius, Spacing } from '@/constants/theme';
import { useSpace, type Space } from '@/context/space-context';

const theme = Colors.dark;

/** How many lights a row shows before folding the rest into "+N" — past this, the row is
 * naming people, not showing them. */
const MaxRowLights = 3;

export type SwitcherAnchor = { top: number; right: number };

/**
 * The fast way to switch spaces — a menu anchored right under the pill that opened it, not
 * a sheet arriving from some other part of the screen. One tap on where you are, one tap on
 * where you're going. The full spaces screen still exists for the slower work (creating,
 * joining, archiving); this is only ever for "which one am I looking at."
 */
export function SpaceSwitcherMenu({
  isOpen,
  anchor,
  onClose,
}: {
  isOpen: boolean;
  /** Where the pill actually measured to, in window coordinates — null until it has. */
  anchor: SwitcherAnchor | null;
  onClose: () => void;
}) {
  const { spaces, spaceId, setActiveSpace } = useSpace();
  // Archived spaces are deliberately out of the way everywhere else; this quick menu isn't
  // where that changes. They're still one tap away, inside "Gestionar espacios".
  const activeSpaces = spaces.filter((space) => !space.archived);

  const select = (id: string) => {
    setActiveSpace(id);
    onClose();
  };

  if (!anchor) return null;

  return (
    <Modal visible={isOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.menu, { top: anchor.top, right: anchor.right }]}>
        {activeSpaces.map((space) => (
          <SwitcherRow
            key={space.id}
            space={space}
            isActive={space.id === spaceId}
            onPress={() => select(space.id)}
          />
        ))}
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
      </View>
    </Modal>
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
  menu: {
    position: 'absolute',
    width: 230,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.backgroundElement,
    paddingVertical: Spacing[8],
    paddingHorizontal: Spacing[8],
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[12],
    paddingVertical: Spacing[8],
    paddingHorizontal: Spacing[8],
    borderRadius: Radius.small,
  },
  rowLights: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[4],
    minWidth: 44,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: Radius.pill,
  },
  rowText: {
    flex: 1,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: Radius.pill,
  },
  manageRow: {
    marginTop: Spacing[4],
    paddingVertical: Spacing[12],
    paddingHorizontal: Spacing[8],
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  pressed: {
    opacity: 0.7,
  },
});
