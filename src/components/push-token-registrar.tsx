import { doc, updateDoc } from 'firebase/firestore';
import { useEffect } from 'react';

import { useCouple } from '@/context/couple-context';
import { usePushToken } from '@/hooks/use-push-token';
import { db } from '@/lib/firebase';

export function PushTokenRegistrar() {
  const { user } = useCouple();
  const { token } = usePushToken();

  useEffect(() => {
    if (!user || !token) return;
    // Without this token the other phone can't reach yours, so a failure here is worth
    // surfacing rather than swallowing.
    updateDoc(doc(db, 'users', user.uid), { expoPushToken: token }).catch((error) =>
      console.warn('[push] no se pudo guardar el token', error),
    );
  }, [user, token]);

  return null;
}
