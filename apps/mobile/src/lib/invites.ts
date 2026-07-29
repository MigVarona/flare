import { auth } from '@/lib/firebase';
import { WORKER_URL } from '@/lib/worker';

export type ResolveInviteResult =
  | { ok: true; spaceId: string }
  | { ok: false; reason: 'not-found' | 'expired' | 'rate-limited' | 'error' };

/**
 * Ask the Worker whether a code still opens a door, and which one.
 *
 * This used to be a plain Firestore read the app made for itself: harmless on its own, but
 * with nothing behind it stopping the same request from being sent in a loop. The Worker
 * counts attempts per account and per network origin before it ever touches Firestore, so
 * a guesser hits a wall long before the six-character search space is worth anything to them.
 *
 * A non-2xx here is data, not a failure — "rate-limited" and "expired" are answers, not
 * errors — so this never throws; it just says which kind of no it is.
 */
export async function resolveInviteCode(code: string): Promise<ResolveInviteResult> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) return { ok: false, reason: 'error' };

  try {
    const response = await fetch(`${WORKER_URL}/invite/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      spaceId?: string;
      reason?: string;
    };

    if (result.ok && result.spaceId) return { ok: true, spaceId: result.spaceId };
    return {
      ok: false,
      reason:
        result.reason === 'expired' || result.reason === 'rate-limited' || result.reason === 'not-found'
          ? result.reason
          : 'error',
    };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
