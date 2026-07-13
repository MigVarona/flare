import { router } from 'expo-router';
import { FirebaseError } from 'firebase/app';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark, Eyebrow, GradientButton } from '@/components/brand';
import { ThemedText } from '@/components/themed-text';
import { Colors, MaxContentWidth, neonBorder, Radius, Spacing } from '@/constants/theme';
import { useCouple } from '@/context/couple-context';

const theme = Colors.dark;

const errorMessages: Record<string, string> = {
  'auth/email-already-in-use': 'Ya existe una cuenta con ese correo',
  'auth/invalid-credential': 'Correo o contraseña incorrectos',
  'auth/invalid-email': 'Ese correo no parece válido',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres',
};

export default function WelcomeScreen() {
  const { signIn, signUp } = useCouple();

  const [mode, setMode] = useState<'signIn' | 'signUp'>('signUp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      if (mode === 'signUp') {
        await signUp(email.trim(), password);
      } else {
        await signIn(email.trim(), password);
      }
      router.push('/onboarding/pair');
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
        <View style={styles.hero}>
          <BrandMark size={140} />
          <ThemedText type="title" style={styles.wordmark}>
            Churriapp
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.tagline}>
            Vuestro espacio. Solo vosotros dos.
          </ThemedText>
        </View>

        <View style={styles.form}>
          <Eyebrow>{mode === 'signUp' ? 'Crear cuenta' : 'Entrar'}</Eyebrow>

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

          {error && <ThemedText style={styles.error}>{error}</ThemedText>}

          <View style={styles.buttonWrapper}>
            <GradientButton
              title={mode === 'signUp' ? 'Crear cuenta' : 'Iniciar sesión'}
              onPress={handleSubmit}
              disabled={isSubmitting}
            />
          </View>

          <Pressable
            onPress={() => setMode(mode === 'signUp' ? 'signIn' : 'signUp')}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.switchMode}>
              {mode === 'signUp' ? 'Ya tengo cuenta' : 'Crear una cuenta nueva'}
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
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
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
    justifyContent: 'flex-end',
    gap: Spacing.six,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
  },
  wordmark: {
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '800',
    letterSpacing: -1,
    textAlign: 'center',
  },
  tagline: {
    textAlign: 'center',
    fontSize: 15,
  },
  form: {
    gap: Spacing.two,
  },
  input: {
    backgroundColor: theme.backgroundElement,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
    color: theme.text,
    ...neonBorder(theme.border, 'FF'),
  },
  error: {
    color: theme.you,
    fontSize: 14,
  },
  buttonWrapper: {
    marginTop: Spacing.three,
  },
  switchMode: {
    textAlign: 'center',
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
