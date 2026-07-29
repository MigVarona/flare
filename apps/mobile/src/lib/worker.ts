import { auth } from '@/lib/firebase';

/**
 * Flare's doorman. Every call carries the caller's own Firebase token — the Worker acts
 * as them, never as itself, so there's no second copy of the permission logic anywhere
 * between here and Firestore's rules.
 */
export const WORKER_URL = 'https://churri-photos.migvarona.workers.dev';

export async function callWorker<T>(path: string, body: Record<string, string>): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('No hay sesión');

  const response = await fetch(`${WORKER_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`El servidor respondió ${response.status}`);
  }

  return (await response.json()) as T;
}
