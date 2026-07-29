'use client';

import { onAuthStateChanged, type User } from 'firebase/auth';
import { useEffect, useState } from 'react';

import { auth } from '@/lib/firebase';
import { AuthScreen } from './auth-screen';
import { FlareDashboard } from './flare-dashboard';

export function AuthGate() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(
    () => onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setIsLoading(false);
    }),
    [],
  );

  if (isLoading) {
    return (
      <main className="loading-screen" aria-label="Cargando Flare">
        <div className="orbit large" aria-hidden="true"><i /><i /></div>
      </main>
    );
  }

  return user ? <FlareDashboard user={user} /> : <AuthScreen />;
}
