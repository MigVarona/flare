import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Firebase's session blob (ID token, refresh token, account metadata) is what lets someone
 * walk back into your account without your password — plain AsyncStorage keeps it as
 * unencrypted JSON on disk, readable from an unencrypted backup or a rooted/jailbroken phone.
 *
 * The blob itself is too big to live in SecureStore directly (the Keychain/Keystore has long
 * had an undocumented ceiling around 2KB, and Firebase's payload can get close with a linked
 * Google provider). So only the AES key lives there — small, hardware-backed — and it encrypts
 * the actual blob before it ever touches AsyncStorage.
 */
const KeyStorageName = 'churri.authEncryptionKey';
const StoragePrefix = 'churri.secure.';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

let cachedKey: Crypto.AESEncryptionKey | null = null;

async function getOrCreateKey(): Promise<Crypto.AESEncryptionKey> {
  if (cachedKey) return cachedKey;

  const stored = await SecureStore.getItemAsync(KeyStorageName);
  if (stored) {
    cachedKey = await Crypto.AESEncryptionKey.import(stored, 'base64');
    return cachedKey;
  }

  const key = await Crypto.AESEncryptionKey.generate(Crypto.AESKeySize.AES256);
  await SecureStore.setItemAsync(KeyStorageName, await key.encoded('base64'));
  cachedKey = key;
  return key;
}

/** Drop-in replacement for `AsyncStorage` as Firebase's `getReactNativePersistence` argument. */
export const securePersistence = {
  async getItem(key: string): Promise<string | null> {
    const combined = await AsyncStorage.getItem(StoragePrefix + key);
    if (!combined) return null;

    try {
      const aesKey = await getOrCreateKey();
      const sealed = Crypto.AESSealedData.fromCombined(combined);
      const plainBytes = await Crypto.aesDecryptAsync(sealed, aesKey);
      return decoder.decode(plainBytes as Uint8Array);
    } catch {
      // Corrupted or unreadable (e.g. the key was reset): treat as no session rather than
      // crash the app on launch. Firebase falls back to asking the user to sign in again.
      await AsyncStorage.removeItem(StoragePrefix + key);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    const aesKey = await getOrCreateKey();
    const sealed = await Crypto.aesEncryptAsync(encoder.encode(value), aesKey);
    await AsyncStorage.setItem(StoragePrefix + key, await sealed.combined('base64'));
  },

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(StoragePrefix + key);
  },
};
