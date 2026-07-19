const crypto = require('node:crypto');

const { initializeApp } = require('firebase-admin/app');
const { defineSecret } = require('firebase-functions/params');
const { onDocumentDeleted } = require('firebase-functions/v2/firestore');

initializeApp();

const CLOUDINARY_CLOUD_NAME = 'dyji6w7iu';
const CLOUDINARY_API_KEY = defineSecret('CLOUDINARY_API_KEY');
const CLOUDINARY_API_SECRET = defineSecret('CLOUDINARY_API_SECRET');

exports.deleteCloudinaryPhoto = onDocumentDeleted(
  {
    document: 'spaces/{spaceId}/photos/{photoId}',
    region: 'europe-west1',
    secrets: [CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET],
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const publicId = data.cloudinaryPublicId || publicIdFromCloudinaryUrl(data.imageUrl);
    if (!publicId) {
      console.warn('Photo deleted without Cloudinary public id', event.params);
      return;
    }

    await destroyCloudinaryImage(publicId);
  },
);

async function destroyCloudinaryImage(publicId) {
  const authenticated = await destroyCloudinaryImageByType(publicId, 'authenticated');
  if (authenticated.result === 'ok') return;

  const upload = await destroyCloudinaryImageByType(publicId, 'upload');
  if (upload.result === 'ok' || upload.result === 'not found') return;

  console.error('Cloudinary destroy failed', {
    publicId,
    authenticated,
    upload,
  });
  throw new Error('Cloudinary destroy failed');
}

async function destroyCloudinaryImageByType(publicId, type) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const apiKey = CLOUDINARY_API_KEY.value();
  const apiSecret = CLOUDINARY_API_SECRET.value();
  const signature = signCloudinaryParams(
    {
      invalidate: 'true',
      public_id: publicId,
      timestamp,
      type,
    },
    apiSecret,
  );

  const body = new URLSearchParams({
    api_key: apiKey,
    invalidate: 'true',
    public_id: publicId,
    signature,
    timestamp,
    type,
  });

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/destroy`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    },
  );

  const result = await response.json();
  return {
    ok: response.ok,
    status: response.status,
    result: result.result,
  };
}

function signCloudinaryParams(params, apiSecret) {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  return crypto
    .createHash('sha1')
    .update(`${payload}${apiSecret}`)
    .digest('hex');
}

function publicIdFromCloudinaryUrl(imageUrl) {
  if (typeof imageUrl !== 'string') return null;

  try {
    const url = new URL(imageUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    const uploadIndex = parts.indexOf('upload');
    if (uploadIndex === -1) return null;

    let assetParts = parts.slice(uploadIndex + 1);
    const versionIndex = assetParts.findIndex((part) => /^v\d+$/.test(part));
    if (versionIndex !== -1) {
      assetParts = assetParts.slice(versionIndex + 1);
    }

    if (assetParts.length === 0) return null;

    const last = assetParts[assetParts.length - 1];
    assetParts[assetParts.length - 1] = last.replace(/\.[^.]+$/, '');

    return assetParts.join('/');
  } catch {
    return null;
  }
}
