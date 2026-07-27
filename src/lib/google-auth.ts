import { GoogleAuthProvider, signInWithCredential } from '@react-native-firebase/auth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

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

/**
 * Signing out of Firebase leaves Google's own session behind, so the next sign-in
 * silently reuses the cached account and never asks. Someone who deliberately left
 * should be asked again — including which account they want.
 */
export async function signOutFromGoogle() {
  try {
    await GoogleSignin.signOut();
  } catch {
    // Nothing to sign out of (they came in with email) — not a failure.
  }
}

/**
 * A fresh Google credential for the account that's already signed in.
 *
 * Firebase refuses to destroy an account on a stale login, so it has to be proved again
 * — but there's nothing to ask: we know who you are. Google can confirm it silently from
 * the session it already holds, so this normally shows nothing at all. Only if that
 * session is gone (a while since you last used the phone, credentials cleared) does it
 * fall back to asking, and then Firebase rejects any account that isn't yours.
 */
export async function getGoogleCredential() {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  try {
    const silent = await GoogleSignin.signInSilently();
    if (silent.type === 'success' && silent.data.idToken) {
      return GoogleAuthProvider.credential(silent.data.idToken);
    }
  } catch {
    // No usable session. Falling through to ask is better than failing the deletion.
  }

  const response = await GoogleSignin.signIn();
  if (response.type === 'cancelled') {
    throw new GoogleSignInCancelled();
  }

  const idToken = response.data?.idToken;
  if (!idToken) {
    throw new Error('Google no devolvió el token');
  }

  return GoogleAuthProvider.credential(idToken);
}

export async function signInWithGoogle() {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  // Google holds on to the last account and walks straight back in with it. Dropping that
  // session first is what makes it ask — and being asked is the point: this is a space for
  // two, and which of you is holding the phone is not a detail to assume.
  await signOutFromGoogle();

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
