import AsyncStorage from '@react-native-async-storage/async-storage';
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
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { DefaultPalette, MaxMembers } from '@/constants/palettes';
import { auth, db } from '@/lib/firebase';
import { sendPushNotification } from '@/lib/push';
import { getGoogleCredential, signInWithGoogle, signOutFromGoogle } from '@/lib/google-auth';

export type SpaceKind = 'personal' | 'shared';

/** The slice of a person that lives on a space: enough to paint their light and ring their phone. */
export type MemberProfile = { name: string; expoPushToken?: string };

export type Space = {
  id: string;
  kind: SpaceKind;
  name: string;
  /** Arrival order — and arrival order is colour. Append-only; never reshuffled. */
  memberIds: string[];
  members: Record<string, MemberProfile>;
  inviteCode: string | null;
  paletteId: string;
};

export type SpaceMember = {
  uid: string;
  name: string;
  /** Position in the arrival list, which is the position in the palette's ramp. */
  index: number;
};

type SpaceContextValue = {
  user: User | null;
  isLoading: boolean;
  /** Every space this account lives in, personal first. */
  spaces: Space[];
  /** The space on screen. Never null once loading has finished and a user exists. */
  space: Space | null;
  spaceId: string | null;
  setActiveSpace: (id: string) => void;
  /** The people of the active space, in arrival order. */
  members: SpaceMember[];
  /** Everyone in the active space except you — the phones a push might go to. */
  otherMembers: SpaceMember[];
  myIndex: number;
  myName: string;
  /** Nobody else in the active space (always true for the personal one). */
  isAlone: boolean;
  inviteCode: string | null;
  paletteId: string;
  setPalette: (id: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  createSpace: (name: string) => Promise<{ spaceId: string; code: string }>;
  joinSpace: (code: string) => Promise<boolean>;
  renameMe: (name: string) => Promise<void>;
  renameSpace: (name: string) => Promise<void>;
  /**
   * Walk out of the active shared space. If others remain, the space goes on without you;
   * if you were the last one, it goes with you. The personal space can't be left.
   */
  leaveSpace: () => Promise<void>;
  /** Irreversible. Pass the password only for accounts that signed up with one. */
  deleteAccount: (password?: string) => Promise<void>;
  /** Whether this account signed in with Google, so we know how to prove identity again. */
  isGoogleAccount: boolean;
};

const SpaceContext = createContext<SpaceContextValue | null>(null);

const InviteCodeAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * The code is the only thing standing between a stranger and someone's space, so it needs
 * a generator built for that job. `Math.random` isn't one — it's fast and predictable,
 * fine for picking which light animates next, wrong for anything that acts as a credential.
 */
async function generateInviteCode() {
  const bytes = await Crypto.getRandomBytesAsync(6);
  return Array.from(bytes, (byte) => InviteCodeAlphabet[byte % InviteCodeAlphabet.length]).join('');
}

function personalSpaceIdFor(uid: string) {
  return `personal_${uid}`;
}

function readSpace(id: string, data: Record<string, unknown>): Space {
  return {
    id,
    kind: (data.kind as SpaceKind | undefined) ?? 'shared',
    name: (data.name as string | undefined) ?? '',
    memberIds: (data.memberIds as string[] | undefined) ?? [],
    members: (data.members as Record<string, MemberProfile> | undefined) ?? {},
    inviteCode: (data.inviteCode as string | undefined) ?? null,
    paletteId: (data.palette as string | undefined) ?? DefaultPalette.id,
  };
}

export function SpaceProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [myName, setMyName] = useState('');
  const [myPushToken, setMyPushToken] = useState<string | null>(null);
  /** null until the membership query answers for the first time. */
  const [spaces, setSpaces] = useState<Space[] | null>(null);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsAuthLoading(false);
      if (!firebaseUser) {
        setSpaces(null);
        setActiveSpaceId(null);
        setIsProfileLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    setIsProfileLoading(true);
    return onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      setMyName((snapshot.data()?.displayName as string | undefined) ?? '');
      setMyPushToken((snapshot.data()?.expoPushToken as string | undefined) ?? null);
      setIsProfileLoading(false);
    });
  }, [user]);

  // Every space you're in, found by being in it — there is no list of spaces to browse,
  // only the membership query, which the rules make the one readable path.
  useEffect(() => {
    if (!user) return undefined;
    const membershipQuery = query(
      collection(db, 'spaces'),
      where('memberIds', 'array-contains', user.uid),
    );
    return onSnapshot(
      membershipQuery,
      (snapshot) => {
        const loaded = snapshot.docs.map((entry) => readSpace(entry.id, entry.data()));
        // Personal first, then shared by name: a stable order for pickers everywhere.
        loaded.sort((a, b) =>
          a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'personal' ? -1 : 1,
        );
        setSpaces(loaded);
      },
      (error) => {
        // Almost always one thing: the Firestore rules deployed don't know `spaces` yet.
        // Say so, loudly — the alternative is a splash screen that never lets go.
        console.error('[spaces] la consulta de espacios ha fallado — ¿reglas sin desplegar?', error);
        setSpaces([]);
      },
    );
  }, [user]);

  // Solo-first: your personal space exists from the moment your account does. It's created
  // lazily here (not at sign-up) so accounts from before the pivot get one on first open.
  // The deterministic id makes the create idempotent: two devices racing both name the same
  // document, and the rules only let it be created once.
  useEffect(() => {
    if (!user || !myName || spaces === null) return;
    if (spaces.some((space) => space.kind === 'personal')) return;
    void setDoc(doc(db, 'spaces', personalSpaceIdFor(user.uid)), {
      kind: 'personal',
      name: 'Personal',
      memberIds: [user.uid],
      members: { [user.uid]: { name: myName } },
      inviteCode: null,
      createdAt: Date.now(),
    }).catch(() => {
      // Another device won the race, or we're offline. The membership query will tell us.
    });
  }, [user, myName, spaces]);

  // Your name and push token live once on your account and travel to every space you're in,
  // because the space is the only place others are allowed to read them from.
  useEffect(() => {
    if (!user || !myName || spaces === null) return;
    for (const space of spaces) {
      const mine = space.members[user.uid];
      const tokenThere = mine?.expoPushToken ?? null;
      if (mine?.name === myName && tokenThere === myPushToken) continue;
      void updateDoc(doc(db, 'spaces', space.id), {
        [`members.${user.uid}`]: {
          name: myName,
          ...(myPushToken ? { expoPushToken: myPushToken } : {}),
        },
      }).catch(() => {
        // A space we just left, or a moment of no network. Nothing to chase.
      });
    }
  }, [user, myName, myPushToken, spaces]);

  // Which space is on screen is a per-device choice, so it lives on the device.
  useEffect(() => {
    if (!user) return;
    void AsyncStorage.getItem(`flare.activeSpace.${user.uid}`).then((stored) => {
      if (stored) setActiveSpaceId((current) => current ?? stored);
    });
  }, [user]);

  const setActiveSpace = (id: string) => {
    setActiveSpaceId(id);
    if (user) void AsyncStorage.setItem(`flare.activeSpace.${user.uid}`, id);
  };

  // The active space: the chosen one if you're still in it, your personal one otherwise.
  const space =
    spaces?.find((entry) => entry.id === activeSpaceId) ??
    spaces?.find((entry) => entry.kind === 'personal') ??
    spaces?.[0] ??
    null;

  const members: SpaceMember[] = (space?.memberIds ?? []).map((uid, index) => ({
    uid,
    name: space?.members[uid]?.name || 'Alguien',
    index,
  }));
  const otherMembers = members.filter((member) => member.uid !== user?.uid);
  const myIndex = Math.max(0, space?.memberIds.indexOf(user?.uid ?? '') ?? 0);

  const signUp = async (email: string, password: string, name: string) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', credential.user.uid), {
      email,
      displayName: name.trim(),
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

  const createSpace = async (name: string) => {
    if (!user) throw new Error('No hay usuario');
    const code = await generateInviteCode();
    const spaceRef = doc(collection(db, 'spaces'));
    await setDoc(spaceRef, {
      kind: 'shared',
      name: name.trim() || 'Espacio',
      memberIds: [user.uid],
      members: {
        [user.uid]: { name: myName, ...(myPushToken ? { expoPushToken: myPushToken } : {}) },
      },
      inviteCode: code,
      createdAt: Date.now(),
    });
    // The key also lives on its own, so that walking in means knowing the code rather
    // than being able to ask for the list of every space there is.
    await setDoc(doc(db, 'invites', code), { spaceId: spaceRef.id, createdAt: Date.now() });
    setActiveSpace(spaceRef.id);
    return { spaceId: spaceRef.id, code };
  };

  const joinSpace = async (code: string) => {
    if (!user) throw new Error('No hay usuario');
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) return false;

    // Straight to the door this key opens. Nothing else is readable, so a wrong code
    // tells you nothing except that it's wrong.
    const invite = await getDoc(doc(db, 'invites', trimmedCode));
    if (!invite.exists()) return false;

    const joinedSpaceId = invite.data().spaceId as string;
    const spaceRef = doc(db, 'spaces', joinedSpaceId);
    const snapshot = await getDoc(spaceRef).catch(() => null);

    // Joining is appending yourself: to the arrival list (which fixes your colour) and to
    // `members` (which is how the others' phones learn your name). One write, checked by
    // the rules as a whole.
    const currentMemberIds =
      (snapshot?.data()?.memberIds as string[] | undefined) ?? [];
    if (currentMemberIds.length >= MaxMembers || currentMemberIds.includes(user.uid)) {
      if (currentMemberIds.includes(user.uid)) {
        setActiveSpace(joinedSpaceId);
        return true;
      }
      return false;
    }
    await updateDoc(spaceRef, {
      memberIds: [...currentMemberIds, user.uid],
      [`members.${user.uid}`]: {
        name: myName,
        ...(myPushToken ? { expoPushToken: myPushToken } : {}),
      },
    });
    setActiveSpace(joinedSpaceId);
    return true;
  };

  /**
   * End a space completely: the key, the content, the document. Only ever called when its
   * last member is walking out — for everyone before that, leaving is just an update.
   */
  const dissolveSpace = async (target: Space) => {
    if (target.inviteCode) {
      await deleteDoc(doc(db, 'invites', target.inviteCode)).catch(() => undefined);
    }
    // Content first: deleting the space would orphan these, and nothing could reach them.
    for (const name of ['reminders', 'photos', 'messages']) {
      const docs = await getDocs(collection(db, 'spaces', target.id, name));
      await Promise.all(docs.docs.map((entry) => deleteDoc(entry.ref)));
    }
    await deleteDoc(doc(db, 'spaces', target.id));
  };

  const withdrawFrom = async (target: Space, uid: string) => {
    if (target.memberIds.length <= 1) {
      await dissolveSpace(target);
      return;
    }

    // Tell the others before going quiet — after this write their space simply has one
    // light fewer, and nothing left to explain why.
    for (const otherUid of target.memberIds) {
      if (otherUid === uid) continue;
      await sendPushNotification(
        target.id,
        otherUid,
        target.name,
        `${myName} ha salido del espacio`,
      ).catch(() => undefined);
    }

    await updateDoc(doc(db, 'spaces', target.id), {
      memberIds: target.memberIds.filter((memberUid) => memberUid !== uid),
      [`members.${uid}`]: deleteField(),
    });
  };

  const leaveSpace = async () => {
    if (!user || !space) throw new Error('No hay usuario');
    if (space.kind === 'personal') throw new Error('El espacio personal no se abandona');
    await withdrawFrom(space, user.uid);
    // Alarms for this space live on this phone; the remaining spaces will re-sync theirs.
    await Notifications.cancelAllScheduledNotificationsAsync();
    setActiveSpace(personalSpaceIdFor(user.uid));
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

    // Walk out of every space — dissolving the ones where you were the last light.
    for (const target of spaces ?? []) {
      if (target.kind === 'personal') {
        await dissolveSpace(target);
      } else {
        await withdrawFrom(target, user.uid);
      }
    }
    await Notifications.cancelAllScheduledNotificationsAsync();

    await deleteDoc(doc(db, 'users', user.uid));
    await signOutFromGoogle();
    await deleteUser(user);
  };

  const setPalette = async (id: string) => {
    if (!space) return;
    // It lives on the space, not on any one of you, so it changes on every phone at once.
    await updateDoc(doc(db, 'spaces', space.id), { palette: id });
  };

  const renameMe = async (name: string) => {
    if (!user || !name.trim()) return;
    // The fan-out effect carries the new name into every space's `members` map.
    await updateDoc(doc(db, 'users', user.uid), { displayName: name.trim() });
  };

  const renameSpace = async (name: string) => {
    if (!space || !name.trim() || space.kind === 'personal') return;
    await updateDoc(doc(db, 'spaces', space.id), { name: name.trim() });
  };

  const isLoading =
    isAuthLoading || (Boolean(user) && (isProfileLoading || spaces === null || space === null));

  const value = useMemo<SpaceContextValue>(
    () => ({
      user,
      isLoading,
      spaces: spaces ?? [],
      space,
      spaceId: space?.id ?? null,
      setActiveSpace,
      members,
      otherMembers,
      myIndex,
      myName: myName || 'Tú',
      isAlone: otherMembers.length === 0,
      inviteCode: space?.inviteCode ?? null,
      paletteId: space?.paletteId ?? DefaultPalette.id,
      setPalette,
      signUp,
      signIn,
      signInGoogle,
      signOutUser,
      createSpace,
      joinSpace,
      renameMe,
      renameSpace,
      leaveSpace,
      deleteAccount,
      isGoogleAccount,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, isLoading, spaces, space, myName, myPushToken, activeSpaceId],
  );

  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>;
}

export function useSpace() {
  const context = useContext(SpaceContext);
  if (!context) {
    throw new Error('useSpace must be used within a SpaceProvider');
  }
  return context;
}
