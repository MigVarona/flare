import { useState } from 'react';
import { Pressable, Share, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Eyebrow, GhostButton, GlowCard, GradientButton, GradientRule } from '@/components/brand';
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
  return (
    <View style={styles.content}>
      <View style={styles.titleBlock}>
        <Eyebrow>Paso 2 de 2</Eyebrow>
        <ThemedText type="subtitle" style={styles.heading}>
          Abre el espacio
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Uno de los dos lo crea y comparte la llave. El otro entra con ella.
        </ThemedText>
      </View>

      <OptionCard
        color={theme.you}
        label="Lo creo yo"
        title="Crear el espacio"
        description="Genera una llave para tu pareja"
        onPress={() => onSelect('create')}
      />
      <OptionCard
        color={theme.partner}
        label="Ya tengo llave"
        title="Entrar con una llave"
        description="Tu pareja ya ha creado el espacio"
        onPress={() => onSelect('join')}
      />
    </View>
  );
}

function CreateCouple({ onBack }: { onBack: () => void }) {
  const { createCouple, confirmCouple } = useCouple();

  const [name, setName] = useState('');
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
          <Eyebrow color={theme.you}>Vuestro espacio</Eyebrow>
          <ThemedText type="subtitle" style={styles.heading}>
            Ponedle nombre
          </ThemedText>
          <ThemedText themeColor="textSecondary">
            Lo veréis los dos cada vez que entréis.
          </ThemedText>
        </View>

        <TextInput
          value={name}
          onChangeText={(value) => {
            setName(value);
            setError(null);
          }}
          placeholder="Ej. Nuestro rincón"
          placeholderTextColor={theme.textSecondary}
          maxLength={28}
          style={[styles.nameInput, glow(theme.you, 24, '2A')]}
        />

        {error && <ThemedText style={styles.error}>{error}</ThemedText>}

        <View style={styles.actions}>
          <GradientButton
            title="Crear el espacio"
            onPress={handleCreate}
            disabled={!name.trim() || isCreating}
          />
          <BackLink onPress={onBack} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.content}>
      <View style={styles.titleBlock}>
        <Eyebrow color={theme.you}>La llave de {name.trim()}</Eyebrow>
        <ThemedText type="subtitle" style={styles.heading}>
          Compártela con tu pareja
        </ThemedText>
      </View>

      <View style={[styles.keyBox, glow(theme.accent, 40, '33')]}>
        <ThemedText selectable style={styles.keyText}>
          {pendingCouple.code}
        </ThemedText>
        <GradientRule />
      </View>

      {error && <ThemedText style={styles.error}>{error}</ThemedText>}

      <View style={styles.actions}>
        <GhostButton
          title="Compartir llave"
          color={theme.partner}
          onPress={() =>
            Share.share({
              message: `Entra en ${name.trim()}, nuestro espacio en Churriapp, con esta llave: ${pendingCouple.code}`,
            })
          }
        />
        <GradientButton
          title="Ya la compartí, entrar"
          onPress={handleContinue}
          disabled={isConfirming}
        />
        <BackLink onPress={onBack} />
      </View>
    </View>
  );
}

function JoinCouple({ onBack }: { onBack: () => void }) {
  const { joinCouple } = useCouple();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
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
        <Eyebrow color={theme.partner}>La llave de tu pareja</Eyebrow>
        <ThemedText type="subtitle" style={styles.heading}>
          Entra en el espacio
        </ThemedText>
      </View>

      <TextInput
        value={code}
        onChangeText={(value) => {
          setCode(value);
          setError(null);
        }}
        placeholder="••••••"
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="characters"
        style={[styles.keyInput, glow(theme.partner, 24, '2A')]}
      />

      {error && <ThemedText style={styles.error}>{error}</ThemedText>}

      <View style={styles.actions}>
        <GradientButton title="Entrar" onPress={handleSubmit} disabled={isSubmitting} />
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
        <ThemedText type="default" style={styles.optionTitle}>
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
    paddingHorizontal: Spacing.four,
  },
  content: {
    gap: Spacing.three,
  },
  titleBlock: {
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  heading: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  optionTitle: {
    fontWeight: '700',
    fontSize: 18,
  },
  keyBox: {
    backgroundColor: theme.backgroundElement,
    borderRadius: Radius.large,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
    alignItems: 'center',
    ...neonBorder(theme.accent, '44'),
  },
  keyText: {
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '800',
    letterSpacing: 10,
    color: theme.text,
    textAlign: 'center',
  },
  nameInput: {
    backgroundColor: theme.backgroundElement,
    borderRadius: Radius.large,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    fontSize: 20,
    fontWeight: '600',
    color: theme.text,
    ...neonBorder(theme.you, '55'),
  },
  keyInput: {
    backgroundColor: theme.backgroundElement,
    borderRadius: Radius.large,
    paddingVertical: Spacing.four,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 8,
    textAlign: 'center',
    color: theme.text,
    ...neonBorder(theme.partner, '55'),
  },
  actions: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  error: {
    color: theme.you,
    fontSize: 14,
    textAlign: 'center',
  },
  backLink: {
    textAlign: 'center',
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.75,
  },
});
