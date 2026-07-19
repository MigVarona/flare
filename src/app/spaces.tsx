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
  const { spaces, spaceId, setActiveSpace } = useSpace();
  const palette = usePalette();

  return (
    <View style={styles.stack}>
      {spaces.map((space) => (
        <SpaceRow
          key={space.id}
          space={space}
          isActive={space.id === spaceId}
          onPress={() => {
            setActiveSpace(space.id);
            router.back();
          }}
        />
      ))}

      <View style={styles.actions}>
        <GhostButton title="Crear un espacio" color={palette.you} onPress={onCreate} />
        <GhostButton title="Entrar con una llave" color={palette.partner} onPress={onJoin} />
      </View>
    </View>
  );
}

function SpaceRow({
  space,
  isActive,
  onPress,
}: {
  space: Space;
  isActive: boolean;
  onPress: () => void;
}) {
  const spacePalette = paletteById(space.paletteId);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
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
          {isActive && <Eyebrow color={spacePalette.lens}>Ahora</Eyebrow>}
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
            Ponle nombre — Casa, Familia, un viaje — y genera una llave para que entren los tuyos.
            Caben hasta 8.
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
        <ThemedText themeColor="textSecondary">
          Compártela con quien quieras dentro. Sirve hasta que el espacio se llene.
        </ThemedText>
      </View>

      <View style={[styles.keyBox, neonBorder(palette.accent, '44'), glow(palette.accent, 40, '33')]}>
        <ThemedText type="key" selectable style={styles.centerText}>
          {created.code}
        </ThemedText>
        <GradientRule />
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          Quien la tenga puede entrar, así que dásela solo a los tuyos.
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
      const isValid = await joinSpace(code);
      if (!isValid) {
        setError('Esa llave no abre ningún espacio');
      } else {
        router.back();
      }
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
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lightRow: {
    flexDirection: 'row',
    gap: Spacing[8],
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
