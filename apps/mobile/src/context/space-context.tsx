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
} from '@react-native-firebase/auth';
import {
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from '@react-native-firebase/firestore';
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { DefaultPalette } from '@/constants/palettes';
import { auth, db } from '@/lib/firebase';
import { resolveInviteCode } from '@/lib/invites';
import { sendPushNotification } from '@/lib/push';
import { nextRotationTarget, type Rotation } from '@/lib/reminders';
import { getGoogleCredential, signInWithGoogle, signOutFromGoogle } from '@/lib/google-auth';

/** How long a key stays live before it needs to be cut again. */
const InviteLifetimeMs = 7 * 24 * 60 * 60 * 1000;

function inviteExpiry() {
  return Timestamp.fromDate(new Date(Date.now() + InviteLifetimeMs));
}

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
  /** When the current code stops working, so the UI can say so before someone finds out
   * the hard way by trying to use it. */
  inviteCodeExpiresAt: number | null;
  paletteId: string;
  /** A trip that's over, not a space that's gone: still there, just out of the way. */
  archived: boolean;
};

export type JoinSpaceResult =
  | { ok: true }
  | { ok: false; reason: 'not-found' | 'expired' | 'rate-limited' | 'full' | 'error' };

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
  inviteCodeExpiresAt: number | null;
  paletteId: string;
  setPalette: (id: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  createSpace: (name: string) => Promise<{ spaceId: string; code: string }>;
  joinSpace: (code: string) => Promise<JoinSpaceResult>;
  renameMe: (name: string) => Promise<void>;
  renameSpace: (name: string) => Promise<void>;
  /** Freeze a shared space, or bring it back. Any member can do either; the personal space
   *  can't be archived. Archiving the one you're looking at bounces you back to Personal. */
  setSpaceArchived: (targetSpaceId: string, archived: boolean) => Promise<void>;
  /** Cut a fresh key for the active space — the old one, expired or not, stops working. */
  regenerateInviteCode: () => Promise<string>;
  /**
   * Walk out of the active shared space. If others remain, the space goes on without you;
   * if you were the last one, it goes with you. The personal space can't be left.
   */
  leaveSpace: () => Promise<void>;
  /** Irreversible. Pass the password only for accounts that signed up with one. */
  deleteAccount: (password?: string) => Promise<void>;
  /** Whether this account signed in with Google, so we know how to prove identity again. */
  isGoogleAccount: boolean;
  /** True for the one session right after signup, until the new-account intro is dismissed. */
  justCreatedAccount: boolean;
  dismissIntro: () => void;
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
    inviteCodeExpiresAt: (data.inviteCodeExpiresAt as number | undefined) ?? null,
    paletteId: (data.palette as string | undefined) ?? DefaultPalette.id,
    archived: (data.archived as boolean | undefined) ?? false,
  };
}

