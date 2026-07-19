import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { collection, doc, onSnapshot, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useSpace } from '@/context/space-context';
import { formatDueDate } from '@/lib/dates';
import { db } from '@/lib/firebase';

type Alarm = {
  spaceId: string;
  reminderId: string;
  title: string;
  dueAt: Date;
};

const REMINDER_CHANNEL_ID = 'reminders';
const DUE_CATEGORY = 'churri-reminder-due';

/**
 * Reminders have to ring when they're due, not when they're written.
 *
 * Rather than paying for a server to wake up at the right minute, the phone that needs
 * reminding sets its own alarm: a local notification scheduled for the exact moment.
 * It costs nothing, works offline, and survives a reboot.
 *
 * Whose phone rings is the reminder's `targetUids`: yourself for your own alarms, someone
 * else when you put it on them, everyone when it's for the whole space. And it rings across
 * *all* your spaces — a reminder in Casa goes off while you're looking at Familia, because
 * the alarm belongs to the phone, not to whichever screen is open.
 *
 * The notification is a control, not a poster. It carries "Hecho" and "+30 min", so the
 * thing a reminder asks of you can be answered from the shade. Both act on Firestore, so
 * every other phone sees the answer too.
 */
export function ReminderAlarms() {
  const { user, spaces } = useSpace();
  /** Responses already dealt with, so a listener and the cold-start check can't both act. */
  const handled = useRef(new Set<string>());
  /** What each space currently wants ringing; the union is what gets scheduled. */
  const wantedBySpace = useRef(new Map<string, Alarm[]>());

  useEffect(() => {
    const respond = async (response: Notifications.NotificationResponse) => {
      const key = `${response.notification.request.identifier}:${response.actionIdentifier}`;
      if (handled.current.has(key)) return;
      handled.current.add(key);

      const data = response.notification.request.content.data as {
        url?: string;
        reminderId?: string;
        spaceId?: string;
        /** Alarms scheduled before the pivot named the space this way. */
        coupleId?: string;
      };

      // The reminder the notification was about — if it was about one at all.
      const spaceId = data.spaceId ?? data.coupleId;
      const ref =
        data.reminderId && spaceId
          ? doc(db, 'spaces', spaceId, 'reminders', data.reminderId)
          : null;

      try {
        if (response.actionIdentifier === 'done' && ref) {
          await updateDoc(ref, { status: 'done' });
          return;
        }

        if (response.actionIdentifier === 'snooze' && ref) {
          // Snoozing is just moving the reminder. Firestore is the truth, so the alarm
          // reschedules itself on every phone, and the list shows the new hour.
          const dueAt = new Date(Date.now() + 30 * 60 * 1000);
          await updateDoc(ref, {
            dueAt: Timestamp.fromDate(dueAt),
            dueLabel: formatDueDate(dueAt),
            status: 'pending',
          });
          return;
        }
      } catch {
        // The reminder is gone, or this phone left the space. Either way there is nothing
        // to act on any more, and a notification is no place for an error.
        return;
      }

      // A plain tap: go where the notification points.
      if (typeof data.url === 'string') {
        router.push(data.url as never);
      }
    };

    const subscription = Notifications.addNotificationResponseReceivedListener(respond);

    // If an action launched the app from cold, the response happened before any listener
    // existed. It's waiting here.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) void respond(response);
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!user || spaces.length === 0) return undefined;

    const syncUnion = () => {
      const merged = [...wantedBySpace.current.values()].flat();
      syncAlarms(merged).catch(() => {
        // A failed alarm shouldn't take the screen down with it.
      });
    };

    const unsubscribers = spaces.map((space) => {
      const remindersQuery = query(
        collection(db, 'spaces', space.id, 'reminders'),
        where('status', '==', 'pending'),
      );

      return onSnapshot(remindersQuery, (snapshot) => {
        const wanted: Alarm[] = [];

        for (const docSnapshot of snapshot.docs) {
          const data = docSnapshot.data();
          const dueAt = (data.dueAt as Timestamp | null)?.toDate() ?? null;

          // Whose phone rings is written on the reminder. Ones from before it was carry
          // the old rule: they ring on every phone but their author's.
          const targetUids = data.targetUids as string[] | undefined;
          const isForMe = targetUids
            ? targetUids.includes(user.uid)
            : (data.createdByUid as string | undefined) !== user.uid;
          const isStillAhead = dueAt !== null && dueAt.getTime() > Date.now();

          if (isForMe && isStillAhead && dueAt) {
            wanted.push({
              spaceId: space.id,
              reminderId: docSnapshot.id,
              title: data.title as string,
              dueAt,
            });
          }
        }

        wantedBySpace.current.set(space.id, wanted);
        syncUnion();
      });
    });

    // Spaces that are gone stop wanting anything.
    const knownIds = new Set(spaces.map((space) => space.id));
    for (const spaceId of wantedBySpace.current.keys()) {
      if (!knownIds.has(spaceId)) wantedBySpace.current.delete(spaceId);
    }
    syncUnion();

    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
    };
  }, [user, spaces]);

  return null;
}

async function syncAlarms(wanted: Alarm[]) {
  const canSchedule = await ensureNotificationAccess();
  if (!canSchedule) return;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();

  const existing = new Map<string, { identifier: string; dueAt: number }>();
  for (const notification of scheduled) {
    const data = notification.content.data as
      | { kind?: string; reminderId?: string; dueAt?: number }
      | undefined;
    if (data?.kind === 'churri-reminder' && data.reminderId && data.dueAt) {
      existing.set(data.reminderId, { identifier: notification.identifier, dueAt: data.dueAt });
    }
  }

  // Drop alarms for reminders that are done, deleted, or have moved to another time.
  for (const [reminderId, alarm] of existing) {
    const stillWanted = wanted.find(
      (reminder) => reminder.reminderId === reminderId && reminder.dueAt.getTime() === alarm.dueAt,
    );
    if (!stillWanted) {
      await Notifications.cancelScheduledNotificationAsync(alarm.identifier);
      existing.delete(reminderId);
    }
  }

  for (const reminder of wanted) {
    if (existing.has(reminder.reminderId)) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Es la hora',
        body: reminder.title,
        sound: 'default',
        categoryIdentifier: DUE_CATEGORY,
        data: {
          // The kind string predates the pivot; keeping it is what lets this sync see and
          // manage alarms that were scheduled by the previous version of the app.
          kind: 'churri-reminder',
          reminderId: reminder.reminderId,
          spaceId: reminder.spaceId,
          dueAt: reminder.dueAt.getTime(),
          url: '/reminders',
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminder.dueAt,
        channelId: REMINDER_CHANNEL_ID,
      },
    });
  }
}

async function ensureNotificationAccess() {
  if (Platform.OS === 'android') {
    // No `sound` key on purpose. Android reads it as the name of a sound file bundled in
    // the app, so 'default' sends it looking for a file called "default", finds nothing,
    // and leaves the channel silent. Leaving the key out is what asks for the system sound.
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: 'Recordatorios',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F72E79',
    });
  }

  // The two buttons the due notification wears. Both open the app for the moment it takes
  // to write the answer — the write needs the app's own credentials, which live in here.
  await Notifications.setNotificationCategoryAsync(DUE_CATEGORY, [
    { identifier: 'done', buttonTitle: 'Hecho' },
    { identifier: 'snooze', buttonTitle: '+30 min' },
  ]);

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}
