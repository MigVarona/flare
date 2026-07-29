'use client';

import {
  formatDueDate,
  nextOccurrence,
  RepeatLabel,
  type RepeatFreq,
} from '@flare/core/dates';
import {
  nextRotationTarget,
  type Rotation,
} from '@flare/core/reminders';
import { signOut, type User } from 'firebase/auth';
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
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
import { ReminderDateTimePicker } from '@/components/reminder-date-time-picker';
import { SettingsPanel } from '@/components/settings-panel';
import { auth, db } from '@/lib/firebase';
import { readableFirebaseError } from '@/lib/firebase-errors';
import { GifPicker } from '@/components/gif-picker';
import {
  fetchGiphyGifsById,
  toGifMessage,
  type GifMessage,
  type GiphyGif,
} from '@/lib/giphy';
import { uploadPhoto } from '@/lib/uploads';
import { paletteById } from '@/lib/palettes';

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
};
type RecentPhoto = {
  id: string;
  imageUrl: string;
  uploadedByUid: string;
  kind: 'image' | 'document';
  fileName?: string;
};

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
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

export function FlareDashboard({ user }: { user: User }) {
  const [profileName, setProfileName] = useState(user.displayName?.trim() || 'Tú');
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [spacesLoaded, setSpacesLoaded] = useState(false);
  const [activeSpaceId, setActiveSpaceId] = useState('');
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [remindersLoading, setRemindersLoading] = useState(true);
  const [recentMessages, setRecentMessages] = useState<RecentMessage[]>([]);
  const [recentPhotos, setRecentPhotos] = useState<RecentPhoto[]>([]);
  const [view, setView] = useState<DashboardView>('space');
  const [messageDraft, setMessageDraft] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isGifPickerOpen, setIsGifPickerOpen] = useState(false);
  const [gifMedia, setGifMedia] = useState<Record<string, GiphyGif>>({});
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState('');

  const [showReminderForm, setShowReminderForm] = useState(false);
  const [title, setTitle] = useState('');
  const [dueInput, setDueInput] = useState('');
  const [targetUids, setTargetUids] = useState<string[]>([]);
  const [repeatFreq, setRepeatFreq] = useState<RepeatFreq | ''>('');
  const [rotate, setRotate] = useState(false);
  const [isSavingReminder, setIsSavingReminder] = useState(false);

  const [spaceDialog, setSpaceDialog] = useState<'create' | 'join' | null>(null);
  const [spaceName, setSpaceName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isSavingSpace, setIsSavingSpace] = useState(false);

  useEffect(() => {
    const profileRef = doc(db, 'users', user.uid);
    return onSnapshot(profileRef, (snapshot) => {
      if (snapshot.exists()) {
        setProfileName((snapshot.data().displayName as string | undefined) ?? 'Tú');
        return;
      }
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
      spaces.find((space) => space.id === activeSpaceId && !space.archived) ??
      spaces.find((space) => space.kind === 'personal') ??
      spaces.find((space) => !space.archived) ??
      null,
    [activeSpaceId, spaces],
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
  }, [activeSpace]);

  useEffect(() => {
    if (!activeSpace) {
      setRecentMessages([]);
      return undefined;
    }
    const messagesQuery = query(
      collection(db, 'spaces', activeSpace.id, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(40),
    );
    return onSnapshot(
      messagesQuery,
      (snapshot) => {
        setRecentMessages(
          snapshot.docs
            .map((entry) => {
              const data = entry.data();
              const gif = data.gif as { title?: string } | undefined;
              return {
                id: entry.id,
                text:
                  typeof data.text === 'string'
                    ? data.text
                    : gif?.title
                      ? `GIF · ${gif.title}`
                      : 'GIF',
                kind: data.kind === 'gif' && gif ? 'gif' as const : 'text' as const,
                gif: gif as GifMessage | undefined,
                senderId: data.senderId as string,
                createdAt: (data.createdAt as Timestamp | undefined)?.toDate() ?? null,
              };
            })
            .reverse(),
        );
      },
      () => setNotice('No se ha podido cargar el tablón.'),
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
      limit(30),
    );
    return onSnapshot(
      photosQuery,
      (snapshot) => {
        setRecentPhotos(
          snapshot.docs.map((entry) => {
            const data = entry.data();
            return {
              id: entry.id,
              imageUrl: data.imageUrl as string,
              uploadedByUid: data.uploadedByUid as string,
              kind: (data.kind as RecentPhoto['kind'] | undefined) ?? 'image',
              fileName: data.fileName as string | undefined,
            };
          }),
        );
      },
      () => setNotice('No se ha podido cargar el archivo.'),
    );
  }, [activeSpace]);

  useEffect(() => {
    setGifMedia({});
  }, [activeSpace?.id]);

  useEffect(() => {
    const ids = [...new Set(
      recentMessages
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
  }, [activeSpace?.id, recentMessages]);

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

  const selectSpace = (id: string) => {
    setActiveSpaceId(id);
    localStorage.setItem(`flare.web.activeSpace.${user.uid}`, id);
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

  const completeReminder = async (reminder: Reminder) => {
    if (!activeSpace) return;
    try {
      const reminderRef = doc(db, 'spaces', activeSpace.id, 'reminders', reminder.id);
      if (reminder.repeat && reminder.dueAt) {
        const next = nextOccurrence(reminder.dueAt, reminder.repeat.freq);
        const nextTarget = reminder.rotation
          ? nextRotationTarget(reminder.rotation, reminder.targetUids, activeSpace.memberIds)
          : null;
        await updateDoc(reminderRef, {
          dueAt: Timestamp.fromDate(next),
          dueLabel: formatDueDate(next),
          ...(nextTarget ? { targetUids: [nextTarget] } : {}),
        });
      } else {
        await deleteDoc(reminderRef);
      }
    } catch (caught) {
      setNotice(readableFirebaseError(caught));
    }
  };

  const postponeReminder = async (reminder: Reminder) => {
    if (!activeSpace) return;
    const next = new Date(Math.max(Date.now(), reminder.dueAt?.getTime() ?? 0) + 30 * 60_000);
    try {
      await updateDoc(doc(db, 'spaces', activeSpace.id, 'reminders', reminder.id), {
        dueAt: Timestamp.fromDate(next),
        dueLabel: formatDueDate(next),
        status: 'pending',
      });
    } catch (caught) {
      setNotice(readableFirebaseError(caught));
    }
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

  const uploadSelectedPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!activeSpace || !file || isUploadingPhoto) return;
    if (!file.type.startsWith('image/')) {
      setNotice('Selecciona una imagen.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setNotice('La foto no puede superar 15 MB.');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const uploaded = await uploadPhoto(file, activeSpace.id);
      await addDoc(collection(db, 'spaces', activeSpace.id, 'photos'), {
        imageUrl: uploaded.imageUrl,
        cloudinaryPublicId: uploaded.publicId,
        uploadedByUid: user.uid,
        kind: 'image',
        createdAt: serverTimestamp(),
      });
      const delivered = await notifyOtherMemberPhones('Ha subido una foto nueva', '/archive');
      setNotice(
        delivered
          ? 'Foto subida.'
          : 'Foto subida, pero algún teléfono no tiene las notificaciones activadas.',
      );
    } catch (caught) {
      setNotice(readableFirebaseError(caught));
    } finally {
      setIsUploadingPhoto(false);
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

  return (
    <main className="app-shell" style={dashboardStyle}>
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="Flare">
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

        {notice && (
          <button className="notice-banner" type="button" onClick={() => setNotice('')}>
            {notice}<span>×</span>
          </button>
        )}

        {view === 'space' && <div className="welcome">
          <div>
            <p className="eyebrow">{today.toUpperCase()}</p>
            <h1>Todo el espacio, al día.</h1>
            <p>
              {activeSpace?.kind === 'personal'
                ? 'Tu lugar para acordarte de lo que importa.'
                : `${members.length} personas colaboran en este espacio en tiempo real.`}
            </p>
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
        </div>}

        {view === 'space' && (
          <div className="space-overview">
            <section className="overview-section">
              <button className="overview-heading" type="button" onClick={() => setView('reminders')}>
                <span>
                  <span className="eyebrow">PRÓXIMO</span>
                  <strong>Avisos</strong>
                </span>
                <span>Ver todos →</span>
              </button>
              {remindersLoading ? (
                <div className="overview-card skeleton" />
              ) : reminders.length === 0 ? (
                <button className="overview-card empty-overview" type="button" onClick={() => setView('reminders')}>
                  Nada pendiente por ahora.
                </button>
              ) : (
                <div className="overview-reminders">
                  {reminders.slice(0, 3).map((reminder) => {
                    const creator = members.find((member) => member.uid === reminder.createdByUid);
                    const color = activePalette.lights[creator?.index ?? -1] ?? '#6B7280';
                    return (
                      <button
                        className="overview-reminder"
                        type="button"
                        onClick={() => setView('reminders')}
                        key={reminder.id}>
                        <i style={{ background: color, boxShadow: `0 0 12px ${color}` }} />
                        <span>
                          <strong>{reminder.title}</strong>
                          <small>{reminder.dueAt ? formatDueDate(reminder.dueAt) : reminder.dueLabel}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="overview-section">
              <button className="overview-heading" type="button" onClick={() => setView('archive')}>
                <span>
                  <span className="eyebrow">ÚLTIMOS ARCHIVOS</span>
                  <strong>Archivo</strong>
                </span>
                <span>Ver todo →</span>
              </button>
              {recentPhotos.length === 0 ? (
                <button className="overview-card empty-overview" type="button" onClick={() => setView('archive')}>
                  Todavía no habéis subido ninguna.
                </button>
              ) : (
                <div className="photo-preview">
                  {recentPhotos.slice(0, 4).map((photo) => (
                    <div className="photo-preview-item" key={photo.id}>
                      {photo.kind === 'document' ? (
                        <strong>{fileFormat(photo.fileName)}</strong>
                      ) : (
                        <Image
                          src={photo.imageUrl}
                          alt=""
                          fill
                          sizes="(max-width: 640px) 22vw, 100px"
                          unoptimized
                        />
                      )}
                    </div>
                  ))}
                  {recentPhotos.length > 4 && <span className="photo-more">+{recentPhotos.length - 4}</span>}
                </div>
              )}
            </section>

            <section className="overview-section overview-board">
              <button className="overview-heading" type="button" onClick={() => setView('board')}>
                <span>
                  <span className="eyebrow">ÚLTIMOS MENSAJES</span>
                  <strong>Mensajes</strong>
                </span>
                <span>Ver todo →</span>
              </button>
              {recentMessages.length === 0 ? (
                <button className="overview-card empty-overview" type="button" onClick={() => setView('board')}>
                  Todavía nada. El primero sigue libre.
                </button>
              ) : (
                <div className="message-preview">
                  {recentMessages.slice(-5).map((message) => {
                    const sender = members.find((member) => member.uid === message.senderId);
                    const color = activePalette.lights[sender?.index ?? -1] ?? '#6B7280';
                    return (
                      <article style={{ '--member-color': color } as React.CSSProperties} key={message.id}>
                        <span>
                          <strong>{previewText(message.text)}</strong>
                          <small>{messageTime(message.createdAt)}</small>
                        </span>
                        <i />
                      </article>
                    );
                  })}
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
            <button className="primary-button" type="button" onClick={openReminder}>
              Nuevo aviso
            </button>
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
          ) : reminders.length === 0 ? (
            <article className="empty-state panel">
              <div className="orbit" aria-hidden="true"><i /><i /></div>
              <h3>Nada pendiente por ahora.</h3>
              <p>Todos los miembros del espacio pueden crear el siguiente aviso.</p>
            </article>
          ) : (
            <div className="reminder-grid">
              {reminders.map((reminder) => {
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
                      <button type="button" onClick={() => postponeReminder(reminder)}>+30 min</button>
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
                  {recentMessages.map((message, index) => {
                    const previous = recentMessages[index - 1];
                    const next = recentMessages[index + 1];
                    const sender = members.find((member) => member.uid === message.senderId);
                    const color = activePalette.lights[sender?.index ?? -1] ?? '#6B7280';
                    const gif = message.gif ? gifMedia[message.gif.giphyId] : undefined;
                    const isMine = message.senderId === user.uid;
                    const startsGroup = !sameMessageGroup(previous, message);
                    const endsGroup = !sameMessageGroup(message, next);
                    const startsDay =
                      index === 0 || !sameCalendarDay(previous?.createdAt ?? null, message.createdAt);
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
                        <article
                          className={classes}
                          style={{ '--member-color': color } as React.CSSProperties}>
                          {!isMine && (
                            endsGroup ? (
                              <span
                                className="chat-avatar"
                                title={sender?.name ?? 'Alguien'}
                                aria-hidden="true">
                                {initials(sender?.name ?? 'A')}
                              </span>
                            ) : (
                              <span className="chat-avatar-placeholder" aria-hidden="true" />
                            )
                          )}
                          <div className="chat-message-content">
                            {!isMine && startsGroup && (
                              <span className="chat-sender">{sender?.name ?? 'Alguien'}</span>
                            )}
                            <div className="chat-bubble">
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
                                <p className="chat-text">{message.text}</p>
                              )}
                              <time
                                className="chat-time"
                                dateTime={message.createdAt?.toISOString()}>
                                {messageTime(message.createdAt)}
                              </time>
                            </div>
                          </div>
                        </article>
                      </Fragment>
                    );
                  })}
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
              <button
                className="primary-button"
                type="button"
                disabled={isUploadingPhoto}
                onClick={() => photoInputRef.current?.click()}>
                {isUploadingPhoto ? 'Subiendo…' : 'Subir foto'}
              </button>
            </div>
            <input
              className="visually-hidden"
              ref={photoInputRef}
              type="file"
              accept="image/*"
              onChange={uploadSelectedPhoto}
              tabIndex={-1}
            />
            {recentPhotos.length === 0 ? (
              <article className="empty-state panel">
                <h3>Todavía no hay archivos.</h3>
                <p>Las fotos y documentos del móvil aparecerán aquí en tiempo real.</p>
              </article>
            ) : (
              <div className="archive-preview-grid">
                {recentPhotos.map((photo) => (
                  <article className="archive-preview-item" key={photo.id}>
                    {photo.kind === 'document' ? (
                      <>
                        <strong>{fileFormat(photo.fileName)}</strong>
                        <small>{photo.fileName ?? 'Documento'}</small>
                      </>
                    ) : (
                      <Image
                        src={photo.imageUrl}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 45vw, 240px"
                        unoptimized
                      />
                    )}
                  </article>
                ))}
              </div>
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
      <GifPicker
        isOpen={isGifPickerOpen}
        onClose={() => setIsGifPickerOpen(false)}
        onSelect={sendGif}
      />
    </main>
  );
}
