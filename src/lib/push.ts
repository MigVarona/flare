export async function sendPushNotification(expoPushToken: string, title: string, body: string) {
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: expoPushToken, title, body, sound: 'default' }),
  });

  // Expo answers 200 even when it refuses to deliver (dead token, wrong project…),
  // so the only way to know is to read what it says.
  const result = (await response.json()) as { data?: { status: string; message?: string } };

  if (result.data?.status !== 'ok') {
    console.log('[push] Expo rechazó el envío', result.data);
  }

  return result.data?.status === 'ok';
}
