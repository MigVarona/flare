/**
 * Churri's doorman.
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

type Env = {
  FIREBASE_PROJECT_ID: string;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
};

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

    const credentials = {
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      apiKey: env.CLOUDINARY_API_KEY,
      apiSecret: env.CLOUDINARY_API_SECRET,
    };

    const url = new URL(request.url);
    const body = (await request.json().catch(() => ({}))) as {
      coupleId?: string;
      photoId?: string;
      recipientUid?: string;
      title?: string;
      message?: string;
      url?: string;
    };

    if (!body.coupleId) return json({ error: 'coupleId' }, 400);

    if (url.pathname === '/upload/sign') {
      // Only members can read a space, so being able to read it *is* the proof.
      const couple = await readDocumentAs(
        token,
        env.FIREBASE_PROJECT_ID,
        `couples/${body.coupleId}`,
      );
      if (!couple) return json({ error: 'forbidden' }, 403);

      return json(await signUpload(credentials, body.coupleId));
    }

    if (url.pathname === '/photo/delete') {
      if (!body.photoId) return json({ error: 'photoId' }, 400);

      const path = `couples/${body.coupleId}/photos/${body.photoId}`;
      const photo = await readDocumentAs(token, env.FIREBASE_PROJECT_ID, path);
      if (!photo) return json({ error: 'forbidden' }, 403);

      const publicId = photo.fields?.cloudinaryPublicId?.stringValue;
      // Photos from before the folder existed have no public id. The record still goes;
      // there's simply no file we can name.
      if (publicId) {
        const destroyed = await destroyAsset(credentials, publicId);
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

      const couple = await readDocumentAs(
        token,
        env.FIREBASE_PROJECT_ID,
        `couples/${body.coupleId}`,
      );
      const memberValues = couple?.fields?.memberIds?.arrayValue?.values ?? [];
      const memberIds = memberValues
        .map((entry) => entry.stringValue)
        .filter((entry): entry is string => Boolean(entry));

      if (!memberIds.includes(uid) || !memberIds.includes(body.recipientUid)) {
        return json({ error: 'forbidden' }, 403);
      }

      const recipient = await readDocumentAs(
        token,
        env.FIREBASE_PROJECT_ID,
        `users/${body.recipientUid}`,
      );
      const expoPushToken = recipient?.fields?.expoPushToken?.stringValue;
      if (!expoPushToken) return json({ ok: false, reason: 'no-token' });

      // Where tapping the notification lands you. A fixed list, not a free string: the app
      // will navigate wherever this says, so it can only say places that exist.
      const url = ['/reminders', '/chat', '/gallery'].includes(body.url ?? '')
        ? body.url
        : undefined;

      return json({
        ok: await sendExpoPush(expoPushToken, body.title, body.message, url),
      });
    }

    return json({ error: 'not found' }, 404);
  },
};

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
