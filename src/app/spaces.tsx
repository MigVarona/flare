import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Eyebrow,
  GhostButton,
  GlowCard,
  GradientButton,
  GradientRule,
  ScreenHeader,
} from '@/components/brand';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetItem,
  ActionsheetItemText,
} from '@/components/ui/actionsheet';
import { MoreGlyph } from '@/components/icons';
import { ThemedText } from '@/components/themed-text';
import { lightAt, paletteById } from '@/constants/palettes';
import { Colors, glow, neonBorder, Radius, Spacing } from '@/constants/theme';
import { useSpace, type Space } from '@/context/space-context';
import { usePalette } from '@/hooks/use-palette';

const theme = Colors.dark;

type Mode = 'list' | 'create' | 'join';

/**
 * Where your circles live. One person has several — home, family, a trip — and this is
 * the one place they're switched, opened and entered. The tabs always show one space at
 * a time; this screen decides which.
 */
export default function SpacesScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('list');

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="flex-row justify-center px-6"
      contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 64 }}>
      <View className="w-full max-w-200 gap-4">
        <ScreenHeader title="Espacios" />
        {mode === 'list' && <SpaceList onCreate={() => setMode('create')} onJoin={() => setMode('join')} />}
        {mode === 'create' && <CreateSpace onBack={() => setMode('list')} />}
        {mode === 'join' && <JoinSpace onBack={() => setMode('list')} />}
      </View>
    </ScrollView>
  );
}

function SpaceList({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  const { spaces, spaceId, setActiveSpace, setSpaceArchived } = useSpace();
  const palette = usePalette();
  const [managing, setManaging] = useState<Space | null>(null);

  const activeSpaces = spaces.filter((space) => !space.archived);
  const archivedSpaces = spaces.filter((space) => space.archived);

  const selectSpace = (space: Space) => {
    setActiveSpace(space.id);
    router.back();
  };

  return (
    <View style={styles.stack}>
      {activeSpaces.map((space) => (
        <SpaceRow
          key={space.id}
          space={space}
          isActive={space.id === spaceId}
          onPress={() => selectSpace(space)}
          onManage={space.kind === 'shared' ? () => setManaging(space) : undefined}
        />
      ))}

      <View style={styles.actions}>
        <GhostButton title="Crear un espacio" color={palette.you} onPress={onCreate} />
        <GhostButton title="Entrar con una llave" color={palette.partner} onPress={onJoin} />
      </View>

      {archivedSpaces.length > 0 && (
        <View style={styles.archivedBlock}>
          <Eyebrow>Archivados</Eyebrow>
          {archivedSpaces.map((space) => (
            <SpaceRow
              key={space.id}
              space={space}
              isActive={space.id === spaceId}
              onPress={() => selectSpace(space)}
              onManage={() => setManaging(space)}
              faded
            />
          ))}
        </View>
      )}

      <Actionsheet isOpen={Boolean(managing)} onClose={() => setManaging(null)}>
        <ActionsheetBackdrop />
        <ActionsheetContent>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <ActionsheetItem
            onPress={() => {
              if (managing) void setSpaceArchived(managing.id, !managing.archived);
              setManaging(null);
            }}>
            <ActionsheetItemText>
              {managing?.archived ? 'Desarchivar este espacio' : 'Archivar este espacio'}
            </ActionsheetItemText>
          </ActionsheetItem>
          <ActionsheetItem onPress={() => setManaging(null)}>
            <ActionsheetItemText>Cancelar</ActionsheetItemText>
          </ActionsheetItem>
        </ActionsheetContent>
      </Actionsheet>
    </View>
  );
}

function SpaceRow({
  space,
  isActive,
  onPress,
  onManage,
  faded,
}: {
  space: Space;
  isActive: boolean;
  onPress: () => void;
  /** Archiving lives behind this — a visible control, not a gesture you'd have to be told about. */
  onManage?: () => void;
  /** An archived space isn't hidden, just dimmed — still here, just not the centre of it. */
  faded?: boolean;
}) {
  const spacePalette = paletteById(space.paletteId);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [faded && styles.faded, pressed && styles.pressed]}>
      <GlowCard color={isActive ? spacePalette.lens : undefined}>
        <View style={styles.rowHead}>
          <View style={styles.lightRow}>
            {space.memberIds.map((uid, index) => (
              <View
                key={uid}
                style={[
                  styles.light,
                  { backgroundColor: lightAt(spacePalette, index) },
                  glow(lightAt(spacePalette, index), 10, '66'),
                ]}
              />
            ))}
          </View>
          <View style={styles.rowActions}>
            {isActive && <Eyebrow color={spacePalette.lens}>Activo</Eyebrow>}
            {onManage && (
              <Pressable
                onPress={onManage}
                hitSlop={10}
                style={({ pressed }) => [styles.manageButton, pressed && styles.pressed]}>
                <MoreGlyph color={theme.textSecondary} size={16} />
              </Pressable>
            )}
          </View>
        </View>
        <ThemedText type="headline">{space.kind === 'personal' ? 'Personal' : space.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {space.kind === 'personal'
            ? 'Solo tú. Siempre está.'
            : space.memberIds.length === 1
              ? 'Todavía nadie más'
              : `${space.memberIds.length} personas`}
        </ThemedText>
      </GlowCard>
    </Pressable>
  );
}

