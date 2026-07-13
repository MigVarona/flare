import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { PushTokenRegistrar } from '@/components/push-token-registrar';
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
    <CoupleProvider>
      <ThemeProvider value={navigationTheme}>
        <PushTokenRegistrar />
        <RootNavigator />
      </ThemeProvider>
    </CoupleProvider>
  );
}

function RootNavigator() {
  const { isPaired, isLoading } = useCouple();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

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
