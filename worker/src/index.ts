/**
 * Flare's doorman.
 *
 * It exists for one reason: Cloudinary's secret can't live in the app. Anyone can pull an
 * APK apart, and with that secret they could upload to the account until the quota burns,
 * or reach photos that aren't theirs. So the secret lives here, and the app asks.
 *
 * Who you are is settled by your Firebase token. What you're allowed to touch is settled by
 * the Firestore rules — this Worker asks Firestore *as you*, so there's no second copy of
 * the permission logic to drift out of step with the first.
 */
import { destroyAsset, signUpload } from './cloudinary';
import { deleteDocumentAs, readDocumentAs, verifyIdToken } from './firebase';
import { checkRateLimit } from './rate-limit';

type Env = {
  FIREBASE_PROJECT_ID: string;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  RATE_LIMITS: KVNamespace;
};

/** How many code guesses one account, or one network origin, gets before waiting it out. */
const InviteAttemptLimit = 8;
const InviteAttemptWindowSeconds = 15 * 60;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') return json({ error: 'method' }, 405);

    const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
    if (!token) return json({ error: 'auth' }, 401);

    const uid = await verifyIdToken(token, env.FIREBASE_PROJECT_ID);
    if (!uid) return json({ error: 'auth' }, 401);

    const url = new URL(request.url);
    const body = (await request.json().catch(() => ({}))) as {
      spaceId?: string;
      /** Older app versions name the space this way. Same id, same document. */
      coupleId?: string;
      photoId?: string;
      recipientUid?: string;
      title?: string;
      message?: string;
      url?: string;
      code?: string;
    };

    // Resolving an invite code has no space to check membership against yet — that's the
    // whole point — so it's the one route with nothing in common with the rest below.
    if (url.pathname === '/invite/resolve') {
      return resolveInvite(request, env, token, uid, body.code);
    }

    const credentials = {
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      apiKey: env.CLOUDINARY_API_KEY,
      apiSecret: env.CLOUDINARY_API_SECRET,
    };

    const spaceId = body.spaceId ?? body.coupleId;
    if (!spaceId) return json({ error: 'spaceId' }, 400);

    if (url.pathname === '/upload/sign') {
      // Only members can read a space, so being able to read it *is* the proof.
      const space = await readDocumentAs(
        token,
        env.FIREBASE_PROJECT_ID,
        `spaces/${spaceId}`,
      );
      if (!space) return json({ error: 'forbidden' }, 403);

      return json(await signUpload(credentials, spaceId));
    }

    if (url.pathname === '/photo/delete') {
      if (!body.photoId) return json({ error: 'photoId' }, 400);

      const path = `spaces/${spaceId}/photos/${body.photoId}`;
      const photo = await readDocumentAs(token, env.FIREBASE_PROJECT_ID, path);
      if (!photo) return json({ error: 'forbidden' }, 403);

      const publicId = photo.fields?.cloudinaryPublicId?.stringValue;
      // Photos from before the folder existed have no public id. The record still goes;
      // there's simply no file we can name.
      if (publicId) {
        // Documents went up as 'raw'; everything before that field existed was a photo.
        const resourceType = photo.fields?.kind?.stringValue === 'document' ? 'raw' : 'image';
        const destroyed = await destroyAsset(credentials, publicId, resourceType);
        if (!destroyed) return json({ error: 'cloudinary' }, 502);
      }

      // The file first, then the record. The other order can leave a photo you can see but
      // can no longer delete, because the thing naming the file is gone.
      const deleted = await deleteDocumentAs(token, env.FIREBASE_PROJECT_ID, path);
      if (!deleted) return json({ error: 'firestore' }, 502);

      return json({ ok: true });
    }

    if (url.pathname === '/push/send') {
      if (!body.recipientUid) return json({ error: 'recipientUid' }, 400);
      if (!body.title || body.title.length > 80) return json({ error: 'title' }, 400);
      if (!body.message || body.message.length > 500) return json({ error: 'message' }, 400);

      const space = await readDocumentAs(
        token,
        env.FIREBASE_PROJECT_ID,
        `spaces/${spaceId}`,
      );
      const memberValues = space?.fields?.memberIds?.arrayValue?.values ?? [];
      const memberIds = memberValues
        .map((entry) => entry.stringValue)
        .filter((entry): entry is string => Boolean(entry));

      if (!memberIds.includes(uid) || !memberIds.includes(body.recipientUid)) {
        return json({ error: 'forbidden' }, 403);
      }

      // The token travels on the space itself — user accounts are nobody else's to read,
      // so the space's `members` map is the one place a co-member's phone can be found.
      const expoPushToken =
        space?.fields?.members?.mapValue?.fields?.[body.recipientUid]?.mapValue?.fields
          ?.expoPushToken?.stringValue;
      if (!expoPushToken) return json({ ok: false, reason: 'no-token' });

      // Where tapping the notification lands you. A fixed list, not a free string: the app
      // will navigate wherever this says, so it can only say places that exist.
      const url = ['/reminders', '/board', '/archive'].includes(body.url ?? '')
        ? body.url
        : undefined;

      return json({
        ok: await sendExpoPush(expoPushToken, body.title, body.message, url),
      });
    }

    return json({ error: 'not found' }, 404);
  },
};

/**
 * Look up an invite code — the one Firestore read the app can't just make directly any
 * more. Reading `invites/{code}` was always gated on being signed in, nothing stronger,
 * which meant any account could sit in a loop guessing codes: each miss costs us a
 * Firestore read and tells the guesser nothing except "try again," so nothing there ever
 * stopped them. This does: a KV counter, keyed by account *and* by network origin, ahead
 * of the Firestore call — someone hammering guesses hits a 429 long before they'd ever
 * reach the search space that matters.
 *
 * It doesn't join anything. The app still does the actual write — adding itself to
 * `memberIds` — straight through the Firestore rules, unchanged. This only answers
 * "does this code still open a door, and which one," at a rate a guesser can't outrun.
 */
async function resolveInvite(
  request: Request,
  env: Env,
  token: string,
  uid: string,
  code: string | undefined,
): Promise<Response> {
  if (!code || !/^[A-Z0-9]{6}$/.test(code)) return json({ ok: false, reason: 'not-found' });

  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  const [uidOk, ipOk] = await Promise.all([
    checkRateLimit(env.RATE_LIMITS, `invite:uid:${uid}`, InviteAttemptLimit, InviteAttemptWindowSeconds),
    checkRateLimit(env.RATE_LIMITS, `invite:ip:${ip}`, InviteAttemptLimit, InviteAttemptWindowSeconds),
  ]);
  if (!uidOk || !ipOk) return json({ ok: false, reason: 'rate-limited' }, 429);

  const invite = await readDocumentAs(token, env.FIREBASE_PROJECT_ID, `invites/${code}`);
  const spaceId = invite?.fields?.spaceId?.stringValue;
  if (!spaceId) return json({ ok: false, reason: 'not-found' });

  const expiresAt = invite?.fields?.expiresAt?.timestampValue;
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
    return json({ ok: false, reason: 'expired' });
  }

  return json({ ok: true, spaceId });
}

async function sendExpoPush(expoPushToken: string, title: string, body: string, url?: string) {
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: expoPushToken,
      title,
      body,
      sound: 'default',
      channelId: 'reminders',
      data: url ? { url } : undefined,
    }),
  });

  const result = (await response.json()) as { data?: { status?: string } };
  return response.ok && result.data?.status === 'ok';
}
