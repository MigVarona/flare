import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';

import { auth } from '@/lib/firebase';

/**
 * The web client id from google-services.json. Google hands back an ID token signed for
 * this client, and Firebase only trusts a token addressed to itself — which is why the
 * SHA-1 of each signing key has to be registered, or Google refuses to issue one at all.
 */
const WEB_CLIENT_ID = '120685723840-iu28us0u795v5d68sdcfsvrnfvtj6q3f.apps.googleusercontent.com';

GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });

/** Thrown when the user simply backed out of the Google sheet — not an error worth showing. */
export class GoogleSignInCancelled extends Error {}

export async function signInWithGoogle() {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  try {
    const response = await GoogleSignin.signIn();

    if (response.type === 'cancelled') {
      throw new GoogleSignInCancelled();
    }

    const idToken = response.data?.idToken;
    if (!idToken) {
      throw new Error('Google no devolvió el token');
    }

    const credential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, credential);

    return {
      user: result.user,
      /** Google already knows their name, so we don't have to ask for it. */
      name: result.user.displayName ?? response.data?.user.givenName ?? '',
    };
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      error.code === statusCodes.SIGN_IN_CANCELLED
    ) {
      throw new GoogleSignInCancelled();
    }
    throw error;
  }
}
