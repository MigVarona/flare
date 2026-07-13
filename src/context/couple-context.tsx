import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { DefaultPalette, paletteById, type Palette } from '@/constants/palettes';
import { auth, db } from '@/lib/firebase';
import { signInWithGoogle } from '@/lib/google-auth';

type CoupleContextValue = {
  user: User | null;
  isLoading: boolean;
  isPaired: boolean;
  coupleId: string | null;
  inviteCode: string | null;
  spaceName: string | null;
  isWaitingForPartner: boolean;
  partnerUid: string | null;
  /** What each of you goes by. Falls back to a generic label until someone picks one. */
  myName: string;
  partnerName: string;
  /** The two colours this couple is made of. Shared, like everything else here. */
  palette: Palette;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  createCouple: (
    spaceName: string,
    paletteId: string,
  ) => Promise<{ coupleId: string; code: string }>;
  confirmCouple: (coupleId: string) => Promise<void>;
  joinCouple: (code: string) => Promise<boolean>;
  renameSpace: (name: string) => Promise<void>;
  renameMe: (name: string) => Promise<void>;
  setPalette: (paletteId: string) => Promise<void>;
};

const CoupleContext = createContext<CoupleContextValue | null>(null);

function generateInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function CoupleProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [spaceName, setSpaceName] = useState<string | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [partnerUid, setPartnerUid] = useState<string | null>(null);
  const [myName, setMyName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [paletteId, setPaletteId] = useState<string | null>(null);

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
    return onSnapshot(doc(db, 'users', partnerUid), (snapshot) => {
      setPartnerName((snapshot.data()?.displayName as string | undefined) ?? '');
    });
  }, [partnerUid]);

  useEffect(() => {
    if (!coupleId || !user) {
      setInviteCode(null);
      setSpaceName(null);
      setPaletteId(null);
      setMemberCount(0);
      setPartnerUid(null);
      return undefined;
    }
    return onSnapshot(doc(db, 'couples', coupleId), (snapshot) => {
      const memberIds = (snapshot.data()?.memberIds as string[] | undefined) ?? [];
      setInviteCode((snapshot.data()?.inviteCode as string | undefined) ?? null);
      setSpaceName((snapshot.data()?.spaceName as string | undefined) ?? null);
      setPaletteId((snapshot.data()?.palette as string | undefined) ?? null);
      setMemberCount(memberIds.length);
      setPartnerUid(memberIds.find((id) => id !== user.uid) ?? null);
    });
  }, [coupleId, user]);

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
    await firebaseSignOut(auth);
  };

  const createCouple = async (name: string, chosenPaletteId: string) => {
    if (!user) throw new Error('No hay usuario');
    const code = generateInviteCode();
    const coupleRef = doc(collection(db, 'couples'));
    await setDoc(coupleRef, {
      memberIds: [user.uid],
      inviteCode: code,
      spaceName: name.trim(),
      palette: chosenPaletteId,
      createdAt: Date.now(),
    });
    return { coupleId: coupleRef.id, code };
  };

  const renameSpace = async (name: string) => {
    if (!coupleId || !name.trim()) return;
    await updateDoc(doc(db, 'couples', coupleId), { spaceName: name.trim() });
  };

  const renameMe = async (name: string) => {
    if (!user || !name.trim()) return;
    await updateDoc(doc(db, 'users', user.uid), { displayName: name.trim() });
  };

  const setPalette = async (chosenPaletteId: string) => {
    if (!coupleId) return;
    await updateDoc(doc(db, 'couples', coupleId), { palette: chosenPaletteId });
  };

  const confirmCouple = async (coupleIdToConfirm: string) => {
    if (!user) throw new Error('No hay usuario');
    await updateDoc(doc(db, 'users', user.uid), { coupleId: coupleIdToConfirm });
  };

  const joinCouple = async (code: string) => {
    if (!user) throw new Error('No hay usuario');
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) return false;

    const matches = await getDocs(
      query(collection(db, 'couples'), where('inviteCode', '==', trimmedCode)),
    );
    if (matches.empty) return false;

    const coupleDoc = matches.docs[0];
    const memberIds = coupleDoc.data().memberIds as string[];
    if (!memberIds.includes(user.uid)) {
      await updateDoc(coupleDoc.ref, { memberIds: arrayUnion(user.uid) });
    }
    await updateDoc(doc(db, 'users', user.uid), { coupleId: coupleDoc.id });
    return true;
  };

  const value = useMemo<CoupleContextValue>(
    () => ({
      user,
      isLoading: isAuthLoading || isProfileLoading,
      isPaired: Boolean(coupleId),
      coupleId,
      inviteCode,
      spaceName,
      isWaitingForPartner: Boolean(coupleId) && memberCount < 2,
      partnerUid,
      myName: myName || 'Tú',
      partnerName: partnerName || 'Tu pareja',
      palette: paletteId ? paletteById(paletteId) : DefaultPalette,
      signUp,
      signIn,
      signInGoogle,
      signOutUser,
      createCouple,
      confirmCouple,
      joinCouple,
      renameSpace,
      renameMe,
      setPalette,
    }),
    [
      user,
      isAuthLoading,
      isProfileLoading,
      coupleId,
      inviteCode,
      spaceName,
      memberCount,
      partnerUid,
      myName,
      partnerName,
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
