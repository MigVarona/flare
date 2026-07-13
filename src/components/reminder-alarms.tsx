import * as Notifications from 'expo-notifications';
import { collection, onSnapshot, query, Timestamp, where } from 'firebase/firestore';
import { useEffect } from 'react';

import { useCouple } from '@/context/couple-context';
import { db } from '@/lib/firebase';

type Alarm = {
  reminderId: string;
  title: string;
  dueAt: Date;
};

/**
 * Reminders have to ring when they're due, not when they're written.
 *
 * Rather than paying for a server to wake up at the right minute, the phone that needs
 * reminding sets its own alarm: a local notification scheduled for the exact moment.
 * It costs nothing, works offline, and survives a reboot.
 *
 * The alarms are kept in step with Firestore — if the reminder is done, deleted, or
 * moved, the alarm follows.
 */
export function ReminderAlarms() {
  const { user, coupleId } = useCouple();

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

      syncAlarms(wanted).catch(() => {
        // A failed alarm shouldn't take the screen down with it.
      });
    });
  }, [coupleId, user]);

  return null;
}

async function syncAlarms(wanted: Alarm[]) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();

  const existing = new Map<string, { identifier: string; dueAt: number }>();
  for (const notification of scheduled) {
    const data = notification.content.data as
      | { reminderId?: string; dueAt?: number }
      | undefined;
    if (data?.reminderId && data.dueAt) {
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
        data: { reminderId: reminder.reminderId, dueAt: reminder.dueAt.getTime() },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminder.dueAt,
      },
    });
  }
}
