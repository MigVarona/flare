import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { collection, doc, onSnapshot, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useCouple } from '@/context/couple-context';
import { formatDueDate } from '@/lib/dates';
import { db } from '@/lib/firebase';

type Alarm = {
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
 * And the notification is a control, not a poster. It carries two buttons — "Hecho" and
 * "+30 min" — so the thing a reminder asks of you can be answered from the notification
 * shade, without hunting for the app. Both act on Firestore, so the other phone sees the
 * answer too: a chat app tells you something happened; this one lets you deal with it.
 *
 * The alarms are kept in step with Firestore — if the reminder is done, deleted, or
 * moved, the alarm follows. Snoozing *is* moving it, which is why it needs no special
 * machinery: the +30 updates the reminder itself, and the alarm system follows its own rule.
 */
export function ReminderAlarms() {
  const { user, coupleId } = useCouple();
  /** Responses already dealt with, so a listener and the cold-start check can't both act. */
  const handled = useRef(new Set<string>());

  useEffect(() => {
    const respond = async (response: Notifications.NotificationResponse) => {
      const key = `${response.notification.request.identifier}:${response.actionIdentifier}`;
      if (handled.current.has(key)) return;
      handled.current.add(key);

      const data = response.notification.request.content.data as {
        url?: string;
        reminderId?: string;
        coupleId?: string;
      };

      // The reminder the notification was about — if it was about one at all.
      const ref =
        data.reminderId && data.coupleId
          ? doc(db, 'couples', data.coupleId, 'reminders', data.reminderId)
          : null;

      try {
        if (response.actionIdentifier === 'done' && ref) {
          await updateDoc(ref, { status: 'done' });
          return;
        }

        if (response.actionIdentifier === 'snooze' && ref) {
          // Snoozing is just moving the reminder. Firestore is the truth, so the alarm
          // reschedules itself on both phones, and the list shows the new hour.
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
    if (!coupleId || !user) return undefined;

    const remindersQuery = query(
      collection(db, 'couples', coupleId, 'reminders'),
      where('status', '==', 'pending'),
    );

    return onSnapshot(remindersQuery, (snapshot) => {
      const wanted: Alarm[] = [];

      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        const dueAt = (data.dueAt as Timestamp | null)?.toDate() ?? null;

        // A reminder is something you put on the other one — so it's their phone that rings.
        const isForMe = (data.createdByUid as string | undefined) !== user.uid;
        const isStillAhead = dueAt !== null && dueAt.getTime() > Date.now();

        if (isForMe && isStillAhead && dueAt) {
          wanted.push({ reminderId: docSnapshot.id, title: data.title as string, dueAt });
        }
      }

      syncAlarms(coupleId, wanted).catch(() => {
        // A failed alarm shouldn't take the screen down with it.
      });
    });
  }, [coupleId, user]);

  return null;
}

async function syncAlarms(coupleId: string, wanted: Alarm[]) {
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
          kind: 'churri-reminder',
          reminderId: reminder.reminderId,
          coupleId,
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
