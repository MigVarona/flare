import { File, UploadType } from 'expo-file-system';

const CLOUD_NAME = 'dyji6w7iu';
const UPLOAD_PRESET = 'churriapp_unsigned';

export async function uploadPhotoToCloudinary(localUri: string) {
  const file = new File(localUri);
  const response = await file.upload(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    uploadType: UploadType.MULTIPART,
    fieldName: 'file',
    parameters: { upload_preset: UPLOAD_PRESET },
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error('No se pudo subir la foto');
  }

  const data = JSON.parse(response.body) as { secure_url: string };
  return data.secure_url;
}
