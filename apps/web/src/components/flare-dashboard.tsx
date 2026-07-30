'use client';

import {
  formatDueDate,
  nextOccurrence,
  RepeatLabel,
  type RepeatFreq,
} from '@flare/core/dates';
import {
  nextRotationTarget,
  reminderDoneAudience,
  type Rotation,
} from '@flare/core/reminders';
import { signOut, type User } from 'firebase/auth';
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import Image from 'next/image';
import { ChangeEvent, FormEvent, Fragment, useEffect, useMemo, useRef, useState } from 'react';

import { FlareBrand } from '@/components/flare-brand';
import { LinkifiedText } from '@/components/linkified-text';
import { ReminderDateTimePicker } from '@/components/reminder-date-time-picker';
import {
  isSignalId,
  SignalMark,
  SignalPicker,
  type SignalId,
} from '@/components/signal-picker';
import { SettingsPanel } from '@/components/settings-panel';
import { WebOnboardingTour } from '@/components/web-onboarding-tour';
import { auth, db } from '@/lib/firebase';
import { readableFirebaseError } from '@/lib/firebase-errors';
import { GifPicker } from '@/components/gif-picker';
import {
  fetchGiphyGifsById,
  toGifMessage,
  type GifMessage,
  type GiphyGif,
} from '@/lib/giphy';
import { deleteUploadedFile, uploadFile } from '@/lib/uploads';
import { paletteById } from '@/lib/palettes';
import {
  completeWebOnboarding,
  hasPendingWebOnboarding,
  webOnboardingEventName,
} from '@/lib/onboarding';

type MemberProfile = { name: string; expoPushToken?: string };
type Space = {
  id: string;
  kind: 'personal' | 'shared';
  name: string;
  memberIds: string[];
  members: Record<string, MemberProfile>;
  inviteCode: string | null;
  inviteCodeExpiresAt: number | null;
  archived: boolean;
  palette: string;
};
type Reminder = {
  id: string;
  title: string;
  dueAt: Date | null;
  dueLabel: string;
  createdByUid?: string;
  targetUids: string[];
  repeat?: { freq: RepeatFreq } | null;
  rotation?: Rotation | null;
};
type DashboardView = 'space' | 'reminders' | 'board' | 'archive' | 'settings';
type RecentMessage = {
  id: string;
  text: string;
  kind: 'text' | 'gif';
  gif?: GifMessage;
  senderId: string;
  createdAt: Date | null;
  reactions: Record<string, SignalId>;
  pinned: boolean;
};
type RecentPhoto = {
  id: string;
  imageUrl: string;
  uploadedByUid: string;
  kind: 'image' | 'document';
  fileName?: string;
  createdAt: Date | null;
  reactions: Record<string, SignalId>;
  pinned: boolean;
};

type ReactionTarget =
  | { kind: 'message'; item: RecentMessage }
  | { kind: 'photo'; item: RecentPhoto };

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const messagePageStep = 40;
const photoPageStep = 30;
const maxPinnedItems = 2;
const undoWindowMs = 4000;
const workerUrl =
  process.env.NEXT_PUBLIC_WORKER_URL ?? 'https://churri-photos.migvarona.workers.dev';

function inviteCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

function initials(name: string) {
  return name.trim().charAt(0).toUpperCase() || '?';
}

function messageTime(date: Date | null) {
  return date?.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) ?? '';
}

function sameMessageGroup(first: RecentMessage | undefined, second: RecentMessage | undefined) {
  if (!first || !second || first.senderId !== second.senderId) return false;
  if (!first.createdAt || !second.createdAt) return true;
  return Math.abs(first.createdAt.getTime() - second.createdAt.getTime()) <= 5 * 60_000;
}

function sameCalendarDay(first: Date | null, second: Date | null) {
  if (!first || !second) return false;
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function messageDay(date: Date | null) {
  if (!date) return '';
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (sameCalendarDay(date, today)) return 'Hoy';
  if (sameCalendarDay(date, yesterday)) return 'Ayer';
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

function previewText(text: string, max = 90) {
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
}

function fileFormat(fileName?: string) {
  return fileName?.split('.').pop()?.toUpperCase() || 'DOC';
}

function readSpace(id: string, data: Record<string, unknown>): Space {
  return {
    id,
    kind: (data.kind as Space['kind'] | undefined) ?? 'shared',
    name: (data.name as string | undefined) ?? 'Espacio',
    memberIds: (data.memberIds as string[] | undefined) ?? [],
    members: (data.members as Record<string, MemberProfile> | undefined) ?? {},
    inviteCode: (data.inviteCode as string | undefined) ?? null,
    inviteCodeExpiresAt: (data.inviteCodeExpiresAt as number | undefined) ?? null,
    archived: (data.archived as boolean | undefined) ?? false,
    palette: (data.palette as string | undefined) ?? 'neon',
  };
}

function readReactions(value: unknown) {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, SignalId] => isSignalId(entry[1])),
  );
}

function readMessage(id: string, data: Record<string, unknown>): RecentMessage {
  const gif = data.gif as { title?: string } | undefined;
  return {
    id,
    text:
      typeof data.text === 'string'
        ? data.text
        : gif?.title
          ? `GIF · ${gif.title}`
          : 'GIF',
    kind: data.kind === 'gif' && gif ? 'gif' : 'text',
    gif: gif as GifMessage | undefined,
    senderId: data.senderId as string,
    createdAt: (data.createdAt as Timestamp | undefined)?.toDate() ?? null,
    reactions: readReactions(data.reactions),
    pinned: data.pinned === true,
  };
}

function readPhoto(id: string, data: Record<string, unknown>): RecentPhoto {
  return {
    id,
    imageUrl: data.imageUrl as string,
    uploadedByUid: data.uploadedByUid as string,
    kind: (data.kind as RecentPhoto['kind'] | undefined) ?? 'image',
    fileName: data.fileName as string | undefined,
    createdAt: (data.createdAt as Timestamp | undefined)?.toDate() ?? null,
    reactions: readReactions(data.reactions),
    pinned: data.pinned === true,
  };
}

