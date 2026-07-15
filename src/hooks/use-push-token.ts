import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';

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
