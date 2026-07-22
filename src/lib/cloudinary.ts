import { File, UploadType } from 'expo-file-system';

import { callWorker } from '@/lib/worker';

/**
 * Photos go straight to Cloudinary, but never on the app's own authority.
 *
 * The upload used to carry an unsigned preset baked into the bundle, which meant anyone who
 * opened the APK could upload to the account until the quota burned. Now the app asks the
 * Worker for permission, and the Worker — which holds the secret — grants it only for a
 * space you actually belong to. The bytes still travel directly, so nothing gets slower.
 */

export type UploadedCloudinaryFile = {
  imageUrl: string;
  publicId: string;
};

/** Cloudinary delivers photos and everything else through different endpoints and, on
 * deletion, different verbs — this is the one thing that has to travel with the file. */
export type CloudinaryKind = 'image' | 'document';

type UploadPermission = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  type: string;
  signature: string;
};

export async function uploadFileToCloudinary(
  localUri: string,
  spaceId: string,
  kind: CloudinaryKind,
): Promise<UploadedCloudinaryFile> {
  const permission = await callWorker<UploadPermission>('/upload/sign', { spaceId });

  // Cloudinary sorts a photo from a PDF by the endpoint you hit, not by anything in the
  // signed parameters — a document uploaded through `image/upload` gets rejected outright.
  const resourceType = kind === 'image' ? 'image' : 'raw';

  const file = new File(localUri);
  const response = await file.upload(
    `https://api.cloudinary.com/v1_1/${permission.cloudName}/${resourceType}/upload`,
    {
      uploadType: UploadType.MULTIPART,
      fieldName: 'file',
      parameters: {
        api_key: permission.apiKey,
        timestamp: String(permission.timestamp),
        folder: permission.folder,
        type: permission.type,
        signature: permission.signature,
      },
    },
  );

  if (response.status < 200 || response.status >= 300) {
    throw new Error('No se pudo subir el archivo');
  }

  const data = JSON.parse(response.body) as { secure_url?: string; public_id?: string };

  if (!data.secure_url || !data.public_id) {
    throw new Error('Cloudinary no devolvió el archivo completo');
  }

  // It went up as 'authenticated', so its plain URL answers 401 to anyone who tries it.
  // What Cloudinary hands back here is already the signed link — unguessable, and kept in
  // a document only the two of you can read. It's as private as the space.
  return { imageUrl: data.secure_url, publicId: data.public_id };
}

/**
 * Delete the photo — the file, not just the note saying where it was.
 *
 * The Worker removes the image from Cloudinary and then the record from Firestore, in that
 * order, so the two can't disagree. Deleting the record here would leave the file behind
 * forever, which is what used to happen.
 */
export async function deletePhoto(spaceId: string, photoId: string) {
  await callWorker<{ ok: true }>('/photo/delete', { spaceId, photoId });
}
