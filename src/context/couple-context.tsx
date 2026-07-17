import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { DefaultPalette } from '@/constants/palettes';
import { auth, db } from '@/lib/firebase';
import { sendPushNotification } from '@/lib/push';
import { getGoogleCredential, signInWithGoogle, signOutFromGoogle } from '@/lib/google-auth';

type CoupleContextValue = {
  user: User | null;
  isLoading: boolean;
  isPaired: boolean;
  coupleId: string | null;
  inviteCode: string | null;
  isWaitingForPartner: boolean;
  partnerUid: string | null;
  /** What each of you goes by. Falls back to a generic label until someone picks one. */
  myName: string;
  partnerName: string;
  /** Whoever opened the space is the first light; whoever walked in is the second. */
  amFirst: boolean;
  /** The pair of colours the space wears. One choice, belonging to both of you. */
  paletteId: string;
  setPalette: (id: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  createCouple: () => Promise<{ coupleId: string; code: string }>;
  confirmCouple: (coupleId: string) => Promise<void>;
  joinCouple: (code: string) => Promise<boolean>;
  renameMe: (name: string) => Promise<void>;
  /** Walk out of the space, keeping your account. If you were alone, the space goes too. */
  leaveCouple: () => Promise<void>;
  /** Irreversible. Pass the password only for accounts that signed up with one. */
  deleteAccount: (password?: string) => Promise<void>;
  /** Whether this account signed in with Google, so we know how to prove identity again. */
  isGoogleAccount: boolean;
};

const CoupleContext = createContext<CoupleContextValue | null>(null);

const InviteCodeAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * The code is the only thing standing between a stranger and someone's private space, so it
 * needs a generator built for that job. `Math.random` isn't one — it's fast and predictable,
 * fine for picking which light animates next, wrong for anything that acts as a credential.
 */
async function generateInviteCode() {
  const bytes = await Crypto.getRandomBytesAsync(6);
  return Array.from(bytes, (byte) => InviteCodeAlphabet[byte % InviteCodeAlphabet.length]).join('');
}

export function CoupleProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [partnerUid, setPartnerUid] = useState<string | null>(null);
  const [myName, setMyName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [amFirst, setAmFirst] = useState(true);
  const [paletteId, setPaletteId] = useState(DefaultPalette.id);

  useEffect(() => {
    return onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsAuthLoading(false);
      if (!firebaseUser) {
        setCoupleId(null);
        setIsProfileLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    setIsProfileLoading(true);
    return onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      setCoupleId((snapshot.data()?.coupleId as string | undefined) ?? null);
      setMyName((snapshot.data()?.displayName as string | undefined) ?? '');
      setIsProfileLoading(false);
    });
  }, [user]);

  useEffect(() => {
    if (!partnerUid) {
      setPartnerName('');
      return undefined;
    }
    return onSnapshot(
      doc(db, 'users', partnerUid),
      (snapshot) => setPartnerName((snapshot.data()?.displayName as string | undefined) ?? ''),
      () => {
        // The space just ended, so you can't see them any more. That's the rule working,
        // not a failure: let go quietly instead of shouting about it.
        setPartnerName('');
      },
    );
  }, [partnerUid]);

  useEffect(() => {
    if (!coupleId || !user) {
      setInviteCode(null);
      setMemberCount(0);
      setPartnerUid(null);
      return undefined;
    }
    return onSnapshot(doc(db, 'couples', coupleId), (snapshot) => {
      // The other person ended it. Their app can't clear your profile — the rules only
      // let you write your own — so you let go of the space yourself when you find it gone.
      if (!snapshot.exists()) {
        void updateDoc(doc(db, 'users', user.uid), { coupleId: null });
        void Notifications.cancelAllScheduledNotificationsAsync();
        return;
      }

      const memberIds = (snapshot.data()?.memberIds as string[] | undefined) ?? [];
      setInviteCode((snapshot.data()?.inviteCode as string | undefined) ?? null);
      setPaletteId((snapshot.data()?.palette as string | undefined) ?? DefaultPalette.id);
      setMemberCount(memberIds.length);
      setPartnerUid(memberIds.find((id) => id !== user.uid) ?? null);
      // The order people arrived in *is* the colour. Nothing else decides it, and nothing
      // needs to be stored: both phones read the same list and reach the same answer.
      setAmFirst(memberIds[0] === user.uid);
    });
  }, [coupleId, user]);

  // Spaces made before the key became a document of its own have no door to open. Put one
  // up, once, so an invite that was handed out earlier still works.
  useEffect(() => {
    if (!user || !coupleId || !inviteCode || memberCount >= 2) return;
    const inviteRef = doc(db, 'invites', inviteCode);
    void getDoc(inviteRef).then((snapshot) => {
      if (!snapshot.exists()) {
        void setDoc(inviteRef, { coupleId, createdAt: Date.now() });
      }
    });
  }, [user, coupleId, inviteCode, memberCount]);

  const signUp = async (email: string, password: string, name: string) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', credential.user.uid), {
      email,
      displayName: name.trim(),
      coupleId: null,
      createdAt: Date.now(),
    });
  };

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signInGoogle = async () => {
    const { user: googleUser, name } = await signInWithGoogle();

    // First time in with Google: they have an account, but no profile here yet.
    const profileRef = doc(db, 'users', googleUser.uid);
    const profile = await getDoc(profileRef);

    if (!profile.exists()) {
      await setDoc(profileRef, {
        email: googleUser.email ?? '',
        displayName: name,
        coupleId: null,
        createdAt: Date.now(),
      });
    }
  };

  const signOutUser = async () => {
    // Leave both sessions, or Google will quietly log you back into the same account.
    await signOutFromGoogle();
    await firebaseSignOut(auth);
  };

  // How you got in decides how you prove it's you again before the account can be destroyed.
  const isGoogleAccount = Boolean(
    user?.providerData.some((provider) => provider.providerId === 'google.com'),
  );

  /**
   * End the shared space.
   *
   * The space *is* the pair, so it can't outlive it. Whoever walks out ends it, and
   * everything in it goes with it — otherwise the one who stays would be left holding
   * the other's photos, and anyone invited afterwards would walk into a room still
   * full of a previous relationship.
   *
   * Leaving and deleting your account do exactly this to the space, so it lives here once.
   */
  const dissolveCouple = async (uid: string) => {
    if (!coupleId) return;

    const couple = await getDoc(doc(db, 'couples', coupleId));
    const memberIds = (couple.data()?.memberIds as string[] | undefined) ?? [];
    const otherUid = memberIds.find((id) => id !== uid);

    // Tell them before it goes. Once it's deleted, their app has nothing left to
    // explain itself with — the space would simply be gone.
    if (otherUid) {
      await sendPushNotification(coupleId, otherUid, 'El espacio se ha cerrado', 'Ya no está.').catch(
        () => undefined,
      );
    }

    // The key first: taking it down needs the space to still exist and us to still be in it.
    const code = couple.data()?.inviteCode as string | undefined;
    if (code) {
      await deleteDoc(doc(db, 'invites', code)).catch(() => undefined);
    }

    // Content next: deleting the space would orphan these, and nothing could reach them.
    for (const name of ['reminders', 'photos', 'messages']) {
      const docs = await getDocs(collection(db, 'couples', coupleId, name));
      await Promise.all(docs.docs.map((entry) => deleteDoc(entry.ref)));
    }
    await deleteDoc(doc(db, 'couples', coupleId));

    // Alarms live on the phone, not in Firestore. Left alone they'd keep going off for
    // reminders that no longer exist anywhere.
    await Notifications.cancelAllScheduledNotificationsAsync();
  };

  const leaveCouple = async () => {
    if (!user) throw new Error('No hay usuario');
    await dissolveCouple(user.uid);
    // Your account stays; it just isn't anywhere. The guard sends you back to pairing.
    await updateDoc(doc(db, 'users', user.uid), { coupleId: null });
  };

  const deleteAccount = async (password?: string) => {
    if (!user) throw new Error('No hay usuario');

    // Firebase won't destroy an account on a stale login, so prove it's you first.
    if (isGoogleAccount) {
      await reauthenticateWithCredential(user, await getGoogleCredential());
    } else if (password) {
      const credential = EmailAuthProvider.credential(user.email ?? '', password);
      await reauthenticateWithCredential(user, credential);
    }

    await dissolveCouple(user.uid);
    await deleteDoc(doc(db, 'users', user.uid));
    await signOutFromGoogle();
    await deleteUser(user);
  };

  const createCouple = async () => {
    if (!user) throw new Error('No hay usuario');
    const code = await generateInviteCode();
    const coupleRef = doc(collection(db, 'couples'));
    await setDoc(coupleRef, {
      memberIds: [user.uid],
      inviteCode: code,
      // Kept only because the current Firestore rules require it on create. The app no
      // longer asks for or displays a space name.
      spaceName: 'Churri',
      createdAt: Date.now(),
    });
    // The key also lives on its own, so that walking in means knowing the code rather
    // than being able to ask for the list of every space there is.
    await setDoc(doc(db, 'invites', code), { coupleId: coupleRef.id, createdAt: Date.now() });
    return { coupleId: coupleRef.id, code };
  };

  const setPalette = async (id: string) => {
    if (!coupleId) return;
    // It lives on the space, not on either of you, so it changes on both phones at once.
    await updateDoc(doc(db, 'couples', coupleId), { palette: id });
  };

  const renameMe = async (name: string) => {
    if (!user || !name.trim()) return;
    await updateDoc(doc(db, 'users', user.uid), { displayName: name.trim() });
  };

  const confirmCouple = async (coupleIdToConfirm: string) => {
    if (!user) throw new Error('No hay usuario');
    await updateDoc(doc(db, 'users', user.uid), { coupleId: coupleIdToConfirm });
  };

  const joinCouple = async (code: string) => {
    if (!user) throw new Error('No hay usuario');
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) return false;

    // Straight to the door this key opens. Nothing else is readable, so a wrong code
    // tells you nothing except that it's wrong.
    const invite = await getDoc(doc(db, 'invites', trimmedCode));
    if (!invite.exists()) return false;

    const joinedCoupleId = invite.data().coupleId as string;
    await updateDoc(doc(db, 'couples', joinedCoupleId), { memberIds: arrayUnion(user.uid) });
    await updateDoc(doc(db, 'users', user.uid), { coupleId: joinedCoupleId });
    // The key only needs to work once: with both of you in, it can't open the door again.
    await deleteDoc(doc(db, 'invites', trimmedCode)).catch(() => undefined);
    return true;
  };

  const value = useMemo<CoupleContextValue>(
    () => ({
      user,
      isLoading: isAuthLoading || isProfileLoading,
      isPaired: Boolean(coupleId),
      coupleId,
      inviteCode,
      isWaitingForPartner: Boolean(coupleId) && memberCount < 2,
      partnerUid,
      myName: myName || 'Tú',
      partnerName: partnerName || 'La otra persona',
      amFirst,
      paletteId,
      setPalette,
      signUp,
      signIn,
      signInGoogle,
      signOutUser,
      createCouple,
      confirmCouple,
      joinCouple,
      renameMe,
      leaveCouple,
      deleteAccount,
      isGoogleAccount,
    }),
    [
      user,
      isAuthLoading,
      isProfileLoading,
      coupleId,
      inviteCode,
      memberCount,
      partnerUid,
      myName,
      partnerName,
      amFirst,
      paletteId,
    ],
  );

  return <CoupleContext.Provider value={value}>{children}</CoupleContext.Provider>;
}

export function useCouple() {
  const context = useContext(CoupleContext);
  if (!context) {
    throw new Error('useCouple must be used within a CoupleProvider');
  }
  return context;
}
