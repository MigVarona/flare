import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark, Eyebrow, GradientButton } from '@/components/brand';
import { ThemedText } from '@/components/themed-text';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSpace } from '@/context/space-context';

const theme = Colors.dark;

type Slide = { eyebrow: string; title: string; body: string };

const slides: Slide[] = [
  {
    eyebrow: 'Tu espacio',
    title: 'Ya tienes tu espacio personal',
    body: 'Es solo tuyo, y siempre está ahí: tus fotos, avisos y recordatorios viven en él desde ya.',
  },
  {
    eyebrow: 'Compartir',
    title: 'Invita a alguien cuando quieras',
    body: 'Desde Ajustes → Gestionar espacios puedes crear un espacio compartido y generar una llave para invitar hasta a 8 personas.',
  },
];

/**
 * Shown once, right after signup — the account exists and the personal space is already
 * there, but nobody has explained what either of those means yet. Dismissing it (by
 * finishing or skipping) just flips a flag; there's nothing here worth persisting past
 * the session it appears in.
 */
export default function IntroScreen() {
  const { dismissIntro } = useSpace();
  const [step, setStep] = useState(0);
  const slide = slides[step];
  const isLast = step === slides.length - 1;

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <BrandMark size={72} />
          </View>

          <View style={styles.body}>
            <Eyebrow>{slide.eyebrow}</Eyebrow>
            <ThemedText type="headline">{slide.title}</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.bodyText}>
              {slide.body}
            </ThemedText>
          </View>

          <View style={styles.dots}>
            {slides.map((item, index) => (
              <View key={item.title} style={[styles.dot, index === step && styles.dotActive]} />
            ))}
          </View>

          <View style={styles.buttonWrapper}>
            <GradientButton
              title={isLast ? 'Empezar' : 'Siguiente'}
              onPress={() => (isLast ? dismissIntro() : setStep(step + 1))}
            />
          </View>

          {!isLast && (
            <Pressable onPress={dismissIntro} style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.skip}>
                Saltar
              </ThemedText>
            </Pressable>
          )}
        </ScrollView>
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
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing[24],
    paddingBottom: Spacing[32],
    justifyContent: 'center',
    gap: Spacing[24],
  },
  hero: {
    alignItems: 'center',
    paddingBottom: Spacing[8],
  },
  body: {
    gap: Spacing[8],
  },
  bodyText: {
    lineHeight: 22,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing[8],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.border,
  },
  dotActive: {
    backgroundColor: theme.accent,
  },
  buttonWrapper: {
    marginTop: Spacing[8],
  },
  skip: {
    textAlign: 'center',
    paddingVertical: Spacing[8],
  },
  pressed: {
    opacity: 0.7,
  },
});
