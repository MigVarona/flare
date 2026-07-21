/**
 * A cheap attempt counter, keyed by whoever's asking. Firestore Security Rules evaluate one
 * request at a time and have no memory of the last one — they can check that a code is well
 * formed, but not that this is the fortieth guess in a minute. A KV counter can.
 *
 * It's a fixed window, not a sliding one or a token bucket: those earn their complexity
 * guarding a high-frequency API from being hammered evenly. What this guards is someone
 * trying to guess a six-character code, where the classic fixed-window flaw — a burst at
 * the edge of two windows can briefly reach double the limit — doesn't matter. Getting
 * roughly twice `limit` guesses through instead of exactly `limit` changes nothing when the
 * search space is in the billions.
 */
export async function checkRateLimit(
  kv: KVNamespace,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const current = Number((await kv.get(key)) ?? '0');
  if (current >= limit) return false;

  // The TTL only resets on a request that counted, not on one that was already refused —
  // otherwise someone still hammering past the cap would keep pushing their own cooldown
  // back and never age out of it.
  await kv.put(key, String(current + 1), { expirationTtl: windowSeconds });
  return true;
}
