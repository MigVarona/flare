import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

const REMINDER_CHANNEL_ID = 'reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function usePushToken() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    registerForPushNotifications()
      .then(setToken)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  return { token, error };
}

async function registerForPushNotifications() {
  if (!Device.isDevice) {
    throw new Error('Las notificaciones push necesitan un dispositivo físico');
  }

  // Android 13 does not show its notification permission prompt until at least one
  // channel exists. This has to happen before asking for the token, otherwise a fresh
  // install can silently miss the permission and never become reachable by the others.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: 'Recordatorios',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F72E79',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    throw new Error('Permiso de notificaciones denegado');
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    throw new Error('Falta el projectId de EAS en app.json (ejecuta "eas init")');
  }

  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data;
}