export function SpaceProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [myName, setMyName] = useState('');
  const [myPushToken, setMyPushToken] = useState<string | null>(null);
  /** True for the one session right after signup, until the new-account intro is dismissed. */
  const [justCreatedAccount, setJustCreatedAccount] = useState(false);
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
        // Otherwise the next account to sign in on this device inherits this one's name for
        // the instant before its own profile snapshot arrives — long enough to leak into a
        // personal space created from stale state.
        setMyName('');
        setMyPushToken(null);
        setJustCreatedAccount(false);
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

  // The active space: the chosen one, unless it's just been archived — from this phone or
  // another — in which case there's nothing left to show, so it falls back like it would
  // if you'd left. Your personal space otherwise.
  const chosen = spaces?.find((entry) => entry.id === activeSpaceId);
  const space =
    (chosen && !chosen.archived ? chosen : undefined) ??
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
    setJustCreatedAccount(true);
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
      setJustCreatedAccount(true);
    }
  };

  const signOutUser = async () => {
    // Scheduled alarms belong to the signed-in account. Leaving them behind would let the
    // next account on this phone receive reminders from a space it cannot even open.
    await Notifications.cancelAllScheduledNotificationsAsync();
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
      inviteCodeExpiresAt: Date.now() + InviteLifetimeMs,
      createdAt: Date.now(),
    });
    // The key also lives on its own, so that walking in means knowing the code rather
    // than being able to ask for the list of every space there is. It's good for a week —
    // long enough to actually reach the people you're sending it to, short enough that a
    // code someone forgot about doesn't stay a live door forever.
    await setDoc(doc(db, 'invites', code), {
      spaceId: spaceRef.id,
      createdAt: Date.now(),
      expiresAt: inviteExpiry(),
    });
    setActiveSpace(spaceRef.id);
    return { spaceId: spaceRef.id, code };
  };

  /**
   * A fresh key for a space that already has one — because the old one expired, because
   * someone who shouldn't have it got hold of it, or just because. The old code is left
   * alone rather than actively torn down: it's already a dead end once nothing on the
   * space points to it any more, and once its own week is up it stops working regardless.
   */
  const regenerateInviteCode = async () => {
    if (!space) throw new Error('No hay espacio activo');
    if (space.kind !== 'shared') throw new Error('Este espacio no tiene llave');

    const code = await generateInviteCode();
    await setDoc(doc(db, 'invites', code), {
      spaceId: space.id,
      createdAt: Date.now(),
      expiresAt: inviteExpiry(),
    });
    await updateDoc(doc(db, 'spaces', space.id), {
      inviteCode: code,
      inviteCodeExpiresAt: Date.now() + InviteLifetimeMs,
    });
    return code;
  };

  const joinSpace = async (code: string): Promise<JoinSpaceResult> => {
    if (!user) throw new Error('No hay usuario');
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) return { ok: false, reason: 'not-found' };

    // The Worker checks this one, throttled — a plain Firestore read here would let anyone
    // sit in a loop guessing codes for free (their free, our Firestore bill).
    const resolved = await resolveInviteCode(trimmedCode);
    if (!resolved.ok) return resolved;

    const joinedSpaceId = resolved.spaceId;

    // Already in it — your own membership query would already have this space in `spaces`,
    // so there's nothing to write; just switch to it.
    if ((spaces ?? []).some((entry) => entry.id === joinedSpaceId)) {
      setActiveSpace(joinedSpaceId);
      return { ok: true };
    }

    // No pre-read here on purpose: the space's own rules only grant a `get` to someone
    // already in `memberIds`, which you aren't yet — a read-then-concat would always be
    // denied and (as it used to) silently default to an empty array, so the write below
    // would always be rejected too. `arrayUnion` needs no prior read: Firestore resolves it
    // against the document as it actually stands on the server, and the rules validate the
    // same resulting value — including the 8-member cap, enforced there, not here.
    //
    // `archived: false` rides along unconditionally rather than needing to know beforehand
    // whether the space was archived — writing the same value it already had is a no-op
    // the rules don't even see as a change, so this only actually does anything when a
    // join reaches a space that had been frozen.
    try {
      await updateDoc(doc(db, 'spaces', joinedSpaceId), {
        memberIds: arrayUnion(user.uid),
        [`members.${user.uid}`]: {
          name: myName,
          ...(myPushToken ? { expoPushToken: myPushToken } : {}),
        },
        archived: false,
      });
    } catch {
      return { ok: false, reason: 'full' };
    }

    setActiveSpace(joinedSpaceId);
    return { ok: true };
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

    const remainingUids = target.memberIds.filter((memberUid) => memberUid !== uid);

    // Do this while the departing person is still a member and therefore still allowed to
    // repair the reminders. Otherwise an alert aimed only at their phone becomes an orphan:
    // visible to everyone, but scheduled on nobody. Multi-person alerts simply lose that
    // recipient; single-person and rotating alerts pass to the next eligible member.
    const reminderDocs = await getDocs(collection(db, 'spaces', target.id, 'reminders'));
    await Promise.all(
      reminderDocs.docs.map(async (entry) => {
        const data = entry.data();
        if (data.status !== 'pending') return;

        const currentTargets = data.targetUids as string[] | undefined;
        if (!currentTargets?.includes(uid)) return;

        const retainedTargets = currentTargets.filter(
          (targetUid) => targetUid !== uid && remainingUids.includes(targetUid),
        );
        if (retainedTargets.length > 0) {
          await updateDoc(entry.ref, { targetUids: retainedTargets });
          return;
        }

        const rotation = data.rotation as Rotation | null | undefined;
        const rotationTarget = rotation
          ? nextRotationTarget(rotation, currentTargets, remainingUids)
          : null;
        const creatorUid = data.createdByUid as string | undefined;
        const fallbackTarget =
          rotationTarget ??
          (creatorUid && remainingUids.includes(creatorUid) ? creatorUid : remainingUids[0]);

        await updateDoc(entry.ref, { targetUids: [fallbackTarget] });
      }),
    );

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

  const setSpaceArchived = async (targetSpaceId: string, archived: boolean) => {
    await updateDoc(doc(db, 'spaces', targetSpaceId), { archived });
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
      inviteCodeExpiresAt: space?.inviteCodeExpiresAt ?? null,
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
      setSpaceArchived,
      regenerateInviteCode,
      leaveSpace,
      deleteAccount,
      isGoogleAccount,
      justCreatedAccount,
      dismissIntro: () => setJustCreatedAccount(false),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, isLoading, spaces, space, myName, myPushToken, activeSpaceId, justCreatedAccount],
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
