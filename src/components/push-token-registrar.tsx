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
    updateDoc(doc(db, 'users', user.uid), { expoPushToken: token }).catch(() => {});
  }, [user, token]);

  return null;
}
