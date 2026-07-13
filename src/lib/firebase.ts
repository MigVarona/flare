import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
// @ts-expect-error getReactNativePersistence exists in the RN bundle but is missing from firebase's published types (firebase-js-sdk#9316)
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCBxaxX9i-SWD4qCqR4RNM1xmMFCcRnJi4',
  authDomain: 'retiro360-51909.firebaseapp.com',
  projectId: 'retiro360-51909',
  storageBucket: 'retiro360-51909.firebasestorage.app',
  messagingSenderId: '120685723840',
  appId: '1:120685723840:web:09566e3fa264121fbaad25',
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db = getFirestore(app);
