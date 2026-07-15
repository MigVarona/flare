import { useState } from 'react';
import { Pressable, Share, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  BrandLockup,
  Eyebrow,
  GhostButton,
  GlowCard,
  GradientButton,
  GradientRule,
  IdentityDot,
} from '@/components/brand';
import { ThemedText } from '@/components/themed-text';
import {
  Colors,
  glow,
  MaxContentWidth,
  neonBorder,
  Radius,
  Spacing,
} from '@/constants/theme';
import { useCouple } from '@/context/couple-context';
import { usePalette } from '@/hooks/use-palette';

const theme = Colors.dark;

type Mode = 'choose' | 'create' | 'join';

export default function PairScreen() {
  const [mode, setMode] = useState<Mode>('choose');

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        {mode === 'choose' && <ChooseMode onSelect={setMode} />}
        {mode === 'create' && <CreateCouple onBack={() => setMode('choose')} />}
        {mode === 'join' && <JoinCouple onBack={() => setMode('choose')} />}
      </SafeAreaView>
    </View>
  );
}

function ChooseMode({ onSelect }: { onSelect: (mode: Mode) => void }) {
  const palette = usePalette();

  return (
    <View style={styles.content}>
      <View style={styles.brandLine}>
        <BrandLockup size={40} />
      </View>
      <View style={styles.titleBlock}>
        <Eyebrow>Paso 2 de 2</Eyebrow>
        <ThemedText type="title">
          Abre el espacio
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Uno lo crea y comparte la llave. La otra persona entra con ella.
        </ThemedText>
      </View>

      <OptionCard
        color={palette.you}
        label="Lo creo yo"
        title="Crear el espacio"
        description="Genera una llave para la otra persona"
        onPress={() => onSelect('create')}
      />
      <OptionCard
        color={palette.partner}
        label="Ya tengo llave"
        title="Entrar con una llave"
        description="El espacio ya existe y tienes la llave"
        onPress={() => onSelect('join')}
      />
    </View>
  );
}

function CreateCouple({ onBack }: { onBack: () => void }) {
  const { createCouple, confirmCouple } = useCouple();

  const [name, setName] = useState('');
  const palette = usePalette();
  const [pendingCouple, setPendingCouple] = useState<{ coupleId: string; code: string } | null>(
    null,
  );
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsCreating(true);
    setError(null);
    try {
      setPendingCouple(await createCouple(name));
    } catch {
      setError('No se pudo crear el espacio, inténtalo de nuevo');
    } finally {
      setIsCreating(false);
    }
  };

  const handleContinue = async () => {
    if (!pendingCouple) return;
    setIsConfirming(true);
    try {
      await confirmCouple(pendingCouple.coupleId);
    } catch {
      setError('No se pudo continuar, inténtalo de nuevo');
      setIsConfirming(false);
    }
  };

  if (!pendingCouple) {
    return (
      <View style={styles.content}>
        <View style={styles.titleBlock}>
          <Eyebrow color={palette.you}>Vuestro espacio</Eyebrow>
          <ThemedText type="title">
            Ponedle nombre
          </ThemedText>
          <ThemedText themeColor="textSecondary">
            Lo veréis cada vez que entréis.
          </ThemedText>
        </View>

        <TextInput
          value={name}
          onChangeText={(value) => {
            setName(value);
            setError(null);
          }}
          placeholder="Un nombre"
          placeholderTextColor={theme.textSecondary}
          maxLength={28}
          style={[styles.nameInput, neonBorder(palette.you, '55'), glow(palette.you, 24, '2A')]}
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
    <View style={styles.content}>
      <View style={styles.titleBlock}>
        <Eyebrow color={palette.you}>La llave de {name.trim()}</Eyebrow>
        <ThemedText type="title">
          Compártela
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Cuando la otra persona entre, el espacio se encenderá para los dos.
        </ThemedText>
      </View>

      <View style={[styles.keyBox, neonBorder(palette.accent, '44'), glow(palette.accent, 40, '33')]}>
        <View style={styles.waitingLights}>
          <IdentityDot isMine size={22} />
          <View style={styles.waitingLine} />
          <IdentityDot isMine={false} size={22} />
        </View>
        <ThemedText type="key" selectable style={styles.keyText}>
          {pendingCouple.code}
        </ThemedText>
        <GradientRule />
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          Llave privada para entrar una sola persona más.
        </ThemedText>
      </View>

      {error && <ThemedText type="small" style={styles.error}>{error}</ThemedText>}

      <View style={styles.actions}>
        <GhostButton
          title="Compartir llave"
          color={palette.partner}
          onPress={() =>
            Share.share({
              message: `Esta es la llave de ${name.trim()}, nuestro espacio en Churri: ${pendingCouple.code}`,
            })
          }
        />
        <GradientButton
          title="Ya la compartí, entrar"
          onPress={handleContinue}
          isLoading={isConfirming}
        />
        <BackLink onPress={onBack} />
      </View>
    </View>
  );
}

function JoinCouple({ onBack }: { onBack: () => void }) {
  const { joinCouple } = useCouple();
  const palette = usePalette();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (code.trim().length < 6) return;
    setIsSubmitting(true);
    try {
      const isValid = await joinCouple(code);
      if (!isValid) {
        setError('Esa llave no existe');
      }
    } catch {
      setError('No se pudo entrar, inténtalo de nuevo');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.content}>
      <View style={styles.titleBlock}>
        <Eyebrow color={palette.partner}>La llave del espacio</Eyebrow>
        <ThemedText type="title">
          Entra en el espacio
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

function OptionCard({
  color,
  label,
  title,
  description,
  onPress,
}: {
  color: string;
  label: string;
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <GlowCard color={color}>
        <Eyebrow color={color}>{label}</Eyebrow>
        <ThemedText type="headline">
          {title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {description}
        </ThemedText>
      </GlowCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.background,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing[24],
  },
  content: {
    gap: Spacing[16],
  },
  titleBlock: {
    gap: Spacing[8],
    marginBottom: Spacing[8],
  },
  brandLine: {
    alignItems: 'center',
    marginBottom: Spacing[16],
  },

  keyBox: {
    backgroundColor: theme.backgroundElement,
    borderRadius: Radius.large,
    paddingVertical: Spacing[32],
    paddingHorizontal: Spacing[24],
    gap: Spacing[24],
    alignItems: 'center',
  },
  keyText: {
    textAlign: 'center',
  },
  waitingLights: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[12],
  },
  waitingLine: {
    width: 52,
    height: 1,
    backgroundColor: theme.border,
  },
  centerText: {
    textAlign: 'center',
  },
  nameInput: {
    backgroundColor: theme.backgroundElement,
    borderRadius: Radius.large,
    paddingHorizontal: Spacing[16],
    paddingVertical: Spacing[16],
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
    color: theme.text,
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
  actions: {
    gap: Spacing[8],
    marginTop: Spacing[8],
  },
  error: {
    color: theme.you,
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
