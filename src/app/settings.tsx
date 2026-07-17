import { FirebaseError } from 'firebase/app';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Eyebrow, GhostButton, GlowCard, IdentityDot, ScreenHeader } from '@/components/brand';
import { LegalModal } from '@/components/legal-modal';
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
import { Colors } from '@/constants/theme';
import { PrivacyMarkdown } from '@/constants/privacy';
import { TermsMarkdown } from '@/constants/terms';
import { useCouple } from '@/context/couple-context';
import { GoogleSignInCancelled } from '@/lib/google-auth';
import { useNotice } from '@/hooks/use-notice';
import { usePalette } from '@/hooks/use-palette';

const theme = Colors.dark;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
    user,
    inviteCode,
    isWaitingForPartner,
    myName,
    partnerName,
    partnerUid,
    renameMe,
    paletteId,
    setPalette,
    signOutUser,
    leaveCouple,
    deleteAccount,
    isGoogleAccount,
  } = useCouple();

  const notice = useNotice();
  const palette = usePalette();

  const [ownName, setOwnName] = useState(myName);
  const [isSavingOwn, setIsSavingOwn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isLeavingNow, setIsLeavingNow] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [password, setPassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeletingNow, setIsDeletingNow] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  // The space always goes; what changes is whether you take someone else's things with it.
  const isAlone = !partnerUid;

  // The names arrive from Firestore after the first render, so the fields have to catch up.
  useEffect(() => setOwnName(myName), [myName]);

  const hasOwnNameChanged = ownName.trim().length > 0 && ownName.trim() !== myName;

  const handleRenameMe = async () => {
    setIsSavingOwn(true);
    try {
      await renameMe(ownName);
    } finally {
      setIsSavingOwn(false);
    }
  };

  const handleLeave = async () => {
    setIsLeavingNow(true);
    try {
      await leaveCouple();
      // No space, no screen to return to: the guard drops you back at pairing.
    } catch {
      setIsLeavingNow(false);
      setIsLeaving(false);
      notice('No se ha podido salir. Inténtalo de nuevo');
    }
  };

  const closeDelete = () => {
    setIsDeleting(false);
    setPassword('');
    setDeleteError(null);
  };

  const handleDelete = async () => {
    setDeleteError(null);
    setIsDeletingNow(true);
    try {
      await deleteAccount(password);
      // Nothing to route to: with no account, the app falls back to the welcome screen.
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : null;
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        setDeleteError('La contraseña no es correcta');
      } else if (code === 'auth/user-mismatch') {
        setDeleteError('Esa cuenta de Google no es la tuya');
      } else if (err instanceof GoogleSignInCancelled) {
        setDeleteError('Hay que confirmar con Google para poder borrarla');
      } else {
        setDeleteError('No se ha podido borrar. Inténtalo de nuevo');
      }
      setIsDeletingNow(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="flex-row justify-center px-6"
      contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 64 }}>
      <View className="w-full max-w-200 gap-4">
        <ScreenHeader title="Ajustes" />

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
          <Eyebrow>Vuestros colores</Eyebrow>
          <PalettePicker selectedId={paletteId} onSelect={setPalette} />
        </GlowCard>

        {isWaitingForPartner && inviteCode && (
          <GlowCard color={palette.accent}>
            <Eyebrow color={palette.accent}>La llave</Eyebrow>
            <ThemedText type="key" selectable>
              {inviteCode}
            </ThemedText>
            <ThemedText type="small" className="text-muted-foreground">
              Hace falta para entrar
            </ThemedText>
          </GlowCard>
        )}

        <GlowCard>
          <Eyebrow>Legal</Eyebrow>
          <Pressable onPress={() => setShowTerms(true)} className="py-1 active:opacity-70">
            <ThemedText type="smallBold">Términos de uso</ThemedText>
          </Pressable>
          <Pressable onPress={() => setShowPrivacy(true)} className="py-1 active:opacity-70">
            <ThemedText type="smallBold">Política de Privacidad</ThemedText>
          </Pressable>
        </GlowCard>

        {/* Signing out is not dangerous — you come back and everything is where you left it.
            Putting it in with the irreversible things would cry wolf, and then nobody reads
            the red box when it matters. */}
        <View className="mt-2">
          <GhostButton title="Cerrar sesión" onPress={() => setIsSigningOut(true)} />
        </View>

        {/* Everything below this line destroys something, and none of it can be undone. It
            sits at the bottom, behind its own red edge, because that is where people have
            learned to expect it — and because nobody should meet it by accident on the way
            to changing their name. */}
        <View className="mt-12">
          <GlowCard color={theme.destructive}>
            <Eyebrow color={theme.destructive}>Zona de peligro</Eyebrow>

            <View className="mt-2 gap-1">
              <ThemedText type="smallBold">Salir del espacio</ThemedText>
              <ThemedText type="small" className="leading-5 text-muted-foreground">
                {isAlone
                  ? 'Nadie ha entrado todavía, así que el espacio se borra sin más. Sigues teniendo tu cuenta y puedes crear otro.'
                  : `El espacio se cierra y todo lo que hay dentro se borra, también para ${partnerName}. Ninguno de los dos pierde su cuenta: los dos volvéis a la pantalla de emparejar y podéis empezar otro.`}
              </ThemedText>
              <View className="mt-2">
                <GhostButton
                  title="Salir del espacio"
                  color={theme.destructive}
                  onPress={() => setIsLeaving(true)}
                />
              </View>
            </View>

            <View className="mt-6 gap-1 border-t border-destructive/25 pt-6">
              <ThemedText type="smallBold">Eliminar mi cuenta</ThemedText>
              <ThemedText type="small" className="leading-5 text-muted-foreground">
                {isAlone
                  ? 'Desaparecen tu cuenta y el espacio con todo lo que contiene.'
                  : `Desaparecen tu cuenta y el espacio con todo lo que contiene. ${partnerName} conserva la suya y podrá empezar uno nuevo.`}
              </ThemedText>
              <View className="mt-2">
                <GhostButton
                  title="Eliminar mi cuenta"
                  color={theme.destructive}
                  onPress={() => setIsDeleting(true)}
                />
              </View>
            </View>
          </GlowCard>
        </View>
      </View>

      <AlertDialog isOpen={isSigningOut} onClose={() => setIsSigningOut(false)}>
        <AlertDialogBackdrop />
        <AlertDialogContent className="rounded-3xl border border-border bg-card">
          <AlertDialogHeader>
            <ThemedText type="headline">¿Cerrar sesión?</ThemedText>
          </AlertDialogHeader>
          <AlertDialogBody className="mt-2 mb-4">
            <ThemedText type="small" className="leading-6 text-muted-foreground">
              El espacio y todo lo que hay dentro sigue donde está. Puedes volver cuando quieras.
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

      <AlertDialog isOpen={isLeaving} onClose={() => setIsLeaving(false)}>
        <AlertDialogBackdrop />
        <AlertDialogContent className="rounded-3xl border border-border bg-card">
          <AlertDialogHeader>
            <ThemedText type="headline">¿Salir del espacio?</ThemedText>
          </AlertDialogHeader>
          <AlertDialogBody className="mt-2 mb-4">
            <ThemedText type="small" className="leading-6 text-muted-foreground">
              {isAlone
                ? 'Nadie ha entrado todavía, así que el espacio se borra sin más. Sigues teniendo tu cuenta y podrás crear otro o entrar en uno con una llave.'
                : `El espacio es de los dos y no sigue sin los dos: se cierra, y las fotos, los recordatorios y los mensajes se borran también para ${partnerName}. Ninguno de los dos pierde su cuenta — volvéis los dos a la pantalla de emparejar.`}
            </ThemedText>
          </AlertDialogBody>
          <AlertDialogFooter className="gap-2">
            <Pressable
              onPress={() => setIsLeaving(false)}
              disabled={isLeavingNow}
              className="flex-1 items-center rounded-full border border-border py-3 active:opacity-70">
              <ThemedText type="smallBold" className="text-muted-foreground">
                Quedarme
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={handleLeave}
              disabled={isLeavingNow}
              className="flex-1 items-center rounded-full border border-destructive/60 py-3 active:opacity-70 disabled:opacity-40">
              <ThemedText type="smallBold" className="text-destructive">
                {isLeavingNow ? 'Saliendo…' : 'Salir'}
              </ThemedText>
            </Pressable>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog isOpen={isDeleting} onClose={closeDelete}>
        <AlertDialogBackdrop />
        <AlertDialogContent className="rounded-3xl border border-destructive/40 bg-card">
          <AlertDialogHeader>
            <ThemedText type="headline">¿Eliminar tu cuenta?</ThemedText>
          </AlertDialogHeader>
          <AlertDialogBody className="mt-2 mb-4 gap-3">
            <ThemedText type="small" className="leading-6 text-muted-foreground">
              {isAlone
                ? 'Se van tu cuenta y el espacio entero: las fotos, los recordatorios y lo que hayas escrito. No hay vuelta atrás.'
                : `Se va tu cuenta, y con ella el espacio: las fotos, los recordatorios y los mensajes se borran también para ${partnerName}, que conserva su cuenta y podrá empezar un espacio nuevo. No hay vuelta atrás.`}
            </ThemedText>

            {isGoogleAccount ? (
              <ThemedText type="small" className="leading-6 text-muted-foreground">
                Google te pedirá que confirmes que eres tú antes de borrarla.
              </ThemedText>
            ) : (
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Tu contraseña"
                placeholderTextColor={theme.textSecondary}
                secureTextEntry
                autoCapitalize="none"
                className="rounded-2xl border border-border bg-background px-4 py-4 text-base text-foreground"
              />
            )}

            {deleteError && (
              <ThemedText type="small" className="text-destructive">
                {deleteError}
              </ThemedText>
            )}
          </AlertDialogBody>
          <AlertDialogFooter className="gap-2">
            <Pressable
              onPress={closeDelete}
              disabled={isDeletingNow}
              className="flex-1 items-center rounded-full border border-border py-3 active:opacity-70">
              <ThemedText type="smallBold" className="text-muted-foreground">
                Cancelar
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={handleDelete}
              disabled={isDeletingNow || (!isGoogleAccount && !password)}
              className="flex-1 items-center rounded-full border border-destructive bg-destructive/15 py-3 active:opacity-70 disabled:opacity-40">
              <ThemedText type="smallBold" className="text-destructive">
                {isDeletingNow ? 'Eliminando…' : 'Eliminar'}
              </ThemedText>
            </Pressable>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <LegalModal isOpen={showTerms} onClose={() => setShowTerms(false)} markdown={TermsMarkdown} />
      <LegalModal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} markdown={PrivacyMarkdown} />
    </ScrollView>
  );
}
