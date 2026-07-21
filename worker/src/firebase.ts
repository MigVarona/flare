/**
 * Who is asking.
 *
 * The app sends the Firebase ID token it already has. We verify it against Google's public
 * keys, so a caller can't just claim to be someone — the signature has to hold up.
 */

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

type Jwk = JsonWebKey & { kid: string };

let cachedKeys: { keys: Jwk[]; expiresAt: number } | null = null;

async function publicKeys(): Promise<Jwk[]> {
  if (cachedKeys && cachedKeys.expiresAt > Date.now()) return cachedKeys.keys;

  const response = await fetch(JWKS_URL);
  const body = (await response.json()) as { keys: Jwk[] };

  // Google says how long these are good for; believe it rather than refetching every call.
  const cacheControl = response.headers.get('cache-control') ?? '';
  const maxAge = Number(/max-age=(\d+)/.exec(cacheControl)?.[1] ?? 3600);
  cachedKeys = { keys: body.keys, expiresAt: Date.now() + maxAge * 1000 };

  return body.keys;
}

function decodeSegment(segment: string) {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(padded));
}

function toBytes(segment: string) {
  const binary = atob(segment.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/**
 * The caller's uid, or null if the token doesn't hold up.
 *
 * A malformed token is a normal thing to receive — it's what an attacker sends first. It
 * must come back as "no", not as an exception: a doorman who faints at a scribbled ID is
 * not guarding anything.
 */
export async function verifyIdToken(token: string, projectId: string): Promise<string | null> {
  try {
    return await check(token, projectId);
  } catch {
    return null;
  }
}

async function check(token: string, projectId: string): Promise<string | null> {
  const [rawHeader, rawPayload, rawSignature] = token.split('.');
  if (!rawHeader || !rawPayload || !rawSignature) return null;

  const header = decodeSegment(rawHeader) as { kid?: string; alg?: string };
  if (header.alg !== 'RS256' || !header.kid) return null;

  const jwk = (await publicKeys()).find((candidate) => candidate.kid === header.kid);
  if (!jwk) return null;

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  const signed = new TextEncoder().encode(`${rawHeader}.${rawPayload}`);
  const isAuthentic = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    toBytes(rawSignature),
    signed,
  );
  if (!isAuthentic) return null;

  const payload = decodeSegment(rawPayload) as {
    aud?: string;
    iss?: string;
    sub?: string;
    exp?: number;
  };

  const now = Math.floor(Date.now() / 1000);
  const isForUs = payload.aud === projectId
    && payload.iss === `https://securetoken.google.com/${projectId}`;
  const isCurrent = typeof payload.exp === 'number' && payload.exp > now;

  if (!isForUs || !isCurrent || !payload.sub) return null;
  return payload.sub;
}

/**
 * Read a document *as the caller*, through the Firestore REST API with their own token.
 *
 * This is the whole authorisation model: we don't re-implement who may touch what, we ask
 * Firestore, and the security rules answer. If the rules say no, we get a 403 and so does
 * the caller. One source of truth.
 */
export async function readDocumentAs(token: string, projectId: string, path: string) {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!response.ok) return null;
  return (await response.json()) as {
    fields?: Record<string, FirestoreValue>;
  };
}

type FirestoreValue = {
  stringValue?: string;
  timestampValue?: string;
  arrayValue?: { values?: Array<{ stringValue?: string }> };
  mapValue?: { fields?: Record<string, FirestoreValue> };
};

export async function deleteDocumentAs(token: string, projectId: string, path: string) {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
  );
  return response.ok;
}
