import { FirebaseError } from 'firebase/app';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLockup, Eyebrow, GradientButton } from '@/components/brand';
import { GoogleMark } from '@/components/google-mark';
import { LegalModal } from '@/components/legal-modal';
import { ThemedText } from '@/components/themed-text';
import { Colors, MaxContentWidth, neonBorder, Radius, Spacing } from '@/constants/theme';
import { PrivacyMarkdown } from '@/constants/privacy';
import { TermsMarkdown } from '@/constants/terms';
import { useSpace } from '@/context/space-context';
import { GoogleSignInCancelled } from '@/lib/google-auth';

const theme = Colors.dark;

const errorMessages: Record<string, string> = {
  'auth/email-already-in-use': 'Ya existe una cuenta con ese correo',
  'auth/invalid-credential': 'Correo o contraseña incorrectos',
  'auth/invalid-email': 'Ese correo no parece válido',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres',
};

export default function WelcomeScreen() {
  const { signIn, signUp, signInGoogle } = useSpace();

  const [mode, setMode] = useState<'signIn' | 'signUp'>('signUp');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const canSubmit =
    email.trim().length > 0 &&
    password.length >= 6 &&
    (mode === 'signIn' || name.trim().length > 0);

  const handleGoogle = async () => {
    setError(null);
    setIsGoogleSubmitting(true);
    try {
      // Nothing to navigate to: the moment the account exists, the guard opens the app.
      // Your personal space is already there — inviting someone comes later, if it comes.
      await signInGoogle();
    } catch (err) {
      // Backing out of the Google sheet isn't a failure worth shouting about.
      if (!(err instanceof GoogleSignInCancelled)) {
        setError('No se pudo entrar con Google');
      }
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      if (mode === 'signUp') {
        await signUp(email.trim(), password, name);
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : null;
      setError((code && errorMessages[code]) ?? 'Algo ha ido mal, inténtalo de nuevo');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.scroller}
          contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <BrandLockup size={84} />
          </View>

          <View style={styles.form}>
            <Eyebrow>{mode === 'signUp' ? 'Crear cuenta' : 'Entrar'}</Eyebrow>

            {mode === 'signUp' && (
              <>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Tu nombre"
                  placeholderTextColor={theme.textSecondary}
                  maxLength={20}
                  style={styles.input}
                />
              </>
            )}

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Correo electrónico"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Contraseña"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry
              style={styles.input}
            />

            {mode === 'signUp' && (
              <View style={styles.termsRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  Al crear una cuenta, confirmas que tienes 16 años o más y aceptas los
                </ThemedText>
                <Pressable onPress={() => setShowTerms(true)} hitSlop={8}>
                  <ThemedText type="small" style={styles.termsLink}>
                    Términos de uso
                  </ThemedText>
                </Pressable>
                <ThemedText type="small" themeColor="textSecondary">
                  y la
                </ThemedText>
                <Pressable onPress={() => setShowPrivacy(true)} hitSlop={8}>
                  <ThemedText type="small" style={styles.termsLink}>
                    Política de Privacidad
                  </ThemedText>
                </Pressable>
              </View>
            )}

            {error && <ThemedText style={styles.error}>{error}</ThemedText>}

            <View style={styles.buttonWrapper}>
              <GradientButton
                title={mode === 'signUp' ? 'Crear cuenta' : 'Iniciar sesión'}
                onPress={handleSubmit}
                disabled={!canSubmit}
                isLoading={isSubmitting}
              />
            </View>

            <Pressable
              onPress={() => setMode(mode === 'signUp' ? 'signIn' : 'signUp')}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.switchMode}>
                {mode === 'signUp' ? 'Ya tengo cuenta' : 'Crear una cuenta nueva'}
              </ThemedText>
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <ThemedText type="small" themeColor="textSecondary">
                o
              </ThemedText>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              onPress={handleGoogle}
              disabled={isGoogleSubmitting}
              style={({ pressed }) => [
                styles.googleButton,
                pressed && styles.pressed,
                isGoogleSubmitting && styles.disabled,
              ]}>
              <GoogleMark size={18} />
              <ThemedText type="smallBold">
                {isGoogleSubmitting ? 'Entrando…' : 'Continuar con Google'}
              </ThemedText>
            </Pressable>
          </View>

        </ScrollView>
      </SafeAreaView>

      <LegalModal isOpen={showTerms} onClose={() => setShowTerms(false)} markdown={TermsMarkdown} />
      <LegalModal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} markdown={PrivacyMarkdown} />
    </View>
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
  },
  scroller: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing[24],
    paddingTop: Spacing[16],
    paddingBottom: Spacing[32],
    justifyContent: 'center',
    gap: Spacing[16],
  },
  hero: {
    alignItems: 'center',
    gap: Spacing[8],
    paddingTop: Spacing[32],
    paddingBottom: Spacing[16],
  },
  form: {
    gap: Spacing[8],
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
  error: {
    color: theme.you,
    fontSize: 14,
  },
  termsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing[8],
    paddingTop: Spacing[4],
  },
  termsLink: {
    color: theme.accent,
    textDecorationLine: 'underline',
  },
  buttonWrapper: {
    marginTop: Spacing[16],
  },
  switchMode: {
    textAlign: 'center',
    paddingVertical: Spacing[8],
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[16],
    marginVertical: Spacing[8],
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.border,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[8],
    borderRadius: Radius.pill,
    paddingVertical: Spacing[16],
    ...neonBorder(theme.border, 'FF'),
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.7,
  },
});
