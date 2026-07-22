/**
 * Cloudinary asks for proof that a request comes from us: the parameters, in alphabetical
 * order, hashed together with the API secret. The secret lives here and only here — the
 * app never sees it, which is the entire reason this Worker exists.
 */

type Credentials = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

async function sha1Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function sign(params: Record<string, string | number>, apiSecret: string) {
  const canonical = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  return sha1Hex(`${canonical}${apiSecret}`);
}

/**
 * Permission to upload one photo, into one space, for a few minutes.
 *
 * The app uploads straight to Cloudinary with this — the bytes never come through the
 * Worker, so a big photo doesn't cost us a slow request.
 */
export async function signUpload(credentials: Credentials, spaceId: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  // Each space keeps its photos in its own folder, so a stray public id can't wander. The
  // folder prefix predates the pivot; keeping it keeps migrated spaces pointing at the
  // files they already had.
  const folder = `churri/${spaceId}`;
  // 'authenticated' is what makes the photo private: Cloudinary will refuse to serve it to
  // a plain URL. It only comes out for a link we have signed.
  const type = 'authenticated';

  const signature = await sign({ folder, timestamp, type }, credentials.apiSecret);

  return {
    cloudName: credentials.cloudName,
    apiKey: credentials.apiKey,
    timestamp,
    folder,
    type,
    signature,
  };
}

async function destroyOne(
  credentials: Credentials,
  publicId: string,
  type: string,
  resourceType: string,
) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await sign({ public_id: publicId, timestamp, type }, credentials.apiSecret);

  const body = new FormData();
  body.append('public_id', publicId);
  body.append('timestamp', String(timestamp));
  body.append('type', type);
  body.append('api_key', credentials.apiKey);
  body.append('signature', signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${credentials.cloudName}/${resourceType}/destroy`,
    { method: 'POST', body },
  );

  const result = (await response.json()) as { result?: string };
  return result.result === 'ok';
}

/**
 * Actually remove the file. Until now, deleting a photo only forgot where it was.
 *
 * Cloudinary deletes from one delivery type at a time, and it answers 'not found' rather
 * than failing when you name the wrong one — so asking for the wrong type would report
 * success and quietly leave the file up, which is the exact bug this Worker exists to end.
 * New photos are 'authenticated'; the ones from before this all began are 'upload'. The
 * resource type (`image` vs `raw`, for PDFs and other documents) came up from Firestore with
 * the record, so there's no guessing that one — only the delivery type still needs trying
 * both ways.
 */
export async function destroyAsset(
  credentials: Credentials,
  publicId: string,
  resourceType: 'image' | 'raw',
) {
  if (await destroyOne(credentials, publicId, 'authenticated', resourceType)) return true;
  return destroyOne(credentials, publicId, 'upload', resourceType);
}
