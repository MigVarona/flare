import { auth } from '@/lib/firebase';

const WORKER_URL = 'https://churri-photos.migvarona.workers.dev';

export async function sendPushNotification(
  spaceId: string,
  recipientUid: string,
  title: string,
  message: string,
  /** Where tapping the notification lands: '/reminders', '/board' or '/gallery'. */
  url?: string,
) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) return false;

  const response = await fetch(`${WORKER_URL}/push/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ spaceId, recipientUid, title, message, url }),
  });

  const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };

  if (!response.ok || !result.ok) {
    console.log('[push] no se pudo enviar', result.error ?? result);
  }

  return result.ok === true;
}
