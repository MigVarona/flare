import { Gabarito_800ExtraBold } from '@expo-google-fonts/gabarito';
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/outfit';
import { DarkTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaListener } from 'react-native-safe-area-context';
import { Uniwind } from 'uniwind';

import '@/global.css';

import { Eyebrow, GhostButton } from '@/components/brand';
import { PushTokenRegistrar } from '@/components/push-token-registrar';
import { ReminderAlarms } from '@/components/reminder-alarms';
import { ThemedText } from '@/components/themed-text';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { Colors } from '@/constants/theme';
import { CoupleProvider, useCouple } from '@/context/couple-context';

SplashScreen.preventAutoHideAsync();

const theme = Colors.dark;

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: theme.background,
    card: theme.background,
    text: theme.text,
    border: theme.border,
    primary: theme.you,
  },
};

export default function RootLayout() {
  return (
    <SafeAreaListener onChange={({ insets }) => Uniwind.updateInsets(insets)}>
      <GestureHandlerRootView className="flex-1 bg-background">
        <KeyboardProvider>
          <GluestackUIProvider mode="dark">
            <CoupleProvider>
              <ThemeProvider value={navigationTheme}>
                <PushTokenRegistrar />
                <ReminderAlarms />
                <RootNavigator />
              </ThemeProvider>
            </CoupleProvider>
          </GluestackUIProvider>
        </KeyboardProvider>
      </GestureHandlerRootView>
    </SafeAreaListener>
  );
}

/**
 * The floor under everything.
 *
 * Without this, one unhandled exception anywhere takes the whole app down — a red screen in
 * development, a silent close in production, and no way back except killing it. Expo Router
 * hands the error here instead, so the app can say what happened and offer the way out.
 *
 * It says nothing reassuring that isn't true: nothing has been lost, because everything
 * lives in the space, not on this screen.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-background px-8">
      <Eyebrow>Algo se ha roto</Eyebrow>
      <ThemedText type="headline" className="text-center">
        La app se ha encontrado con un fallo que no sabía resolver.
      </ThemedText>
      <ThemedText type="small" className="text-center leading-6 text-muted-foreground">
        No has perdido nada: lo que hay en el espacio sigue donde estaba.
      </ThemedText>
      <View className="mt-2 w-full max-w-80">
        <GhostButton title="Volver a intentarlo" onPress={retry} />
      </View>
      {__DEV__ && (
        <ThemedText type="small" className="mt-4 text-center text-destructive">
          {error.message}
        </ThemedText>
      )}
    </View>
  );
}

function RootNavigator() {
  const { isPaired, isLoading } = useCouple();

  const [fontsLoaded] = useFonts({
    // Gabarito is built on circles, like the mark — the wordmark rhymes with the logo. On
    // Android a custom font ignores fontWeight, so each weight has to be its own family.
    Gabarito_800ExtraBold,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
  });

  useEffect(() => {
    // Holding the splash until the type is ready avoids the flash of system font.
    if (!isLoading && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [isLoading, fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
      }}>
      <Stack.Protected guard={!isPaired}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={isPaired}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
}