function CreateSpace({ onBack }: { onBack: () => void }) {
  const { createSpace } = useSpace();
  const palette = usePalette();

  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [created, setCreated] = useState<{ spaceId: string; code: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setIsCreating(true);
    setError(null);
    try {
      setCreated(await createSpace(name));
    } catch {
      setError('No se pudo crear el espacio, inténtalo de nuevo');
    } finally {
      setIsCreating(false);
    }
  };

  if (!created) {
    return (
      <View style={styles.stack}>
        <View style={styles.titleBlock}>
          <Eyebrow color={palette.you}>Nuevo espacio</Eyebrow>
          <ThemedText themeColor="textSecondary">
            Ponle nombre y genera una llave para invitar. Caben hasta 8 personas.
          </ThemedText>
        </View>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Nombre del espacio"
          placeholderTextColor={theme.textSecondary}
          maxLength={28}
          style={styles.input}
        />

        {error && <ThemedText type="small" style={styles.error}>{error}</ThemedText>}

        <View style={styles.actions}>
          <GradientButton
            title="Crear el espacio"
            onPress={handleCreate}
            disabled={!name.trim()}
            isLoading={isCreating}
          />
          <BackLink onPress={onBack} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <View style={styles.titleBlock}>
        <Eyebrow color={palette.you}>La llave</Eyebrow>
        <ThemedText themeColor="textSecondary">Compártela para invitar a tu espacio.</ThemedText>
      </View>

      <View style={[styles.keyBox, neonBorder(palette.accent, '44'), glow(palette.accent, 40, '33')]}>
        <ThemedText type="key" selectable style={styles.centerText}>
          {created.code}
        </ThemedText>
        <GradientRule />
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          Compártela solo con quien quieras dentro. Caduca en una semana.
        </ThemedText>
      </View>

      <View style={styles.actions}>
        <GhostButton
          title="Compartir llave"
          color={palette.partner}
          onPress={() =>
            Share.share({ message: `Esta es la llave de nuestro espacio en Flare: ${created.code}` })
          }
        />
        <GradientButton title="Ir al espacio" onPress={() => router.back()} />
      </View>
    </View>
  );
}

function JoinSpace({ onBack }: { onBack: () => void }) {
  const { joinSpace } = useSpace();
  const palette = usePalette();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (code.trim().length < 6) return;
    setIsSubmitting(true);
    try {
      const result = await joinSpace(code);
      if (result.ok) {
        router.back();
        return;
      }
      setError(
        result.reason === 'expired'
          ? 'Esa llave ha caducado — pide una nueva'
          : result.reason === 'rate-limited'
            ? 'Demasiados intentos. Espera un poco antes de volver a probar'
            : result.reason === 'full'
              ? 'Ese espacio ya está completo'
              : 'Esa llave no abre ningún espacio',
      );
    } catch {
      setError('No se pudo entrar, inténtalo de nuevo');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.stack}>
      <View style={styles.titleBlock}>
        <Eyebrow color={palette.partner}>La llave</Eyebrow>
        <ThemedText themeColor="textSecondary">
          Te la pasa alguien que ya está dentro.
        </ThemedText>
      </View>

      <TextInput
        value={code}
        onChangeText={(value) => {
          setCode(value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
          setError(null);
        }}
        placeholder="••••••"
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="characters"
        maxLength={6}
        style={[styles.keyInput, neonBorder(palette.partner, '55'), glow(palette.partner, 24, '2A')]}
      />

      {error && <ThemedText type="small" style={styles.error}>{error}</ThemedText>}

      <View style={styles.actions}>
        <GradientButton
          title="Entrar"
          onPress={handleSubmit}
          disabled={code.trim().length < 6}
          isLoading={isSubmitting}
        />
        <BackLink onPress={onBack} />
      </View>
    </View>
  );
}

function BackLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.backLink}>
        Volver
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: Spacing[16],
  },
  titleBlock: {
    gap: Spacing[8],
  },
  archivedBlock: {
    gap: Spacing[12],
    marginTop: Spacing[8],
  },
  faded: {
    opacity: 0.55,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lightRow: {
    flexDirection: 'row',
    gap: Spacing[8],
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[8],
  },
  // Matches the icon-button language used everywhere else (Home's gear, the photo viewer):
  // a circle of chrome sized as a real touch target, not however big a label would make it.
  manageButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    backgroundColor: theme.backgroundElement,
  },
  light: {
    width: 12,
    height: 12,
    borderRadius: Radius.pill,
  },
  input: {
    backgroundColor: theme.backgroundElement,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing[16],
    paddingVertical: Spacing[16],
    fontSize: 16,
    color: theme.text,
    ...neonBorder(theme.border, 'FF'),
  },
  keyBox: {
    backgroundColor: theme.backgroundElement,
    borderRadius: Radius.large,
    paddingVertical: Spacing[32],
    paddingHorizontal: Spacing[24],
    gap: Spacing[24],
    alignItems: 'center',
  },
  keyInput: {
    backgroundColor: theme.backgroundElement,
    borderRadius: Radius.large,
    paddingVertical: Spacing[16],
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: 8,
    textAlign: 'center',
    color: theme.text,
  },
  centerText: {
    textAlign: 'center',
  },
  actions: {
    gap: Spacing[8],
    marginTop: Spacing[8],
  },
  error: {
    color: theme.destructive,
    textAlign: 'center',
  },
  backLink: {
    textAlign: 'center',
    paddingVertical: Spacing[8],
  },
  pressed: {
    opacity: 0.75,
  },
});
