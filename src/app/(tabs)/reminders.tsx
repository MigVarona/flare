import { LinearGradient } from 'expo-linear-gradient';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Eyebrow, GlowCard, GradientButton, IdentityDot } from '@/components/brand';
import { CardSkeletons } from '@/components/loading';
import { ThemedText } from '@/components/themed-text';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetItem,
  ActionsheetItemText,
} from '@/components/ui/actionsheet';
import { DateTimePicker, DateTimePickerTrigger } from '@/components/ui/date-time-picker';
import { Fab } from '@/components/ui/fab';
import { BottomTabInset, Colors, glow, neonBorder, Spacing } from '@/constants/theme';
import { useCouple } from '@/context/couple-context';
import { useNotice } from '@/hooks/use-notice';
import { usePalette } from '@/hooks/use-palette';
import { formatDueDate, isOverdue } from '@/lib/dates';
import { db } from '@/lib/firebase';
import { sendPushNotification } from '@/lib/push';

const theme = Colors.dark;

type ReminderStatus = 'pending' | 'done' | 'postponed';

type Reminder = {
  id: string;
  title: string;
  /** Human-readable fallback for reminders created before dates were real. */
  dueLabel: string;
  dueAt: Date | null;
  status: ReminderStatus;
  createdByUid?: string;
};