export function FlareDashboard({ user }: { user: User }) {
  const [profileName, setProfileName] = useState(user.displayName?.trim() || 'Tú');
  const [showWebOnboarding, setShowWebOnboarding] = useState(
    () => hasPendingWebOnboarding(user.uid),
  );
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [spacesLoaded, setSpacesLoaded] = useState(false);
  const [activeSpaceId, setActiveSpaceId] = useState('');
  const [profileActiveSpaceId, setProfileActiveSpaceId] = useState('');
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [remindersLoading, setRemindersLoading] = useState(true);
  const [recentMessages, setRecentMessages] = useState<RecentMessage[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<RecentMessage[]>([]);
  const [messagePageSize, setMessagePageSize] = useState(messagePageStep);
  const [recentPhotos, setRecentPhotos] = useState<RecentPhoto[]>([]);
  const [pinnedPhotos, setPinnedPhotos] = useState<RecentPhoto[]>([]);
  const [photoPageSize, setPhotoPageSize] = useState(photoPageStep);
  const [view, setView] = useState<DashboardView>('space');
  const [messageDraft, setMessageDraft] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isGifPickerOpen, setIsGifPickerOpen] = useState(false);
  const [gifMedia, setGifMedia] = useState<Record<string, GiphyGif>>({});
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadKind, setUploadKind] = useState<'image' | 'document' | 'file'>('image');
  const [viewingMessage, setViewingMessage] = useState<RecentMessage | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<RecentPhoto | null>(null);
  const [isPhotoZoomed, setIsPhotoZoomed] = useState(false);
  const [reactionTarget, setReactionTarget] = useState<ReactionTarget | null>(null);
  const [notice, setNotice] = useState('');
  const [browserNotificationPermission, setBrowserNotificationPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);

  const [showReminderForm, setShowReminderForm] = useState(false);
  const [title, setTitle] = useState('');
  const [dueInput, setDueInput] = useState('');
  const [targetUids, setTargetUids] = useState<string[]>([]);
  const [repeatFreq, setRepeatFreq] = useState<RepeatFreq | ''>('');
  const [rotate, setRotate] = useState(false);
  const [isSavingReminder, setIsSavingReminder] = useState(false);
  const [postponingReminder, setPostponingReminder] = useState<Reminder | null>(null);
  const [postponeInput, setPostponeInput] = useState('');
  const [hiddenReminderIds, setHiddenReminderIds] = useState<Set<string>>(new Set());
  const [undoReminders, setUndoReminders] = useState<Reminder[]>([]);
  const pendingReminderDeletes = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const [spaceDialog, setSpaceDialog] = useState<'create' | 'join' | null>(null);
  const [spaceName, setSpaceName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isSavingSpace, setIsSavingSpace] = useState(false);

  useEffect(() => () => {
    for (const timeout of pendingReminderDeletes.current.values()) clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const showQueuedOnboarding = (event: Event) => {
      if ((event as CustomEvent<{ uid?: string }>).detail?.uid === user.uid) {
        setShowWebOnboarding(true);
      }
    };
    window.addEventListener(webOnboardingEventName, showQueuedOnboarding);
    if (hasPendingWebOnboarding(user.uid)) setShowWebOnboarding(true);
    return () => window.removeEventListener(webOnboardingEventName, showQueuedOnboarding);
  }, [user.uid]);

  const showBrowserNotification = (title: string, body: string) => {
    if (browserNotificationPermission !== 'granted' || typeof Notification === 'undefined') return;
    if (document.visibilityState === 'visible') return;
    try {
      new Notification(title, { body, icon: '/icon.png', tag: `flare-${Date.now()}` });
    } catch {
      // Some mobile browsers expose the API but only allow notifications through a
      // service worker. The synchronized content still arrives normally.
    }
  };

  const requestBrowserNotifications = async () => {
    if (typeof Notification === 'undefined') return;
    const permission = await Notification.requestPermission();
    setBrowserNotificationPermission(permission);
  };

  useEffect(() => {
    const profileRef = doc(db, 'users', user.uid);
    return onSnapshot(profileRef, (snapshot) => {
      if (snapshot.exists()) {
        const profile = snapshot.data();
        setProfileName((profile.displayName as string | undefined) ?? 'Tú');
        setProfileActiveSpaceId((profile.activeSpaceId as string | undefined) ?? '');
        return;
      }
      setProfileActiveSpaceId('');
      void setDoc(profileRef, {
        email: user.email ?? '',
        displayName: user.displayName?.trim() || 'Tú',
        createdAt: serverTimestamp(),
      });
    });
  }, [user]);

  useEffect(() => {
    const membershipQuery = query(
      collection(db, 'spaces'),
      where('memberIds', 'array-contains', user.uid),
    );
    return onSnapshot(
      membershipQuery,
      (snapshot) => {
        const next = snapshot.docs
          .map((entry) => readSpace(entry.id, entry.data()))
          .sort((a, b) =>
            a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'personal' ? -1 : 1,
          );
        setSpaces(next);
        setSpacesLoaded(true);
      },
      () => {
        setNotice('No se han podido cargar tus espacios.');
        setSpacesLoaded(true);
      },
    );
  }, [user.uid]);

  useEffect(() => {
    if (!spacesLoaded || spaces.some((space) => space.kind === 'personal')) return;
    void setDoc(doc(db, 'spaces', `personal_${user.uid}`), {
      kind: 'personal',
      name: 'Personal',
      memberIds: [user.uid],
      members: { [user.uid]: { name: profileName } },
      inviteCode: null,
      createdAt: Date.now(),
    }).catch(() => undefined);
  }, [profileName, spaces, spacesLoaded, user.uid]);

  useEffect(() => {
    if (!profileName || !spacesLoaded) return;
    for (const space of spaces) {
      const mine = space.members[user.uid];
      if (mine?.name === profileName) continue;
      void updateDoc(doc(db, 'spaces', space.id), {
        [`members.${user.uid}`]: {
          name: profileName,
          ...(mine?.expoPushToken ? { expoPushToken: mine.expoPushToken } : {}),
        },
      }).catch(() => undefined);
    }
  }, [profileName, spaces, spacesLoaded, user.uid]);

  useEffect(() => {
    setActiveSpaceId(localStorage.getItem(`flare.web.activeSpace.${user.uid}`) ?? '');
  }, [user.uid]);

  const activeSpace = useMemo(
    () =>
      spaces.find((space) => space.id === profileActiveSpaceId && !space.archived) ??
      spaces.find((space) => space.id === activeSpaceId && !space.archived) ??
      spaces.find((space) => space.kind === 'personal') ??
      spaces.find((space) => !space.archived) ??
      null,
    [activeSpaceId, profileActiveSpaceId, spaces],
  );

  useEffect(() => {
    if (!activeSpace || activeSpace.id === activeSpaceId) return;
    setActiveSpaceId(activeSpace.id);
    localStorage.setItem(`flare.web.activeSpace.${user.uid}`, activeSpace.id);
  }, [activeSpace, activeSpaceId, user.uid]);

  useEffect(() => {
    if (!activeSpace) {
      setReminders([]);
      setRemindersLoading(false);
      return undefined;
    }
    setRemindersLoading(true);
    const remindersQuery = query(
      collection(db, 'spaces', activeSpace.id, 'reminders'),
      orderBy('createdAt', 'desc'),
    );
    return onSnapshot(
      remindersQuery,
      (snapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type !== 'added') continue;
          const data = change.doc.data();
          const createdAt = (data.createdAt as Timestamp | undefined)?.toDate();
          const targets = (data.targetUids as string[] | undefined) ?? [];
          if (
            data.createdByUid !== user.uid &&
            targets.includes(user.uid) &&
            createdAt &&
            Date.now() - createdAt.getTime() < 15_000
          ) {
            showBrowserNotification('Nuevo aviso en Flare', data.title as string);
          }
        }
        const next = snapshot.docs
          .flatMap((entry) => {
            const data = entry.data();
            if (data.status === 'done') return [];
            return [{
              id: entry.id,
              title: data.title as string,
              dueAt: (data.dueAt as Timestamp | null | undefined)?.toDate() ?? null,
              dueLabel: (data.dueLabel as string | undefined) ?? 'Sin fecha',
              createdByUid: data.createdByUid as string | undefined,
              targetUids: (data.targetUids as string[] | undefined) ?? [],
              repeat: data.repeat as Reminder['repeat'],
              rotation: data.rotation as Reminder['rotation'],
            }];
          })
          .sort(
            (a, b) =>
              (a.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) -
              (b.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER),
          );
        setReminders(next);
        setRemindersLoading(false);
      },
      () => {
        setNotice('No se han podido cargar los avisos.');
        setRemindersLoading(false);
      },
    );
  }, [activeSpace, browserNotificationPermission, user.uid]);

  useEffect(() => {
    if (!activeSpace) {
      setRecentMessages([]);
      return undefined;
    }
    const messagesQuery = query(
      collection(db, 'spaces', activeSpace.id, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(messagePageSize),
    );
    return onSnapshot(
      messagesQuery,
      (snapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type !== 'added') continue;
          const data = change.doc.data();
          const createdAt = (data.createdAt as Timestamp | undefined)?.toDate();
          if (
            data.senderId !== user.uid &&
            createdAt &&
            Date.now() - createdAt.getTime() < 15_000
          ) {
            showBrowserNotification(
              activeSpace.name,
              data.kind === 'gif' ? 'Te han enviado un GIF' : data.text as string,
            );
          }
        }
        setRecentMessages(
          snapshot.docs
            .map((entry) => readMessage(entry.id, entry.data()))
            .reverse(),
        );
      },
      () => setNotice('No se ha podido cargar el tablón.'),
    );
  }, [activeSpace, browserNotificationPermission, messagePageSize, user.uid]);

  useEffect(() => {
    if (!activeSpace) {
      setPinnedMessages([]);
      return undefined;
    }
    return onSnapshot(
      query(
        collection(db, 'spaces', activeSpace.id, 'messages'),
        where('pinned', '==', true),
      ),
      (snapshot) => setPinnedMessages(
        snapshot.docs
          .map((entry) => readMessage(entry.id, entry.data()))
          .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)),
      ),
      () => setNotice('No se han podido cargar los mensajes fijados.'),
    );
  }, [activeSpace]);

  useEffect(() => {
    if (!activeSpace) {
      setRecentPhotos([]);
      return undefined;
    }
    const photosQuery = query(
      collection(db, 'spaces', activeSpace.id, 'photos'),
      orderBy('createdAt', 'desc'),
      limit(photoPageSize),
    );
    return onSnapshot(
      photosQuery,
      (snapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type !== 'added') continue;
          const data = change.doc.data();
          const createdAt = (data.createdAt as Timestamp | undefined)?.toDate();
          if (
            data.uploadedByUid !== user.uid &&
            createdAt &&
            Date.now() - createdAt.getTime() < 15_000
          ) {
            showBrowserNotification(
              activeSpace.name,
              data.kind === 'document' ? 'Han subido un documento' : 'Han subido una foto',
            );
          }
        }
        setRecentPhotos(
          snapshot.docs.map((entry) => readPhoto(entry.id, entry.data())),
        );
      },
      () => setNotice('No se ha podido cargar el archivo.'),
    );
  }, [activeSpace, browserNotificationPermission, photoPageSize, user.uid]);

  useEffect(() => {
    if (!activeSpace) {
      setPinnedPhotos([]);
      return undefined;
    }
    return onSnapshot(
      query(
        collection(db, 'spaces', activeSpace.id, 'photos'),
        where('pinned', '==', true),
      ),
      (snapshot) => setPinnedPhotos(
        snapshot.docs
          .map((entry) => readPhoto(entry.id, entry.data()))
          .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)),
      ),
      () => setNotice('No se han podido cargar los archivos fijados.'),
    );
  }, [activeSpace]);

  useEffect(() => {
    setMessagePageSize(messagePageStep);
    setPhotoPageSize(photoPageStep);
    setViewingMessage(null);
    setViewingPhoto(null);
  }, [activeSpace?.id]);

  useEffect(() => {
    if (!viewingMessage) return;
    const updated = [...recentMessages, ...pinnedMessages]
      .find((message) => message.id === viewingMessage.id);
    if (updated) setViewingMessage(updated);
  }, [pinnedMessages, recentMessages, viewingMessage?.id]);

  useEffect(() => {
    if (!viewingPhoto) return;
    const updated = [...recentPhotos, ...pinnedPhotos]
      .find((photo) => photo.id === viewingPhoto.id);
    if (updated) setViewingPhoto(updated);
  }, [pinnedPhotos, recentPhotos, viewingPhoto?.id]);

  useEffect(() => {
    setGifMedia({});
  }, [activeSpace?.id]);

  useEffect(() => {
    const ids = [...new Set(
      [...recentMessages, ...pinnedMessages]
        .filter((message) => message.kind === 'gif' && message.gif)
        .map((message) => message.gif!.giphyId),
    )];
    if (ids.length === 0) return;

    let active = true;
    void fetchGiphyGifsById(ids).then((gifs) => {
      if (!active) return;
      setGifMedia(Object.fromEntries(gifs.map((gif) => [gif.giphyId, gif])));
    }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [activeSpace?.id, pinnedMessages, recentMessages]);

  const members = useMemo(
    () =>
      (activeSpace?.memberIds ?? []).map((uid, index) => ({
        uid,
        index,
        name: uid === user.uid ? profileName : activeSpace?.members[uid]?.name || 'Alguien',
      })),
    [activeSpace, profileName, user.uid],
  );

  const activePalette = useMemo(
    () => paletteById(activeSpace?.palette),
    [activeSpace?.palette],
  );
  const myMemberIndex = activeSpace?.memberIds.indexOf(user.uid) ?? 0;
  const myColor = activePalette.lights[Math.max(myMemberIndex, 0)] ?? activePalette.lights[0];
  const dashboardStyle = {
    '--space-first': activePalette.lights[0],
    '--space-second': activePalette.lights[1],
    '--space-accent': activePalette.lens,
    '--my-color': myColor,
  } as React.CSSProperties;

  const rememberActiveSpace = (id: string) => {
    setActiveSpaceId(id);
    setProfileActiveSpaceId(id);
    localStorage.setItem(`flare.web.activeSpace.${user.uid}`, id);
    void updateDoc(doc(db, 'users', user.uid), { activeSpaceId: id }).catch(() => undefined);
  };

  const selectSpace = (id: string) => {
    rememberActiveSpace(id);
  };

  const openReminder = () => {
    const others = members.filter((member) => member.uid !== user.uid).map((member) => member.uid);
    setTargetUids(others.length > 0 ? others : [user.uid]);
    setTitle('');
    setDueInput('');
    setRepeatFreq('');
    setRotate(false);
    setShowReminderForm(true);
  };

  const toggleTarget = (uid: string) => {
    setTargetUids((current) => {
      if (current.includes(uid)) {
        if (current.length === 1) return current;
        const next = current.filter((entry) => entry !== uid);
        if (next.length < 2) setRotate(false);
        return next;
      }
      return [...current, uid];
    });
  };

  const saveReminder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeSpace || !title.trim() || targetUids.length === 0) return;
    setIsSavingReminder(true);
    setNotice('');

    try {
      const dueAt = dueInput ? new Date(dueInput) : null;
      const repeat = dueAt && repeatFreq ? { freq: repeatFreq } : null;
      const rotation = repeat && rotate && targetUids.length > 1 ? { members: targetUids } : null;
      const effectiveTargets = rotation ? [rotation.members[0]] : targetUids;

      const reminderTitle = title.trim();
      await addDoc(collection(db, 'spaces', activeSpace.id, 'reminders'), {
        title: reminderTitle,
        dueAt: dueAt ? Timestamp.fromDate(dueAt) : null,
        dueLabel: dueAt ? formatDueDate(dueAt) : 'Sin fecha',
        status: 'pending',
        createdByUid: user.uid,
        targetUids: effectiveTargets,
        repeat,
        rotation,
        createdAt: serverTimestamp(),
      });

      // A reminder created on the phone can schedule its own local alarm. The browser
      // cannot, so it must wake every selected phone — including this user's phone when
      // the reminder is "Para mí" — and let the mobile listener take over from there.
      const idToken = await user.getIdToken();
      const deliveryResults = await Promise.all(
        effectiveTargets.map(async (recipientUid) => {
          try {
            const response = await fetch(`${workerUrl}/push/send`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({
                spaceId: activeSpace.id,
                recipientUid,
                title: `${profileName} te deja un aviso`,
                message: dueAt
                  ? `${reminderTitle} — ${formatDueDate(dueAt)}`
                  : reminderTitle,
                url: '/reminders',
              }),
            });
            const result = (await response.json().catch(() => ({}))) as { ok?: boolean };
            return response.ok && result.ok === true;
          } catch {
            return false;
          }
        }),
      );

      setShowReminderForm(false);
      setNotice(
        deliveryResults.every(Boolean)
          ? 'Aviso guardado y enviado a los teléfonos seleccionados.'
          : 'Aviso guardado. Algún teléfono no tiene las notificaciones activadas.',
      );
    } catch (caught) {
      setNotice(readableFirebaseError(caught));
    } finally {
      setIsSavingReminder(false);
    }
  };

  const notifyReminderCompleted = async (reminder: Reminder) => {
    if (!activeSpace) return;
    const audience = reminderDoneAudience(reminder.createdByUid, reminder.targetUids, user.uid);
    if (audience.length === 0) return;
    const token = await user.getIdToken();
    await Promise.all(
      audience.map((recipientUid) =>
        fetch(`${workerUrl}/push/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            spaceId: activeSpace.id,
            recipientUid,
            title: 'Hecho',
            message: `${profileName} ha completado «${reminder.title}»`,
            url: '/reminders',
          }),
        }).catch(() => undefined),
      ),
    );
  };

  const finalizeReminder = async (reminder: Reminder) => {
    if (!activeSpace) return;
    pendingReminderDeletes.current.delete(reminder.id);
    setUndoReminders((current) => current.filter((item) => item.id !== reminder.id));
    try {
      await deleteDoc(doc(db, 'spaces', activeSpace.id, 'reminders', reminder.id));
      await notifyReminderCompleted(reminder);
    } catch (caught) {
      setHiddenReminderIds((current) => {
        const next = new Set(current);
        next.delete(reminder.id);
        return next;
      });
      setNotice(readableFirebaseError(caught));
    }
  };

  const completeReminder = async (reminder: Reminder) => {
    if (!activeSpace) return;
    const reminderRef = doc(db, 'spaces', activeSpace.id, 'reminders', reminder.id);
    if (reminder.repeat && reminder.dueAt) {
      try {
        const next = nextOccurrence(reminder.dueAt, reminder.repeat.freq);
        const nextTarget = reminder.rotation
          ? nextRotationTarget(reminder.rotation, reminder.targetUids, activeSpace.memberIds)
          : null;
        await updateDoc(reminderRef, {
          dueAt: Timestamp.fromDate(next),
          dueLabel: formatDueDate(next),
          status: 'pending',
          ...(nextTarget ? { targetUids: [nextTarget] } : {}),
        });
        await notifyReminderCompleted(reminder);
        setNotice(
          nextTarget
            ? `Hecho. El siguiente turno ya está asignado.`
            : `Hecho. Vuelve ${formatDueDate(next).toLowerCase()}.`,
        );
      } catch (caught) {
        setNotice(readableFirebaseError(caught));
      }
      return;
    }

    setHiddenReminderIds((current) => new Set(current).add(reminder.id));
    setUndoReminders((current) => [...current.filter((item) => item.id !== reminder.id), reminder]);
    const timeout = setTimeout(() => void finalizeReminder(reminder), undoWindowMs);
    pendingReminderDeletes.current.set(reminder.id, timeout);
  };

  const undoCompleteReminder = (reminder: Reminder) => {
    const timeout = pendingReminderDeletes.current.get(reminder.id);
    if (timeout) clearTimeout(timeout);
    pendingReminderDeletes.current.delete(reminder.id);
    setHiddenReminderIds((current) => {
      const next = new Set(current);
      next.delete(reminder.id);
      return next;
    });
    setUndoReminders((current) => current.filter((item) => item.id !== reminder.id));
  };

  const openPostponeReminder = (reminder: Reminder) => {
    const initial = new Date(Math.max(Date.now(), reminder.dueAt?.getTime() ?? 0) + 30 * 60_000);
    const pad = (value: number) => String(value).padStart(2, '0');
    setPostponeInput(
      `${initial.getFullYear()}-${pad(initial.getMonth() + 1)}-${pad(initial.getDate())}T${pad(initial.getHours())}:${pad(initial.getMinutes())}`,
    );
    setPostponingReminder(reminder);
  };

  const postponeReminder = async () => {
    if (!activeSpace || !postponingReminder || !postponeInput) return;
    const next = new Date(postponeInput);
    if (Number.isNaN(next.getTime()) || next.getTime() < Date.now()) return;
    try {
      await updateDoc(doc(db, 'spaces', activeSpace.id, 'reminders', postponingReminder.id), {
        dueAt: Timestamp.fromDate(next),
        dueLabel: formatDueDate(next),
        status: 'pending',
      });
      setPostponingReminder(null);
    } catch (caught) {
      setNotice(readableFirebaseError(caught));
    }
  };

  const sendReminderToCalendar = (reminder: Reminder) => {
    if (!reminder.dueAt) return;
    const stamp = (date: Date) => date.toISOString().replace(/[-:]|\.\d{3}/g, '');
    const end = new Date(reminder.dueAt.getTime() + 30 * 60_000);
    const url =
      'https://calendar.google.com/calendar/render?action=TEMPLATE' +
      `&text=${encodeURIComponent(reminder.title)}` +
      `&dates=${stamp(reminder.dueAt)}/${stamp(end)}` +
      `&details=${encodeURIComponent('Aviso de Flare')}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const removeReminder = async (reminder: Reminder) => {
    if (!activeSpace || !confirm(`¿Borrar «${reminder.title}»?`)) return;
    try {
      await deleteDoc(doc(db, 'spaces', activeSpace.id, 'reminders', reminder.id));
    } catch (caught) {
      setNotice(readableFirebaseError(caught));
    }
  };

  const notifyOtherMemberPhones = async (
    message: string,
    destination: '/board' | '/archive',
  ) => {
    if (!activeSpace) return false;
    const token = await user.getIdToken();
    const results = await Promise.all(
      activeSpace.memberIds
        .filter((recipientUid) => recipientUid !== user.uid)
        .map(async (recipientUid) => {
        try {
          const response = await fetch(`${workerUrl}/push/send`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            keepalive: true,
            body: JSON.stringify({
              spaceId: activeSpace.id,
              recipientUid,
              title: profileName,
              message,
              url: destination,
            }),
          });
          const result = (await response.json().catch(() => ({}))) as { ok?: boolean };
          return response.ok && result.ok === true;
        } catch {
          return false;
        }
        }),
    );
    return results.every(Boolean);
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeSpace || !messageDraft.trim() || isSendingMessage) return;
    const text = messageDraft.trim();
    setMessageDraft('');
    setIsSendingMessage(true);
    rememberActiveSpace(activeSpace.id);
    try {
      await addDoc(collection(db, 'spaces', activeSpace.id, 'messages'), {
        text,
        senderId: user.uid,
        createdAt: serverTimestamp(),
      });
      const delivered = await notifyOtherMemberPhones(text, '/board');
      if (!delivered) {
        setNotice('Mensaje enviado, pero algún teléfono no tiene las notificaciones activadas.');
      }
    } catch (caught) {
      setMessageDraft(text);
      setNotice(readableFirebaseError(caught));
    } finally {
      setIsSendingMessage(false);
    }
  };

  const sendGif = async (selectedGif: GiphyGif) => {
    if (!activeSpace) return false;
    rememberActiveSpace(activeSpace.id);
    try {
      await addDoc(collection(db, 'spaces', activeSpace.id, 'messages'), {
        kind: 'gif',
        gif: toGifMessage(selectedGif),
        senderId: user.uid,
        createdAt: serverTimestamp(),
      });
      setGifMedia((current) => ({ ...current, [selectedGif.giphyId]: selectedGif }));
      const delivered = await notifyOtherMemberPhones('Te ha enviado un GIF', '/board');
      if (!delivered) {
        setNotice('GIF enviado, pero algún teléfono no tiene las notificaciones activadas.');
      }
      return true;
    } catch (caught) {
      setNotice(readableFirebaseError(caught));
      return false;
    }
  };

  const reactToContent = async (signal: SignalId | null) => {
    if (!activeSpace || !reactionTarget) return;
    const collectionName = reactionTarget.kind === 'message' ? 'messages' : 'photos';
    try {
      await updateDoc(
        doc(db, 'spaces', activeSpace.id, collectionName, reactionTarget.item.id),
        { [`reactions.${user.uid}`]: signal ?? deleteField() },
      );
      setReactionTarget(null);
    } catch (caught) {
      setNotice(readableFirebaseError(caught));
    }
  };

  const toggleMessagePin = async (message: RecentMessage) => {
    if (!activeSpace) return;
    if (!message.pinned && pinnedMessages.length >= maxPinnedItems) {
      setNotice(`Ya hay ${maxPinnedItems} mensajes fijados. Desfija uno para poner otro.`);
      return;
    }
    try {
      await updateDoc(doc(db, 'spaces', activeSpace.id, 'messages', message.id), {
        pinned: !message.pinned,
      });
      setViewingMessage((current) =>
        current?.id === message.id ? { ...current, pinned: !current.pinned } : current,
      );
    } catch (caught) {
      setNotice(readableFirebaseError(caught));
    }
  };

  const deleteMessage = async (message: RecentMessage) => {
    if (!activeSpace || !confirm('El mensaje desaparecerá para todos. ¿Quieres eliminarlo?')) return;
    try {
      await deleteDoc(doc(db, 'spaces', activeSpace.id, 'messages', message.id));
      setViewingMessage(null);
    } catch (caught) {
      setNotice(readableFirebaseError(caught));
    }
  };

  const togglePhotoPin = async (photo: RecentPhoto) => {
    if (!activeSpace) return;
    if (!photo.pinned && pinnedPhotos.length >= maxPinnedItems) {
      setNotice(`Ya hay ${maxPinnedItems} archivos fijados. Desfija uno para poner otro.`);
      return;
    }
    try {
      await updateDoc(doc(db, 'spaces', activeSpace.id, 'photos', photo.id), {
        pinned: !photo.pinned,
      });
      setViewingPhoto((current) =>
        current?.id === photo.id ? { ...current, pinned: !current.pinned } : current,
      );
    } catch (caught) {
      setNotice(readableFirebaseError(caught));
    }
  };

  const deletePhoto = async (photo: RecentPhoto) => {
    if (!activeSpace || photo.uploadedByUid !== user.uid) return;
    const label = photo.kind === 'document' ? 'documento' : 'foto';
    if (!confirm(`¿Borrar ${label}? Desaparecerá para todos.`)) return;
    try {
      await deleteUploadedFile(activeSpace.id, photo.id);
      setViewingPhoto(null);
    } catch (caught) {
      setNotice(readableFirebaseError(caught));
    }
  };

  const chooseUpload = (kind: 'image' | 'document' | 'file') => {
    setUploadKind(kind);
    window.setTimeout(() => fileInputRef.current?.click(), 0);
  };

  const uploadSelectedFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!activeSpace || !file || isUploadingFile) return;
    const selectedKind = uploadKind === 'file'
      ? file.type.startsWith('image/') ? 'image' : 'document'
      : uploadKind;
    if (selectedKind === 'image' && !file.type.startsWith('image/')) {
      setNotice('Selecciona una imagen.');
      return;
    }
    const documentTypes = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
    ]);
    if (selectedKind === 'document' && !documentTypes.has(file.type)) {
      setNotice('Selecciona un PDF, Word, Excel o archivo de texto.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setNotice('El archivo no puede superar 15 MB.');
      return;
    }

    setIsUploadingFile(true);
    try {
      const uploaded = await uploadFile(file, activeSpace.id, selectedKind);
      await addDoc(collection(db, 'spaces', activeSpace.id, 'photos'), {
        imageUrl: uploaded.imageUrl,
        cloudinaryPublicId: uploaded.publicId,
        uploadedByUid: user.uid,
        kind: selectedKind,
        ...(selectedKind === 'document' ? { fileName: file.name.slice(0, 200) } : {}),
        createdAt: serverTimestamp(),
      });
      const label = selectedKind === 'document' ? 'un documento nuevo' : 'una foto nueva';
      const delivered = await notifyOtherMemberPhones(`Ha subido ${label}`, '/archive');
      setNotice(
        delivered
          ? `${selectedKind === 'document' ? 'Documento' : 'Foto'} subido.`
          : 'Archivo subido, pero algún teléfono no tiene las notificaciones activadas.',
      );
    } catch (caught) {
      setNotice(readableFirebaseError(caught));
    } finally {
      setIsUploadingFile(false);
    }
  };

  const saveSpace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingSpace(true);
    setNotice('');
    try {
      if (spaceDialog === 'create') {
        const code = inviteCode();
        const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
        const spaceRef = doc(collection(db, 'spaces'));
        await setDoc(spaceRef, {
          kind: 'shared',
          name: spaceName.trim() || 'Espacio',
          memberIds: [user.uid],
          members: { [user.uid]: { name: profileName } },
          inviteCode: code,
          inviteCodeExpiresAt: expiresAt,
          createdAt: Date.now(),
        });
        await setDoc(doc(db, 'invites', code), {
          spaceId: spaceRef.id,
          createdAt: Date.now(),
          expiresAt: Timestamp.fromMillis(expiresAt),
        });
        selectSpace(spaceRef.id);
        setNotice(`Espacio creado. Su llave es ${code}.`);
      } else {
        const code = joinCode.trim().toUpperCase();
        const token = await user.getIdToken();
        const response = await fetch(`${workerUrl}/invite/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ code }),
        });
        const result = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          spaceId?: string;
          reason?: string;
        };
        if (!result.ok || !result.spaceId) {
          throw new Error(
            result.reason === 'expired'
              ? 'La llave ha caducado.'
              : result.reason === 'rate-limited'
                ? 'Demasiados intentos. Espera unos minutos.'
                : 'La llave no abre ningún espacio.',
          );
        }
        await updateDoc(doc(db, 'spaces', result.spaceId), {
          memberIds: arrayUnion(user.uid),
          [`members.${user.uid}`]: { name: profileName },
          archived: false,
        });
        selectSpace(result.spaceId);
        setNotice('Ya estás dentro del espacio.');
      }
      setSpaceDialog(null);
      setSpaceName('');
      setJoinCode('');
    } catch (caught) {
      setNotice(readableFirebaseError(caught));
    } finally {
      setIsSavingSpace(false);
    }
  };

  const today = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  const visibleReminders = reminders.filter((reminder) => !hiddenReminderIds.has(reminder.id));
  const regularMessages = recentMessages.filter((message) => !message.pinned);
  const regularPhotos = recentPhotos.filter((photo) => !photo.pinned);
  const viewingPhotoList = viewingPhoto?.pinned ? pinnedPhotos : regularPhotos;
  const viewingPhotoIndex = viewingPhoto
    ? viewingPhotoList.findIndex((photo) => photo.id === viewingPhoto.id)
    : -1;
  const movePhotoViewer = (offset: number) => {
    if (viewingPhotoList.length === 0 || viewingPhotoIndex < 0) return;
    const nextIndex = (viewingPhotoIndex + offset + viewingPhotoList.length) % viewingPhotoList.length;
    setIsPhotoZoomed(false);
    setViewingPhoto(viewingPhotoList[nextIndex]);
  };
  const renderChatMessage = (
    message: RecentMessage,
    index: number,
    list: RecentMessage[],
  ) => {
    const previous = list[index - 1];
    const next = list[index + 1];
    const sender = members.find((member) => member.uid === message.senderId);
    const color = activePalette.lights[sender?.index ?? -1] ?? '#6B7280';
    const gif = message.gif ? gifMedia[message.gif.giphyId] : undefined;
    const isMine = message.senderId === user.uid;
    const startsGroup = !sameMessageGroup(previous, message);
    const endsGroup = !sameMessageGroup(message, next);
    const startsDay = index === 0 || !sameCalendarDay(previous?.createdAt ?? null, message.createdAt);
    const classes = [
      'chat-message',
      isMine ? 'mine' : 'theirs',
      startsGroup ? 'group-start' : '',
      endsGroup ? 'group-end' : '',
      message.kind === 'gif' ? 'has-gif' : '',
    ].filter(Boolean).join(' ');

    return (
      <Fragment key={message.id}>
        {startsDay && (
          <div className="chat-day">
            <span>{messageDay(message.createdAt)}</span>
          </div>
        )}
        <article className={classes} style={{ '--member-color': color } as React.CSSProperties}>
          {!isMine && (
            endsGroup ? (
              <span className="chat-avatar" title={sender?.name ?? 'Alguien'} aria-hidden="true">
                {initials(sender?.name ?? 'A')}
              </span>
            ) : (
              <span className="chat-avatar-placeholder" aria-hidden="true" />
            )
          )}
          <div className="chat-message-content">
            {!isMine && startsGroup && <span className="chat-sender">{sender?.name ?? 'Alguien'}</span>}
            <div
              className="chat-bubble"
              role="button"
              tabIndex={0}
              onClick={() => setViewingMessage(message)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') setViewingMessage(message);
              }}>
              {message.kind === 'gif' && message.gif ? (
                gif ? (
                  <span
                    className="board-gif"
                    style={{ aspectRatio: `${message.gif.width} / ${message.gif.height}` }}>
                    <Image
                      src={gif.mediaUrl}
                      alt={message.gif.altText}
                      fill
                      sizes="(max-width: 640px) 72vw, 360px"
                      unoptimized
                    />
                  </span>
                ) : (
                  <p className="chat-text">{message.text}</p>
                )
              ) : (
                <p className="chat-text"><LinkifiedText text={message.text} /></p>
              )}
              <time className="chat-time" dateTime={message.createdAt?.toISOString()}>
                {messageTime(message.createdAt)}
              </time>
            </div>
            {Object.keys(message.reactions).length > 0 && (
              <div className="content-reactions">
                {Object.entries(message.reactions).map(([uid, signal]) => (
                  <SignalMark
                    id={signal}
                    color={activePalette.lights[members.find((member) => member.uid === uid)?.index ?? -1] ?? '#6B7280'}
                    key={uid}
                  />
                ))}
              </div>
            )}
            <div className="content-actions">
              <button type="button" onClick={() => setReactionTarget({ kind: 'message', item: message })}>
                Responder
              </button>
              <button type="button" onClick={() => toggleMessagePin(message)}>
                {message.pinned ? 'Desfijar' : 'Fijar'}
              </button>
              <button className="danger" type="button" onClick={() => deleteMessage(message)}>
                Eliminar
              </button>
            </div>
          </div>
        </article>
      </Fragment>
    );
  };
  const renderArchiveItem = (photo: RecentPhoto) => {
    const uploader = members.find((member) => member.uid === photo.uploadedByUid);
    const color = activePalette.lights[uploader?.index ?? -1] ?? '#6B7280';
    return (
      <article
        className="archive-preview-item"
        style={{ '--member-color': color } as React.CSSProperties}
        key={photo.id}>
        <button
          className="archive-open"
          type="button"
          onClick={() => {
            setIsPhotoZoomed(false);
            setViewingPhoto(photo);
          }}>
          {photo.kind === 'document' ? (
            <>
              <strong>{fileFormat(photo.fileName)}</strong>
              <small>{photo.fileName ?? 'Documento'}</small>
            </>
          ) : (
            <Image
              src={photo.imageUrl}
              alt={`Foto subida por ${uploader?.name ?? 'un miembro'}`}
              fill
              sizes="(max-width: 640px) 45vw, 240px"
              unoptimized
            />
          )}
        </button>
        {photo.pinned && <span className="pin-badge" title="Fijado">⌖</span>}
        {Object.keys(photo.reactions).length > 0 && (
          <div className="archive-reactions">
            {Object.entries(photo.reactions).map(([uid, signal]) => (
              <SignalMark
                id={signal}
                color={activePalette.lights[members.find((member) => member.uid === uid)?.index ?? -1] ?? '#6B7280'}
                key={uid}
              />
            ))}
          </div>
        )}
        <div className="archive-item-actions">
          <button type="button" onClick={() => setReactionTarget({ kind: 'photo', item: photo })}>
            Responder
          </button>
          <button type="button" onClick={() => togglePhotoPin(photo)}>
            {photo.pinned ? 'Desfijar' : 'Fijar'}
          </button>
        </div>
      </article>
    );
  };

  return (
    <main className="app-shell" style={dashboardStyle}>
      <aside className="sidebar" data-onboarding="navigation">
        <a
          className="brand"
          href="/"
          aria-label="Ir a Espacio"
          onClick={(event) => {
            event.preventDefault();
            setView('space');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}>
          <FlareBrand size={42} />
        </a>
        <nav aria-label="Navegación principal">
          {([
            ['space', 'Espacio', '◉'],
            ['reminders', 'Avisos', '!'],
            ['board', 'Mensajes', '≡'],
            ['archive', 'Archivo', '□'],
            ['settings', 'Ajustes', '⚙'],
          ] as const).map(([destination, label, glyph]) => (
            <button
              className={view === destination ? 'nav-item active' : 'nav-item'}
              type="button"
              onClick={() => setView(destination)}
              key={destination}>
              <span className="nav-light" />
              <span className="nav-icon" aria-hidden="true">{glyph}</span>
              <span className="nav-label">{label}</span>
            </button>
          ))}
        </nav>
        <div className="profile">
          <span className="avatar">{initials(profileName)}</span>
          <span>
            <strong>{profileName}</strong>
            <button type="button" onClick={() => signOut(auth)}>Cerrar sesión</button>
          </span>
        </div>
      </aside>

      <section className="workspace">
        {view !== 'space' && (
          <header className="topbar">
            <div className="space-heading">
              <p className="eyebrow">{activeSpace?.kind === 'personal' ? 'ESPACIO PERSONAL' : 'ESPACIO COMPARTIDO'}</p>
              <select
                className="space-select"
                value={activeSpace?.id ?? ''}
                onChange={(event) => selectSpace(event.target.value)}
                aria-label="Espacio activo">
                {spaces.filter((space) => !space.archived).map((space) => (
                  <option key={space.id} value={space.id}>{space.name}</option>
                ))}
              </select>
            </div>
            <div className="topbar-actions">
              <button className="quiet-button" type="button" onClick={() => setSpaceDialog('join')}>
                Entrar con llave
              </button>
              <button className="quiet-button" type="button" onClick={() => setSpaceDialog('create')}>
                Nuevo espacio
              </button>
              <div className="people" aria-label="Miembros del espacio">
                {members.map((member) => (
                  <span
                    className="person dynamic"
                    style={{ '--member-color': activePalette.lights[member.index] ?? '#6B7280' } as React.CSSProperties}
                    title={member.name}
                    key={member.uid}>
                    {initials(member.name)}
                  </span>
                ))}
              </div>
            </div>
          </header>
        )}

        {notice && (
          <button className="notice-banner" type="button" onClick={() => setNotice('')}>
            {notice}<span>×</span>
          </button>
        )}
        {undoReminders.map((reminder) => (
          <div className="undo-banner" role="status" key={reminder.id}>
            <span>Aviso completado</span>
            <button type="button" onClick={() => undoCompleteReminder(reminder)}>Deshacer</button>
          </div>
        ))}

        {view === 'space' && (
          <div className="space-dashboard">
            <header className="space-dashboard-hero">
              <div>
                <p className="eyebrow">{today.toUpperCase()}</p>
                <h1>Espacio</h1>
                <p>Todo lo que compartís, en un mismo lugar.</p>
              </div>
              {activeSpace?.kind === 'shared' && activeSpace.inviteCode && (
                <button
                  className="invite-pill"
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(activeSpace.inviteCode ?? '');
                    setNotice('Llave copiada.');
                  }}>
                  Llave · {activeSpace.inviteCode}
                </button>
              )}
            </header>

            <section
              className="space-switcher"
              data-onboarding="spaces"
              aria-labelledby="spaces-title">
              <div className="space-dashboard-section-heading">
                <div>
                  <p className="eyebrow">DONDE COLABORAS</p>
                  <h2 id="spaces-title">Tus espacios</h2>
                </div>
                <span className="space-dashboard-heading-actions">
                  <button
                    data-onboarding="join-space"
                    type="button"
                    onClick={() => setSpaceDialog('join')}>
                    Entrar con llave
                  </button>
                  <button
                    data-onboarding="create-space"
                    type="button"
                    onClick={() => setSpaceDialog('create')}>
                    Nuevo espacio
                  </button>
                </span>
              </div>
              <div className="space-card-grid">
                {spaces.filter((space) => !space.archived).map((space) => {
                  const palette = paletteById(space.palette);
                  const spaceStyle = {
                    '--card-first': palette.lights[0],
                    '--card-second': palette.lights[1],
                    '--card-accent': palette.lens,
                  } as React.CSSProperties;
                  return (
                    <button
                      className={space.id === activeSpace?.id ? 'space-card active' : 'space-card'}
                      style={spaceStyle}
                      type="button"
                      onClick={() => selectSpace(space.id)}
                      aria-pressed={space.id === activeSpace?.id}
                      key={space.id}>
                      <span className="space-card-icon" aria-hidden="true">
                        {space.kind === 'personal' ? initials(profileName) : initials(space.name)}
                      </span>
                      <span className="space-card-copy">
                        <strong>{space.name}</strong>
                        <small>
                          {space.kind === 'personal'
                            ? 'Tu espacio personal'
                            : `${space.memberIds.length} ${space.memberIds.length === 1 ? 'integrante' : 'integrantes'}`}
                        </small>
                      </span>
                      <span className="space-card-status" aria-hidden="true">•••</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="space-dashboard-grid">
              <section className="space-dashboard-panel">
                <div className="space-dashboard-section-heading compact">
                  <div>
                    <p className="eyebrow">PRÓXIMO</p>
                    <h2>Avisos recientes</h2>
                  </div>
                  <button type="button" onClick={() => setView('reminders')}>Ver todos</button>
                </div>
                {remindersLoading ? (
                  <div className="dashboard-empty skeleton" />
                ) : visibleReminders.length === 0 ? (
                  <button className="dashboard-empty" type="button" onClick={() => setView('reminders')}>
                    <span className="dashboard-empty-icon" aria-hidden="true">!</span>
                    <span><strong>Nada pendiente</strong><small>Crea el primer aviso del espacio.</small></span>
                  </button>
                ) : (
                  <div className="dashboard-list">
                    {visibleReminders.slice(0, 3).map((reminder) => {
                      const creator = members.find((member) => member.uid === reminder.createdByUid);
                      const color = activePalette.lights[creator?.index ?? -1] ?? '#6B7280';
                      return (
                        <article className="dashboard-list-item" key={reminder.id}>
                          <button
                            className="dashboard-list-icon"
                            style={{ '--item-color': color } as React.CSSProperties}
                            type="button"
                            onClick={() => setView('reminders')}
                            aria-label={`Abrir aviso ${reminder.title}`}>
                            !
                          </button>
                          <button className="dashboard-list-copy" type="button" onClick={() => setView('reminders')}>
                            <strong>{reminder.title}</strong>
                            <small>{reminder.dueAt ? formatDueDate(reminder.dueAt) : reminder.dueLabel}</small>
                          </button>
                          {reminder.dueAt && (
                            <button
                              className="dashboard-list-action"
                              type="button"
                              onClick={() => sendReminderToCalendar(reminder)}
                              aria-label={`Añadir ${reminder.title} al calendario`}>
                              +
                            </button>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="space-dashboard-panel">
                <div className="space-dashboard-section-heading compact">
                  <div>
                    <p className="eyebrow">CONVERSACIÓN</p>
                    <h2>Mensajes</h2>
                  </div>
                  <button type="button" onClick={() => setView('board')}>Ver todos</button>
                </div>
                {regularMessages.length === 0 && pinnedMessages.length === 0 ? (
                  <button className="dashboard-empty" type="button" onClick={() => setView('board')}>
                    <span className="dashboard-empty-icon blue" aria-hidden="true">≡</span>
                    <span><strong>Empieza la conversación</strong><small>El primer mensaje sigue libre.</small></span>
                  </button>
                ) : (
                  <div className="dashboard-list">
                    {recentMessages.slice(-4).reverse().map((message) => {
                      const sender = members.find((member) => member.uid === message.senderId);
                      const color = activePalette.lights[sender?.index ?? -1] ?? '#6B7280';
                      return (
                        <button
                          className="dashboard-list-item message"
                          style={{ '--item-color': color } as React.CSSProperties}
                          type="button"
                          onClick={() => setView('board')}
                          key={message.id}>
                          <span className="dashboard-message-avatar">{initials(sender?.name ?? 'Alguien')}</span>
                          <span className="dashboard-list-copy">
                            <strong>{sender?.name ?? 'Alguien'}</strong>
                            <small>{previewText(message.text, 58)}</small>
                          </span>
                          <time>{messageTime(message.createdAt)}</time>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            <section className="space-dashboard-panel files">
              <div className="space-dashboard-section-heading compact">
                <div>
                  <p className="eyebrow">COMPARTIDO</p>
                  <h2>Archivos recientes</h2>
                </div>
                <span className="space-dashboard-heading-actions">
                  <button type="button" onClick={() => chooseUpload('file')} disabled={isUploadingFile}>
                    {isUploadingFile ? 'Subiendo…' : 'Subir archivo'}
                  </button>
                  <button type="button" onClick={() => setView('archive')}>Ver todos</button>
                </span>
              </div>
              {recentPhotos.length === 0 ? (
                <button className="dashboard-empty horizontal" type="button" onClick={() => setView('archive')}>
                  <span className="dashboard-empty-icon blue" aria-hidden="true">□</span>
                  <span><strong>Aún no hay archivos</strong><small>Comparte una foto o un documento con el espacio.</small></span>
                </button>
              ) : (
                <div className="dashboard-file-grid">
                  {recentPhotos.slice(0, 5).map((photo) => (
                    <button
                      className="dashboard-file"
                      type="button"
                      onClick={() => {
                        setIsPhotoZoomed(false);
                        setViewingPhoto(photo);
                      }}
                      key={photo.id}>
                      {photo.kind === 'document' ? (
                        <strong>{fileFormat(photo.fileName)}</strong>
                      ) : (
                        <Image
                          src={photo.imageUrl}
                          alt=""
                          fill
                          sizes="(max-width: 640px) 42vw, 150px"
                          unoptimized
                        />
                      )}
                      <span>{photo.fileName ?? (photo.kind === 'image' ? 'Foto compartida' : 'Documento')}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {view === 'reminders' && (
        <section className="section-block">
          <div className="section-heading">
            <div>
              <p className="eyebrow">PARA QUIEN TÚ ELIJAS</p>
              <h2>Avisos</h2>
            </div>
            <div className="section-heading-actions">
              {browserNotificationPermission !== 'unsupported' &&
                browserNotificationPermission !== 'granted' && (
                  <button
                    className="quiet-button"
                    type="button"
                    disabled={browserNotificationPermission === 'denied'}
                    onClick={requestBrowserNotifications}>
                    {browserNotificationPermission === 'denied'
                      ? 'Avisos web bloqueados'
                      : 'Activar avisos web'}
                  </button>
                )}
              <button
                className="primary-button reminder-create-button"
                type="button"
                onClick={openReminder}>
                Nuevo aviso
              </button>
            </div>
          </div>

          {showReminderForm && (
            <form className="reminder-form panel" onSubmit={saveReminder}>
              <div className="form-title-row">
                <div>
                  <p className="eyebrow">NUEVO AVISO</p>
                  <h3>¿Qué no se puede olvidar?</h3>
                </div>
                <button className="icon-button" type="button" onClick={() => setShowReminderForm(false)}>×</button>
              </div>
              <input
                className="large-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                placeholder="Escribe el aviso"
                autoFocus
                required
              />
              <div className="form-grid">
                <label>
                  Fecha y hora
                  <ReminderDateTimePicker
                    value={dueInput}
                    onChange={setDueInput}
                  />
                </label>
                <label>
                  Repetición
                  <select
                    value={repeatFreq}
                    onChange={(event) => setRepeatFreq(event.target.value as RepeatFreq | '')}
                    disabled={!dueInput}>
                    <option value="">No se repite</option>
                    {Object.entries(RepeatLabel).map(([value, label]) => (
                      <option value={value} key={value}>{label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <fieldset>
                <legend>¿En qué teléfonos debe sonar?</legend>
                <div className="target-list">
                  {members.map((member) => {
                    const selected = targetUids.includes(member.uid);
                    return (
                      <button
                        className={selected ? 'target-chip selected' : 'target-chip'}
                        type="button"
                        onClick={() => toggleTarget(member.uid)}
                        key={member.uid}>
                        <i style={{ background: activePalette.lights[member.index] ?? '#6B7280' }} />
                        {member.uid === user.uid ? 'Para mí' : member.name}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              {dueInput && repeatFreq && targetUids.length > 1 && (
                <label className="rotation-toggle">
                  <input type="checkbox" checked={rotate} onChange={(event) => setRotate(event.target.checked)} />
                  Rotar el turno entre las personas seleccionadas
                </label>
              )}
              <div className="form-actions">
                <button className="quiet-button" type="button" onClick={() => setShowReminderForm(false)}>Cancelar</button>
                <button className="primary-button" type="submit" disabled={isSavingReminder}>
                  {isSavingReminder ? 'Guardando…' : 'Guardar aviso'}
                </button>
              </div>
            </form>
          )}

          {remindersLoading ? (
            <div className="reminder-grid">
              {[0, 1, 2].map((item) => <div className="reminder-card skeleton" key={item} />)}
            </div>
          ) : visibleReminders.length === 0 ? (
            <article className="empty-state panel">
              <div className="orbit" aria-hidden="true"><i /><i /></div>
              <h3>Nada pendiente por ahora.</h3>
              <p>Todos los miembros del espacio pueden crear el siguiente aviso.</p>
            </article>
          ) : (
            <div className="reminder-grid">
              {visibleReminders.map((reminder) => {
                const target = members.find((member) => member.uid === reminder.targetUids[0]);
                const color = activePalette.lights[target?.index ?? -1] ?? '#6B7280';
                return (
                  <article
                    className="reminder-card real"
                    style={{ '--member-color': color } as React.CSSProperties}
                    key={reminder.id}>
                    <div className="card-light" />
                    <div className="reminder-copy">
                      <p>{reminder.title}</p>
                      <span>
                        {reminder.dueAt ? formatDueDate(reminder.dueAt) : reminder.dueLabel}
                        {reminder.repeat ? ` · ${RepeatLabel[reminder.repeat.freq]}` : ''}
                      </span>
                      <small>
                        Para {reminder.targetUids.map((uid) =>
                          uid === user.uid ? 'ti' : members.find((member) => member.uid === uid)?.name ?? 'alguien',
                        ).join(', ')}
                      </small>
                    </div>
                    <div className="reminder-actions">
                      <button type="button" onClick={() => completeReminder(reminder)}>Hecho</button>
                      <button type="button" onClick={() => openPostponeReminder(reminder)}>Posponer</button>
                      {reminder.dueAt && (
                        <button type="button" onClick={() => sendReminderToCalendar(reminder)}>Calendario</button>
                      )}
                      <button className="danger" type="button" onClick={() => removeReminder(reminder)}>Borrar</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
        )}

        {view === 'board' && (
          <section className="section-block chat-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">CONVERSACIÓN DEL ESPACIO</p>
                <h2>Mensajes</h2>
              </div>
            </div>
            <div className="chat-panel">
              {recentMessages.length === 0 ? (
                <article className="empty-state chat-empty">
                  <div className="orbit" aria-hidden="true"><i /><i /></div>
                  <h3>Todavía nada.</h3>
                  <p>Escribe el primer mensaje o comparte un GIF.</p>
                </article>
              ) : (
                <div
                  className="chat-thread"
                  role="log"
                  aria-label="Conversación"
                  aria-live="polite">
                  {pinnedMessages.length > 0 && (
                    <div className="pinned-content">
                      <span className="eyebrow">FIJADOS</span>
                      {pinnedMessages.map((message, index) =>
                        renderChatMessage(message, index, pinnedMessages),
                      )}
                    </div>
                  )}
                  {regularMessages.map((message, index) =>
                    renderChatMessage(message, index, regularMessages),
                  )}
                  {recentMessages.length >= messagePageSize && (
                    <button
                      className="load-more-button"
                      type="button"
                      onClick={() => setMessagePageSize((current) => current + messagePageStep)}>
                      Ver mensajes anteriores
                    </button>
                  )}
                </div>
              )}
              <form className="message-composer" onSubmit={sendMessage}>
                <button
                  className="gif-button"
                  type="button"
                  aria-label="Buscar un GIF"
                  onClick={() => setIsGifPickerOpen(true)}>
                  GIF
                </button>
                <input
                  value={messageDraft}
                  onChange={(event) => setMessageDraft(event.target.value)}
                  maxLength={500}
                  placeholder="Escribe un mensaje…"
                  aria-label="Mensaje"
                />
                <button
                  className="primary-button chat-send-button"
                  type="submit"
                  disabled={!messageDraft.trim() || isSendingMessage}>
                  {isSendingMessage ? '…' : 'Enviar'}
                </button>
              </form>
            </div>
          </section>
        )}

        {view === 'archive' && (
          <section className="section-block">
            <div className="section-heading">
              <div>
                <p className="eyebrow">FOTOS Y DOCUMENTOS</p>
                <h2>Archivo</h2>
              </div>
              <div className="section-heading-actions">
                <button
                  className="quiet-button"
                  type="button"
                  disabled={isUploadingFile}
                  onClick={() => chooseUpload('document')}>
                  Subir documento
                </button>
                <button
                  className="primary-button"
                  type="button"
                  disabled={isUploadingFile}
                  onClick={() => chooseUpload('image')}>
                  {isUploadingFile ? 'Subiendo…' : 'Subir foto'}
                </button>
              </div>
            </div>
            {regularPhotos.length === 0 && pinnedPhotos.length === 0 ? (
              <article className="empty-state panel">
                <h3>Todavía no hay archivos.</h3>
                <p>Sube una foto o un documento para compartirlo con el espacio.</p>
              </article>
            ) : (
              <>
                {pinnedPhotos.length > 0 && (
                  <div className="archive-pinned">
                    <span className="eyebrow">FIJADOS</span>
                    <div className="archive-preview-grid">
                      {pinnedPhotos.map(renderArchiveItem)}
                    </div>
                  </div>
                )}
                <div className="archive-preview-grid">
                  {regularPhotos.map(renderArchiveItem)}
                </div>
                {recentPhotos.length >= photoPageSize && (
                  <button
                    className="load-more-button"
                    type="button"
                    onClick={() => setPhotoPageSize((current) => current + photoPageStep)}>
                    Ver archivos anteriores
                  </button>
                )}
              </>
            )}
          </section>
        )}

        {view === 'settings' && (
          <SettingsPanel
            user={user}
            profileName={profileName}
            space={activeSpace}
            spaces={spaces}
            members={members}
            palette={activePalette}
            workerUrl={workerUrl}
            onCreateSpace={() => setSpaceDialog('create')}
            onJoinSpace={() => setSpaceDialog('join')}
            onSelectSpace={selectSpace}
            onNotice={setNotice}
          />
        )}

      </section>

      {spaceDialog && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSpaceDialog(null)}>
          <form className="modal-card" onSubmit={saveSpace} onMouseDown={(event) => event.stopPropagation()}>
            <button className="icon-button modal-close" type="button" onClick={() => setSpaceDialog(null)}>×</button>
            <p className="eyebrow">{spaceDialog === 'create' ? 'NUEVO CÍRCULO' : 'ENTRAR EN UN ESPACIO'}</p>
            <h2>{spaceDialog === 'create' ? 'Crea un espacio' : 'Usa la llave'}</h2>
            <p>
              {spaceDialog === 'create'
                ? 'Tendrás una llave de seis caracteres para invitar hasta siete personas.'
                : 'Pide a alguien del espacio que comparta contigo su llave.'}
            </p>
            {spaceDialog === 'create' ? (
              <label>
                Nombre
                <input value={spaceName} onChange={(event) => setSpaceName(event.target.value)} maxLength={28} required />
              </label>
            ) : (
              <label>
                Llave
                <input
                  className="code-input"
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  minLength={6}
                  maxLength={6}
                  required
                />
              </label>
            )}
            <button className="primary-button auth-submit" type="submit" disabled={isSavingSpace}>
              {isSavingSpace ? 'Un momento…' : spaceDialog === 'create' ? 'Crear espacio' : 'Entrar'}
            </button>
          </form>
        </div>
      )}
      <input
        className="visually-hidden"
        ref={fileInputRef}
        type="file"
        accept={
          uploadKind === 'image'
            ? 'image/*'
            : uploadKind === 'file'
              ? 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain'
            : '.pdf,.doc,.docx,.xls,.xlsx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain'
        }
        onChange={uploadSelectedFile}
        tabIndex={-1}
      />
      {reactionTarget && (
        <SignalPicker
          current={reactionTarget.item.reactions[user.uid] ?? null}
          onPick={reactToContent}
          onClose={() => setReactionTarget(null)}
        />
      )}
      {postponingReminder && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setPostponingReminder(null)}>
          <section
            className="modal-card postpone-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Posponer aviso"
            onMouseDown={(event) => event.stopPropagation()}>
            <button className="icon-button modal-close" type="button" onClick={() => setPostponingReminder(null)}>×</button>
            <p className="eyebrow">POSPONER AVISO</p>
            <h2>{postponingReminder.title}</h2>
            <ReminderDateTimePicker
              value={postponeInput}
              onChange={setPostponeInput}
              min={new Date()}
            />
            <div className="form-actions">
              <button className="quiet-button" type="button" onClick={() => setPostponingReminder(null)}>Cancelar</button>
              <button className="primary-button" type="button" disabled={!postponeInput} onClick={postponeReminder}>
                Guardar nueva fecha
              </button>
            </div>
          </section>
        </div>
      )}
      {viewingMessage && (
        <div className="modal-backdrop content-viewer-backdrop" role="presentation" onMouseDown={() => setViewingMessage(null)}>
          <section
            className="content-viewer message-viewer"
            role="dialog"
            aria-modal="true"
            aria-label="Mensaje"
            onMouseDown={(event) => event.stopPropagation()}>
            <button className="icon-button viewer-close" type="button" onClick={() => setViewingMessage(null)}>×</button>
            <div className="message-viewer-body">
              {viewingMessage.kind === 'gif' && viewingMessage.gif && gifMedia[viewingMessage.gif.giphyId] ? (
                <Image
                  src={gifMedia[viewingMessage.gif.giphyId].mediaUrl}
                  alt={viewingMessage.gif.altText}
                  fill
                  sizes="90vw"
                  unoptimized
                />
              ) : (
                <p><LinkifiedText text={viewingMessage.text} /></p>
              )}
            </div>
            <div className="viewer-toolbar">
              <div className="viewer-reactions">
                {Object.entries(viewingMessage.reactions).map(([uid, signal]) => (
                  <SignalMark
                    id={signal}
                    color={activePalette.lights[members.find((member) => member.uid === uid)?.index ?? -1] ?? '#6B7280'}
                    key={uid}
                  />
                ))}
              </div>
              <button type="button" onClick={() => setReactionTarget({ kind: 'message', item: viewingMessage })}>
                Responder
              </button>
              <button type="button" onClick={() => toggleMessagePin(viewingMessage)}>
                {viewingMessage.pinned ? 'Desfijar' : 'Fijar'}
              </button>
              <button className="danger" type="button" onClick={() => deleteMessage(viewingMessage)}>
                Eliminar
              </button>
            </div>
          </section>
        </div>
      )}
      {viewingPhoto && (
        <div className="modal-backdrop content-viewer-backdrop" role="presentation" onMouseDown={() => setViewingPhoto(null)}>
          <section
            className="content-viewer archive-viewer"
            role="dialog"
            aria-modal="true"
            aria-label={viewingPhoto.kind === 'document' ? 'Documento' : 'Foto'}
            onMouseDown={(event) => event.stopPropagation()}>
            <button className="icon-button viewer-close" type="button" onClick={() => setViewingPhoto(null)}>×</button>
            {viewingPhotoList.length > 1 && (
              <>
                <button className="viewer-arrow previous" type="button" onClick={() => movePhotoViewer(-1)} aria-label="Anterior">‹</button>
                <button className="viewer-arrow next" type="button" onClick={() => movePhotoViewer(1)} aria-label="Siguiente">›</button>
              </>
            )}
            {viewingPhoto.kind === 'document' ? (
              <div className="document-viewer">
                <strong>{fileFormat(viewingPhoto.fileName)}</strong>
                <h2>{viewingPhoto.fileName ?? 'Documento'}</h2>
                <a className="primary-button" href={viewingPhoto.imageUrl} target="_blank" rel="noreferrer">
                  Abrir documento
                </a>
              </div>
            ) : (
              <button
                className={isPhotoZoomed ? 'image-viewer zoomed' : 'image-viewer'}
                type="button"
                aria-label={isPhotoZoomed ? 'Reducir foto' : 'Ampliar foto'}
                onClick={() => setIsPhotoZoomed((current) => !current)}>
                <Image
                  src={viewingPhoto.imageUrl}
                  alt=""
                  fill
                  sizes="95vw"
                  unoptimized
                />
              </button>
            )}
            <div className="viewer-toolbar">
              <div className="viewer-reactions">
                {Object.entries(viewingPhoto.reactions).map(([uid, signal]) => (
                  <SignalMark
                    id={signal}
                    color={activePalette.lights[members.find((member) => member.uid === uid)?.index ?? -1] ?? '#6B7280'}
                    key={uid}
                  />
                ))}
              </div>
              <button type="button" onClick={() => setReactionTarget({ kind: 'photo', item: viewingPhoto })}>
                Responder
              </button>
              <button type="button" onClick={() => togglePhotoPin(viewingPhoto)}>
                {viewingPhoto.pinned ? 'Desfijar' : 'Fijar'}
              </button>
              {viewingPhoto.uploadedByUid === user.uid && (
                <button className="danger" type="button" onClick={() => deletePhoto(viewingPhoto)}>
                  Eliminar
                </button>
              )}
            </div>
          </section>
        </div>
      )}
      <GifPicker
        isOpen={isGifPickerOpen}
        onClose={() => setIsGifPickerOpen(false)}
        onSelect={sendGif}
      />
      {showWebOnboarding && view === 'space' && (
        <WebOnboardingTour
          onFinish={() => {
            completeWebOnboarding(user.uid);
            setShowWebOnboarding(false);
          }}
        />
      )}
    </main>
  );
}
