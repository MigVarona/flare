import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaListener } from 'react-native-safe-area-context';
import { Uniwind } from 'uniwind';

import '@/global.css';

import { PushTokenRegistrar } from '@/components/push-token-registrar';
import { ReminderAlarms } from '@/components/reminder-alarms';
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
                <RootNavigator />
              </ThemeProvider>
            </CoupleProvider>
          </GluestackUIProvider>
        </KeyboardProvider>
      </GestureHandlerRootView>
    </SafeAreaListener>
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
