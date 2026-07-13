import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Eyebrow, GhostButton, GlowCard, IdentityDot } from '@/components/brand';
import { PalettePicker } from '@/components/palette-picker';
import { ThemedText } from '@/components/themed-text';
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
} from '@/components/ui/alert-dialog';
import { Colors, glow } from '@/constants/theme';
import { useCouple } from '@/context/couple-context';
import { useNotice } from '@/hooks/use-notice';

const theme = Colors.dark;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
    user,
    spaceName,
    inviteCode,
    isWaitingForPartner,
    myName,
    partnerName,
    renameSpace,
    renameMe,
    palette,
    setPalette,
    signOutUser,
  } = useCouple();

  const notice = useNotice();

  const [name, setName] = useState(spaceName ?? '');
  const [ownName, setOwnName] = useState(myName);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingOwn, setIsSavingOwn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // The names arrive from Firestore after the first render, so the fields have to catch up.
  useEffect(() => setName(spaceName ?? ''), [spaceName]);
  useEffect(() => setOwnName(myName), [myName]);

  const hasNameChanged = name.trim().length > 0 && name.trim() !== (spaceName ?? '');
  const hasOwnNameChanged = ownName.trim().length > 0 && ownName.trim() !== myName;

  const handleRename = async () => {
    setIsSaving(true);
    try {
      await renameSpace(name);
      notice('Vuestro espacio ya se llama así', 'both');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePalette = async (id: string) => {
    await setPalette(id);
    notice('Vuestros colores', 'both');
  };

  const handleRenameMe = async () => {
    setIsSavingOwn(true);
    try {
      await renameMe(ownName);
      notice(`Ahora te llamas ${ownName.trim()}`);
    } finally {
      setIsSavingOwn(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="flex-row justify-center px-6"
      contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 64 }}>
      <View className="w-full max-w-[800px] gap-4">
        <View className="mb-2 gap-2">
          <Eyebrow>Ajustes</Eyebrow>
          <ThemedText type="title" className="text-[34px] leading-10 font-extrabold tracking-tight">
            {spaceName ?? 'Vuestro espacio'}
          </ThemedText>
        </View>

        <GlowCard>
          <Eyebrow>Quiénes sois</Eyebrow>
          <View className="flex-row items-center gap-4 py-1">
            <IdentityDot isMine />
            <View className="gap-0.5">
              <ThemedText type="smallBold">{myName}</ThemedText>
              <ThemedText type="small" className="text-muted-foreground">
                {user?.email ?? '—'}
              </ThemedText>
            </View>
          </View>
          <View className="flex-row items-center gap-4 py-1">
            <IdentityDot isMine={false} />
            <View className="gap-0.5">
              <ThemedText type="smallBold">{partnerName}</ThemedText>
              <ThemedText type="small" className="text-muted-foreground">
                {isWaitingForPartner ? 'Todavía no ha entrado' : 'Dentro del espacio'}
              </ThemedText>
            </View>
          </View>
        </GlowCard>

        <GlowCard>
          <Eyebrow>Cómo te llamas</Eyebrow>
          <TextInput
            value={ownName}
            onChangeText={setOwnName}
            placeholder="Tu nombre"
            placeholderTextColor={theme.textSecondary}
            maxLength={20}
            className="rounded-2xl border border-border bg-background px-4 py-4 text-base text-foreground"
          />
          {hasOwnNameChanged && (
            <View className="mt-1">
              <GhostButton
                title={isSavingOwn ? 'Guardando…' : 'Guardar'}
                color={palette.you}
                disabled={isSavingOwn}
                onPress={handleRenameMe}
              />
            </View>
          )}
        </GlowCard>

        <GlowCard>
          <Eyebrow>Nombre del espacio</Eyebrow>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ej. Nuestro rincón"
            placeholderTextColor={theme.textSecondary}
            maxLength={28}
            className="rounded-2xl border border-border bg-background px-4 py-4 text-base text-foreground"
          />
          {hasNameChanged && (
            <View className="mt-1">
              <GhostButton
                title={isSaving ? 'Guardando…' : 'Guardar nombre'}
                color={palette.you}
                disabled={isSaving}
                onPress={handleRename}
              />
            </View>
          )}
        </GlowCard>

        <GlowCard>
          <Eyebrow>Vuestros colores</Eyebrow>
          <ThemedText type="small" className="text-muted-foreground">
            Uno es tuyo y otro es suyo. Cambiarlos los cambia para los dos.
          </ThemedText>
          <PalettePicker selectedId={palette.id} onSelect={handlePalette} />
        </GlowCard>

        {isWaitingForPartner && inviteCode && (
          <GlowCard color={palette.accent}>
            <Eyebrow color={palette.accent}>La llave</Eyebrow>
            <ThemedText selectable className="text-[28px] leading-9 font-extrabold tracking-[8px]">
              {inviteCode}
            </ThemedText>
            <ThemedText type="small" className="text-muted-foreground">
              Tu pareja la necesita para entrar
            </ThemedText>
          </GlowCard>
        )}

        <View className="mt-6 gap-2">
          <GhostButton title="Cerrar sesión" onPress={() => setIsSigningOut(true)} />
          <Pressable onPress={() => router.back()} className="active:opacity-70">
            <ThemedText type="small" className="py-2 text-center text-muted-foreground">
              Volver
            </ThemedText>
          </Pressable>
        </View>
      </View>

      <AlertDialog isOpen={isSigningOut} onClose={() => setIsSigningOut(false)}>
        <AlertDialogBackdrop />
        <AlertDialogContent className="rounded-3xl border border-border bg-card">
          <AlertDialogHeader>
            <ThemedText className="text-lg font-bold">¿Cerrar sesión?</ThemedText>
          </AlertDialogHeader>
          <AlertDialogBody className="mt-2 mb-4">
            <ThemedText type="small" className="leading-6 text-muted-foreground">
              El espacio y todo lo que hay dentro sigue ahí. Podrás volver a entrar con tu correo.
            </ThemedText>
          </AlertDialogBody>
          <AlertDialogFooter className="gap-2">
            <Pressable
              onPress={() => setIsSigningOut(false)}
              className="flex-1 items-center rounded-full border border-border py-3 active:opacity-70">
              <ThemedText type="smallBold" className="text-muted-foreground">
                Quedarme
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={signOutUser}
              className="flex-1 items-center rounded-full border border-destructive/60 py-3 active:opacity-70">
              <ThemedText type="smallBold" className="text-destructive">
                Salir
              </ThemedText>
            </Pressable>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScrollView>
  );
}
