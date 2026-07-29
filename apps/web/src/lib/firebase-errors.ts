import { FirebaseError } from 'firebase/app';

const messages: Record<string, string> = {
  'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
  'auth/invalid-credential': 'El correo o la contraseña no son correctos.',
  'auth/invalid-email': 'El correo no es válido.',
  'auth/popup-closed-by-user': 'Se ha cerrado la ventana de acceso.',
  'auth/popup-blocked': 'El navegador ha bloqueado la ventana de Google.',
  'auth/too-many-requests': 'Demasiados intentos. Espera un momento y vuelve a probar.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
};

export function readableFirebaseError(error: unknown) {
  if (error instanceof FirebaseError) {
    return messages[error.code] ?? 'Firebase no ha podido completar la operación.';
  }
  return error instanceof Error ? error.message : 'No se ha podido completar la operación.';
}
