import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore } from '@react-native-firebase/firestore';

/**
 * The native SDK, not the web one.
 *
 * The web/JS SDK's React Native persistence layer has a known failure mode: if its own
 * internal session-validation call hits any error — a network hiccup is enough — it clears
 * the saved session instead of keeping it, so the app asks you to sign in again on the next
 * launch. The native SDK doesn't reimplement that logic in JS at all; it delegates straight
 * to the platform's own Firebase Auth, which persists the way every other native app's login
 * does. Firestore moved over with it — the native Auth instance and the web Firestore client
 * don't share a session, so keeping one on each SDK would mean every read and write loses its
 * credentials the moment sign-in does.
 *
 * The app is already configured natively from `google-services.json`, so there's nothing to
 * initialize here — just the same modular functions as the web SDK, pointed at it.
 */
const app = getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
