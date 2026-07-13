import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Eyebrow, GhostButton, GlowCard, IdentityDot } from '@/components/brand';
import { ThemedText } from '@/components/themed-text';
import { Colors, glow, MaxContentWidth, neonBorder, Radius, Spacing } from '@/constants/theme';
import { useCouple } from '@/context/couple-context';

const theme = Colors.dark;

const LIMIT_OPTIONS = [3, 5, 10, 20, 50];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
    user,
    spaceName,
    inviteCode,
    isWaitingForPartner,
    dailyMessageLimit,
    renameSpace,
    setDailyMessageLimit,
    signOutUser,
  } = useCouple();

  const [name, setName] = useState(spaceName ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const hasNameChanged = name.trim().length > 0 && name.trim() !== (spaceName ?? '');

  const handleRename = async () => {
    setIsSaving(true);
    try {
      await renameSpace(name);
      setSavedAt(Date.now());
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.six },
      ]}>
      <View style={styles.inner}>
        <View style={styles.header}>
          <Eyebrow>Ajustes</Eyebrow>
          <ThemedText type="title" style={styles.title}>
            {spaceName ?? 'Vuestro espacio'}
          </ThemedText>
        </View>

        <GlowCard>
          <Eyebrow>Quiénes sois</Eyebrow>
          <View style={styles.memberRow}>
            <IdentityDot isMine />
            <View style={styles.memberText}>
              <ThemedText type="smallBold">Tú</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {user?.email ?? '—'}
              </ThemedText>
            </View>
          </View>
          <View style={styles.memberRow}>
            <IdentityDot isMine={false} />
            <View style={styles.memberText}>
              <ThemedText type="smallBold">Tu pareja</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {isWaitingForPartner ? 'Todavía no ha entrado' : 'Dentro del espacio'}
              </ThemedText>
            </View>
          </View>
        </GlowCard>

        <GlowCard>
          <Eyebrow>Nombre del espacio</Eyebrow>
          <TextInput
            value={name}
            onChangeText={(value) => {
              setName(value);
              setSavedAt(null);
            }}
            placeholder="Ej. Nuestro rincón"
            placeholderTextColor={theme.textSecondary}
            maxLength={28}
            style={styles.input}
          />
          {hasNameChanged && (
            <View style={styles.cardAction}>
              <GhostButton
                title={isSaving ? 'Guardando…' : 'Guardar nombre'}
                color={theme.you}
                disabled={isSaving}
                onPress={handleRename}
              />
            </View>
          )}
          {savedAt && !hasNameChanged && (
            <ThemedText type="small" style={{ color: theme.partner }}>
              Guardado
            </ThemedText>
          )}
        </GlowCard>

        <GlowCard>
          <Eyebrow>Mensajes al día</Eyebrow>
          <ThemedText type="small" themeColor="textSecondary">
            Cuántos podéis enviaros cada uno. Menos es más.
          </ThemedText>
          <View style={styles.limitRow}>
            {LIMIT_OPTIONS.map((limit) => {
              const isActive = limit === dailyMessageLimit;
              return (
                <Pressable
                  key={limit}
                  onPress={() => setDailyMessageLimit(limit)}
                  style={({ pressed }) => [
                    styles.limitChip,
                    isActive
                      ? [
                          { backgroundColor: `${theme.you}26` },
                          neonBorder(theme.you, 'AA'),
                          glow(theme.you, 14, '44'),
                        ]
                      : neonBorder(theme.border, 'FF'),
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText
                    type="smallBold"
                    style={isActive ? { color: theme.you } : { color: theme.textSecondary }}>
                    {limit}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </GlowCard>

        {isWaitingForPartner && inviteCode && (
          <GlowCard color={theme.accent}>
            <Eyebrow color={theme.accent}>La llave</Eyebrow>
            <ThemedText selectable style={styles.keyText}>
              {inviteCode}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Tu pareja la necesita para entrar
            </ThemedText>
          </GlowCard>
        )}

        <View style={styles.footer}>
          <GhostButton title="Cerrar sesión" onPress={signOutUser} />
          <Pressable onPress={() => router.back()} style={({ pressed }) => pressed && styles.pressed}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.back}>
              Volver
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.background,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.one,
  },
  memberText: {
    gap: Spacing.half,
  },
  input: {
    backgroundColor: theme.background,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
    color: theme.text,
    ...neonBorder(theme.border, 'FF'),
  },
  cardAction: {
    marginTop: Spacing.one,
  },
  limitRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  limitChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Radius.medium,
  },
  keyText: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: 8,
  },
  footer: {
    gap: Spacing.two,
    marginTop: Spacing.four,
  },
  back: {
    textAlign: 'center',
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
