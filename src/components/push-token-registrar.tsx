import { doc, updateDoc } from '@react-native-firebase/firestore';
import { useEffect } from 'react';

import { useSpace } from '@/context/space-context';
import { usePushToken } from '@/hooks/use-push-token';
import { db } from '@/lib/firebase';

export function PushTokenRegistrar() {
  const { user } = useSpace();
  const { token } = usePushToken();

  useEffect(() => {
    if (!user || !token) return;
    // Written once on your account; the context fans it out to every space you're in,
    // which is where other phones are allowed to read it from. Without this token no
    // other phone can reach yours, so a failure is worth surfacing rather than swallowing.
    updateDoc(doc(db, 'users', user.uid), { expoPushToken: token }).catch((error) =>
      console.warn('[push] no se pudo guardar el token', error),
    );
  }, [user, token]);

  return null;
}