export default function RemindersScreen() {
  const insets = useSafeAreaInsets();
  const { user, coupleId, partnerUid, partnerName } = useCouple();
  const notice = useNotice();
  const palette = usePalette();

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState<Date | undefined>(undefined);
  const [actingOn, setActingOn] = useState<Reminder | null>(null);

  useEffect(() => {
    if (!coupleId) return undefined;
    const remindersQuery = query(
      collection(db, 'couples', coupleId, 'reminders'),
      orderBy('createdAt', 'desc'),
    );
    return onSnapshot(remindersQuery, (snapshot) => {
      setReminders(
        snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data();
          const dueAtValue = data.dueAt as Timestamp | undefined;
          return {
            id: docSnapshot.id,
            title: data.title as string,
            dueLabel: (data.dueLabel as string | undefined) ?? 'Sin fecha',
            dueAt: dueAtValue ? dueAtValue.toDate() : null,
            status: data.status as ReminderStatus,
            createdByUid: data.createdByUid as string | undefined,
          };
        }),
      );
      setIsLoading(false);
    });
  }, [coupleId]);

  const addReminder = async () => {
    if (!coupleId || !user || !title.trim()) return;
    const reminderTitle = title.trim();

    setIsSending(true);
    try {
      await addDoc(collection(db, 'couples', coupleId, 'reminders'), {
        title: reminderTitle,
        dueAt: dueAt ? Timestamp.fromDate(dueAt) : null,
        // Stored alongside the date so other screens can render it without re-deriving it.
        dueLabel: dueAt ? formatDueDate(dueAt) : 'Sin fecha',
        status: 'pending',
        createdByUid: user.uid,
        createdAt: serverTimestamp(),
      });
      setTitle('');
      setDueAt(undefined);
      setIsAdding(false);

      let reached = false;
      if (partnerUid) {
        const partnerSnapshot = await getDoc(doc(db, 'users', partnerUid));
        const partnerToken = partnerSnapshot.data()?.expoPushToken as string | undefined;
        if (partnerToken) {
          sendPushNotification(partnerToken, 'Nuevo recordatorio', reminderTitle);
          reached = true;
        }
      }

      notice(reached ? 'Le acaba de sonar el móvil' : 'Recordatorio guardado');
    } finally {
      setIsSending(false);
    }
  };

  const markDone = async (reminder: Reminder) => {
    if (!coupleId) return;
    setActingOn(null);
    await updateDoc(doc(db, 'couples', coupleId, 'reminders', reminder.id), { status: 'done' });
    notice('Hecho', 'partner');
  };

  const postpone = async (reminder: Reminder) => {
    if (!coupleId) return;
    setActingOn(null);
    await updateDoc(doc(db, 'couples', coupleId, 'reminders', reminder.id), {
      status: 'postponed',
      dueLabel: 'Pospuesto',
    });
    notice('Pospuesto', 'both');
  };

  const remove = async (reminder: Reminder) => {
    if (!coupleId) return;
    setActingOn(null);
    await deleteDoc(doc(db, 'couples', coupleId, 'reminders', reminder.id));
    notice('Borrado');
  };

  const pending = reminders.filter((reminder) => reminder.status !== 'done');
  const done = reminders.filter((reminder) => reminder.status === 'done');

  return (
    <>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{
          paddingTop: insets.top + Spacing.four,
          paddingBottom: BottomTabInset + Spacing.six,
        }}>
        <View className="gap-4 px-6">
          <View className="mb-2 gap-2">
            <Eyebrow>Entre vosotros</Eyebrow>
            <ThemedText
              type="title"
              className="text-[34px] leading-10 font-extrabold tracking-tight">
              Recordatorios
            </ThemedText>
          </View>

          {isAdding && (
            <GlowCard color={palette.you}>
              <Eyebrow color={palette.you}>Para {partnerName}</Eyebrow>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="¿Qué no se le puede olvidar?"
                placeholderTextColor={theme.textSecondary}
                autoFocus
                className="rounded-2xl border border-border bg-background px-4 py-4 text-base text-foreground"
              />
              {/* The field says the date the way you'd say it out loud, not as raw digits. */}
              <DateTimePicker
                value={dueAt}
                onChange={setDueAt}
                mode="datetime"
                minimumDate={new Date()}
                locale="es-ES"
                is24Hour
                className="w-full">
                <DateTimePickerTrigger className="w-full">
                  <View
                    className="w-full rounded-2xl border border-border bg-background px-4 py-4"
                    style={dueAt ? neonBorder(palette.you, '55') : undefined}>
                    <ThemedText
                      className={dueAt ? 'text-base' : 'text-base text-muted-foreground'}
                      style={dueAt ? { color: palette.you } : undefined}>
                      {dueAt ? formatDueDate(dueAt) : '¿Cuándo?'}
                    </ThemedText>
                  </View>
                </DateTimePickerTrigger>
              </DateTimePicker>
              <View className="mt-2 gap-2">
                <GradientButton
                  title="Enviar recordatorio"
                  onPress={addReminder}
                  disabled={!title.trim()}
                  isLoading={isSending}
                />
                <Pressable onPress={() => setIsAdding(false)} className="active:opacity-70">
                  <ThemedText type="small" className="py-2 text-center text-muted-foreground">
                    Cancelar
                  </ThemedText>
                </Pressable>
              </View>
            </GlowCard>
          )}

          {isLoading ? (
            <CardSkeletons count={3} />
          ) : (
            <>
              {pending.length === 0 && !isAdding && (
                <GlowCard>
                  <ThemedText className="leading-6 text-muted-foreground">
                    No hay nada pendiente. Cuando pongas uno, a {partnerName} le sonará el móvil.
                  </ThemedText>
                </GlowCard>
              )}

              {pending.map((reminder) => {
                const isMine = reminder.createdByUid === user?.uid;
                const color = isMine ? palette.you : palette.partner;
                const overdue = reminder.dueAt ? isOverdue(reminder.dueAt) : false;
                return (
                  <Pressable
                    key={reminder.id}
                    onLongPress={() => setActingOn(reminder)}
                    className="active:opacity-80">
                    <GlowCard color={color}>
                      <View className="flex-row items-center gap-2">
                        <IdentityDot isMine={isMine} />
                        <Eyebrow color={color}>
                          {isMine ? 'Lo pusiste tú' : `Te lo puso ${partnerName}`}
                        </Eyebrow>
                      </View>
                      <ThemedText className="text-[19px] leading-7 font-semibold">
                        {reminder.title}
                      </ThemedText>
                      <View className="flex-row items-center gap-2">
                        <ThemedText
                          type="small"
                          className={overdue ? 'text-destructive' : 'text-muted-foreground'}>
                          {reminder.dueAt ? formatDueDate(reminder.dueAt) : reminder.dueLabel}
                        </ThemedText>
                        {overdue && (
                          <ThemedText type="small" className="text-destructive">
                            · se pasó
                          </ThemedText>
                        )}
                      </View>
                      <View className="mt-2 flex-row gap-6">
                        <Pressable onPress={() => markDone(reminder)}>
                          <ThemedText type="smallBold" className="text-partner">
                            Hecho
                          </ThemedText>
                        </Pressable>
                        <Pressable onPress={() => postpone(reminder)}>
                          <ThemedText type="smallBold" className="text-muted-foreground">
                            Posponer
                          </ThemedText>
                        </Pressable>
                      </View>
                    </GlowCard>
                  </Pressable>
                );
              })}

              {done.length > 0 && (
                <View className="mt-4 gap-2 px-1">
                  <Eyebrow>Ya está</Eyebrow>
                  {done.map((reminder) => (
                    <Pressable
                      key={reminder.id}
                      onLongPress={() => setActingOn(reminder)}
                      className="flex-row items-center gap-2 active:opacity-70">
                      <View className="h-1.5 w-1.5 rounded-full bg-secondary" />
                      <ThemedText
                        type="small"
                        className="flex-1 text-muted-foreground line-through">
                        {reminder.title}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {!isAdding && (
        <Fab
          onPress={() => setIsAdding(true)}
          placement="bottom right"
          className="overflow-hidden rounded-full p-0"
          style={[{ bottom: BottomTabInset + Spacing.four }, glow(palette.accent, 24, '77')]}>
          <LinearGradient
            colors={palette.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ paddingHorizontal: Spacing.four, paddingVertical: Spacing.three }}>
            <ThemedText className="font-extrabold" style={{ color: theme.background }}>
              Nuevo
            </ThemedText>
          </LinearGradient>
        </Fab>
      )}

      <Actionsheet isOpen={Boolean(actingOn)} onClose={() => setActingOn(null)}>
        <ActionsheetBackdrop />
        <ActionsheetContent>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          {actingOn?.status !== 'done' && (
            <>
              <ActionsheetItem onPress={() => actingOn && markDone(actingOn)}>
                <ActionsheetItemText className="text-partner">
                  Marcar como hecho
                </ActionsheetItemText>
              </ActionsheetItem>
              <ActionsheetItem onPress={() => actingOn && postpone(actingOn)}>
                <ActionsheetItemText>Posponer</ActionsheetItemText>
              </ActionsheetItem>
            </>
          )}
          <ActionsheetItem onPress={() => actingOn && remove(actingOn)}>
            <ActionsheetItemText className="text-destructive">Borrar</ActionsheetItemText>
          </ActionsheetItem>
          <ActionsheetItem onPress={() => setActingOn(null)}>
            <ActionsheetItemText>Cancelar</ActionsheetItemText>
          </ActionsheetItem>
        </ActionsheetContent>
      </Actionsheet>
    </>
  );
}
