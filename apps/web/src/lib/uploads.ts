import { auth } from '@/lib/firebase';

const workerUrl =
  process.env.NEXT_PUBLIC_WORKER_URL ?? 'https://churri-photos.migvarona.workers.dev';

type UploadPermission = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  type: string;
  signature: string;
};

export type UploadKind = 'image' | 'document';

export async function uploadFile(file: File, spaceId: string, kind: UploadKind) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('No hay una sesión activa.');

  const permissionResponse = await fetch(`${workerUrl}/upload/sign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ spaceId }),
  });
  if (!permissionResponse.ok) throw new Error('No se ha autorizado la subida.');
  const permission = (await permissionResponse.json()) as UploadPermission;

  const body = new FormData();
  body.append('file', file);
  body.append('api_key', permission.apiKey);
  body.append('timestamp', String(permission.timestamp));
  body.append('folder', permission.folder);
  body.append('type', permission.type);
  body.append('signature', permission.signature);

  const resourceType = kind === 'image' ? 'image' : 'raw';
  const uploadResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${permission.cloudName}/${resourceType}/upload`,
    { method: 'POST', body },
  );
  if (!uploadResponse.ok) throw new Error('No se ha podido subir el archivo.');

  const uploaded = (await uploadResponse.json()) as {
    secure_url?: string;
    public_id?: string;
  };
  if (!uploaded.secure_url || !uploaded.public_id) {
    throw new Error('Cloudinary no ha devuelto el archivo completo.');
  }
  return { imageUrl: uploaded.secure_url, publicId: uploaded.public_id };
}

export function uploadPhoto(file: File, spaceId: string) {
  return uploadFile(file, spaceId, 'image');
}

export async function deleteUploadedFile(spaceId: string, photoId: string) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('No hay una sesión activa.');

  const response = await fetch(`${workerUrl}/photo/delete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ spaceId, photoId }),
  });
  if (!response.ok) throw new Error('No se ha podido borrar el archivo.');
}
