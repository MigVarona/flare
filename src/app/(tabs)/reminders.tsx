import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Eyebrow, GhostButton, GlowCard, GradientButton, IdentityDot } from '@/components/brand';
import { ThemedText } from '@/components/themed-text';
import {
  BottomTabInset,
  Colors,
  MaxContentWidth,
  neonBorder,
  Radius,
  Spacing,
} from '@/constants/theme';
import { useCouple } from '@/context/couple-context';
import { db } from '@/lib/firebase';
import { sendPushNotification } from '@/lib/push';

const theme = Colors.dark;

type ReminderStatus = 'pending' | 'done' | 'postponed';

type Reminder = {
  id: string;
  title: string;
  dueLabel: string;
  status: ReminderStatus;
  createdByUid?: string;
};

export default function RemindersScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const { user, coupleId, partnerUid } = useCouple();

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [dueLabel, setDueLabel] = useState('');

  useEffect(() => {
    if (!coupleId) return undefined;
    const remindersQuery = query(
      collection(db, 'couples', coupleId, 'reminders'),
      orderBy('createdAt', 'desc'),
    );
    return onSnapshot(remindersQuery, (snapshot) => {
      setReminders(
        snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          title: docSnapshot.data().title as string,
          dueLabel: docSnapshot.data().dueLabel as string,
          status: docSnapshot.data().status as ReminderStatus,
          createdByUid: docSnapshot.data().createdByUid as string | undefined,
        })),
      );
    });
  }, [coupleId]);

  const addReminder = async () => {
    if (!coupleId || !user || !title.trim()) return;
    const reminderTitle = title.trim();
    await addDoc(collection(db, 'couples', coupleId, 'reminders'), {
      title: reminderTitle,
      dueLabel: dueLabel.trim() || 'Sin fecha',
      status: 'pending',
      createdByUid: user.uid,
      createdAt: serverTimestamp(),
    });
    setTitle('');
    setDueLabel('');
    setIsAdding(false);

    if (partnerUid) {
      const partnerSnapshot = await getDoc(doc(db, 'users', partnerUid));
      const partnerToken = partnerSnapshot.data()?.expoPushToken as string | undefined;
      if (partnerToken) {
        sendPushNotification(partnerToken, 'Nuevo recordatorio', reminderTitle);
      }
    }
  };

  const markDone = async (id: string) => {
    if (!coupleId) return;
    await updateDoc(doc(db, 'couples', coupleId, 'reminders', id), { status: 'done' });
  };

  const postpone = async (id: string) => {
    if (!coupleId) return;
    await updateDoc(doc(db, 'couples', coupleId, 'reminders', id), {
      status: 'postponed',
      dueLabel: 'Pospuesto',
    });
  };

  const pending = reminders.filter((reminder) => reminder.status !== 'done');
  const done = reminders.filter((reminder) => reminder.status === 'done');

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: safeAreaInsets.top + Spacing.four, paddingBottom: BottomTabInset + Spacing.five },
      ]}>
      <View style={styles.inner}>
        <View style={styles.header}>
          <Eyebrow>Entre vosotros</Eyebrow>
          <View style={styles.headerRow}>
            <ThemedText type="title" style={styles.title}>
              Recordatorios
            </ThemedText>
            <GhostButton
              title={isAdding ? 'Cancelar' : 'Nuevo'}
              color={isAdding ? undefined : theme.you}
              onPress={() => setIsAdding((prev) => !prev)}
            />
          </View>
        </View>

        {isAdding && (
          <GlowCard color={theme.you}>
            <Eyebrow color={theme.you}>Para tu pareja</Eyebrow>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="¿Qué no se le puede olvidar?"
              placeholderTextColor={theme.textSecondary}
              style={styles.input}
            />
            <TextInput
              value={dueLabel}
              onChangeText={setDueLabel}
              placeholder="¿Cuándo? (ej. Hoy, 20:00)"
              placeholderTextColor={theme.textSecondary}
              style={styles.input}
            />
            <View style={styles.formAction}>
              <GradientButton title="Enviar recordatorio" onPress={addReminder} />
            </View>
          </GlowCard>
        )}

        {pending.length === 0 && !isAdding && (
          <GlowCard>
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              No hay nada pendiente. Cuando pongas uno, a tu pareja le sonará el móvil.
            </ThemedText>
          </GlowCard>
        )}

        {pending.map((reminder) => {
          const isMine = reminder.createdByUid === user?.uid;
          const color = isMine ? theme.you : theme.partner;
          return (
            <GlowCard key={reminder.id} color={color}>
              <View style={styles.authorRow}>
                <IdentityDot isMine={isMine} />
                <Eyebrow color={color}>{isMine ? 'Lo pusiste tú' : 'Te lo puso tu pareja'}</Eyebrow>
              </View>
              <ThemedText style={styles.reminderTitle}>{reminder.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {reminder.dueLabel}
              </ThemedText>
              <View style={styles.actions}>
                <Pressable onPress={() => markDone(reminder.id)}>
                  <ThemedText type="smallBold" style={{ color: theme.partner }}>
                    Hecho
                  </ThemedText>
                </Pressable>
                <Pressable onPress={() => postpone(reminder.id)}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    Posponer
                  </ThemedText>
                </Pressable>
              </View>
            </GlowCard>
          );
        })}

        {done.length > 0 && (
          <View style={styles.doneSection}>
            <Eyebrow>Ya está</Eyebrow>
            {done.map((reminder) => (
              <View key={reminder.id} style={styles.doneRow}>
                <View style={styles.doneDot} />
                <ThemedText type="small" themeColor="textSecondary" style={styles.doneText}>
                  {reminder.title}
                </ThemedText>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.background,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  input: {
    backgroundColor: theme.background,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
    color: theme.text,
    ...neonBorder(theme.border, 'FF'),
  },
  formAction: {
    marginTop: Spacing.two,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  reminderTitle: {
    fontSize: 19,
    lineHeight: 26,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.four,
    marginTop: Spacing.two,
  },
  empty: {
    lineHeight: 22,
  },
  doneSection: {
    gap: Spacing.two,
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.one,
  },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  doneDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.backgroundSelected,
  },
  doneText: {
    textDecorationLine: 'line-through',
    flex: 1,
  },
});
