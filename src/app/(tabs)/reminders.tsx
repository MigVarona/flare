import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { LinearGradient } from "expo-linear-gradient";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { Linking } from "react-native";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Eyebrow,
  GhostButton,
  GlowCard,
  GradientButton,
  ScreenHeader,
} from "@/components/brand";
import Svg, { Path } from "react-native-svg";

import { CalendarGlyph } from "@/components/icons";
import { CardSkeletons } from "@/components/loading";
import { ThemedText } from "@/components/themed-text";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetItem,
  ActionsheetItemText,
} from "@/components/ui/actionsheet";
import {
  DateTimePicker,
  DateTimePickerTrigger,
} from "@/components/ui/date-time-picker";
import { Fab } from "@/components/ui/fab";
import { Toast, ToastDescription, useToast } from "@/components/ui/toast";
import {
  BottomTabInset,
  Colors,
  glow,
  neonBorder,
  Spacing,
} from "@/constants/theme";
import { useSpace } from "@/context/space-context";
import { useNotice } from "@/hooks/use-notice";
import { usePalette } from "@/hooks/use-palette";
import { formatDueDate, isOverdue } from "@/lib/dates";
import { db } from "@/lib/firebase";
import { sendPushNotification } from "@/lib/push";

/** How long "Hecho" can be undone before the reminder is actually deleted. */
const UndoWindowMs = 4000;

const theme = Colors.dark;

type Reminder = {
  id: string;
  title: string;
  /** Human-readable fallback for reminders created before dates were real. */
  dueLabel: string;
  dueAt: Date | null;
  createdByUid?: string;
  /** Whose phones it rings on. Reminders from before the pivot don't carry it. */
  targetUids?: string[];
};

export default function RemindersScreen() {
  const insets = useSafeAreaInsets();
  const { user, spaceId, members, otherMembers, myName, isAlone } = useSpace();
  const palette = usePalette();
  const notice = useNotice();
  const toast = useToast();

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState<Date | undefined>(undefined);
  /** Whose phones the new reminder will ring on. At least one, always. */
  const [targetUids, setTargetUids] = useState<string[]>([]);
  const [canNotify, setCanNotify] = useState<boolean | null>(null);
  const [actingOn, setActingOn] = useState<Reminder | null>(null);
  /** Marked "Hecho" but still undoable: hidden from the list while its delete is pending. */
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const pendingDeletes = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  /** Where each reminder sits. The field needs to know where its sources are. */

  useEffect(() => {
    Notifications.getPermissionsAsync()
      .then((permission) => setCanNotify(permission.granted))
      .catch(() => setCanNotify(null));
  }, []);

  useEffect(() => {
    if (!spaceId) return undefined;
    const remindersQuery = query(
      collection(db, "spaces", spaceId, "reminders"),
      orderBy("createdAt", "desc"),
    );
    return onSnapshot(remindersQuery, (snapshot) => {
      setReminders(
        snapshot.docs.flatMap((docSnapshot) => {
          const data = docSnapshot.data();
          if (data.status === "done") return [];

          const dueAtValue = data.dueAt as Timestamp | undefined;
          return [{
            id: docSnapshot.id,
            title: data.title as string,
            dueLabel: (data.dueLabel as string | undefined) ?? "Sin fecha",
            dueAt: dueAtValue ? dueAtValue.toDate() : null,
            createdByUid: data.createdByUid as string | undefined,
            targetUids: data.targetUids as string[] | undefined,
          }];
        }),
      );
      setIsLoading(false);
    });
  }, [spaceId]);

  /**
   * Who a reminder is for by default: the others if there are any (putting something on
   * someone is the reason this screen exists), yourself when you're on your own.
   */
  const openForm = () => {
    setTargetUids(isAlone ? (user ? [user.uid] : []) : otherMembers.map((member) => member.uid));
    setIsAdding(true);
  };

  const toggleTarget = (uid: string) => {
    setTargetUids((current) =>
      current.includes(uid)
        ? current.length > 1
          ? current.filter((entry) => entry !== uid)
          : current
        : [...current, uid],
    );
  };

  const addReminder = async () => {
    if (!spaceId || !user || !title.trim() || targetUids.length === 0) return;
    const reminderTitle = title.trim();

    setIsSending(true);
    try {
      await addDoc(collection(db, "spaces", spaceId, "reminders"), {
        title: reminderTitle,
        dueAt: dueAt ? Timestamp.fromDate(dueAt) : null,
        // Stored alongside the date so other screens can render it without re-deriving it.
        dueLabel: dueAt ? formatDueDate(dueAt) : "Sin fecha",
        status: "pending",
        createdByUid: user.uid,
        targetUids,
        createdAt: Timestamp.now(),
      });
      setTitle("");
      setDueAt(undefined);
      setIsAdding(false);

      // Everyone whose phone this will ring on hears about it now; your own needs no push.
      for (const targetUid of targetUids) {
        if (targetUid === user.uid) continue;
        sendPushNotification(
          spaceId,
          targetUid,
          `${myName} te deja un aviso`,
          dueAt ? `${reminderTitle} — ${formatDueDate(dueAt)}` : reminderTitle,
          "/reminders",
        ).then((ok) => {
          if (!ok) notice("No hemos podido avisar a todos");
        });
      }
    } finally {
      setIsSending(false);
    }
  };

  const requestNotificationAccess = async () => {
    const permission = await Notifications.requestPermissionsAsync();
    setCanNotify(permission.granted);
  };

  const undoMarkDone = (id: string) => {
    const timeout = pendingDeletes.current.get(id);
    if (timeout) clearTimeout(timeout);
    pendingDeletes.current.delete(id);
    setHiddenIds((ids) => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
  };

  const markDone = (reminder: Reminder) => {
    if (!spaceId) return;
    // Putting a light out is a physical act, so it lands in the wrist too.
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setHiddenIds((ids) => new Set(ids).add(reminder.id));

    toast.show({
      placement: "top",
      duration: UndoWindowMs,
      render: ({ id }) => (
        <Toast
          nativeID={`undo-${id}`}
          action="muted"
          variant="solid"
          className="mt-2 flex-row items-center justify-between gap-4 rounded-2xl border border-border bg-card px-4 py-3">
          <ToastDescription>Aviso completado</ToastDescription>
          <Pressable onPress={() => undoMarkDone(reminder.id)} hitSlop={12}>
            <ThemedText type="smallBold" style={{ color: palette.accent }}>
              Deshacer
            </ThemedText>
          </Pressable>
        </Toast>
      ),
    });

    const timeout = setTimeout(() => {
      pendingDeletes.current.delete(reminder.id);
      void deleteDoc(doc(db, "spaces", spaceId, "reminders", reminder.id));
    }, UndoWindowMs);
    pendingDeletes.current.set(reminder.id, timeout);
  };

  // Postponing used to mark the reminder 'postponed', which silenced its alarm for good and
  // replaced the date with the word "Pospuesto". Now it does what it says: it moves it.
  const postpone = async (reminder: Reminder, date: Date | undefined) => {
    if (!spaceId || !date) return;
    await updateDoc(doc(db, "spaces", spaceId, "reminders", reminder.id), {
      dueAt: Timestamp.fromDate(date),
      dueLabel: formatDueDate(date),
      status: "pending",
    });
  };

  /**
   * Put the reminder on the calendar.
   *
   * The first attempt at this reached for the phone's Clock — and the clock was the wrong
   * organ: its alarms have a time but no *date*, and a reminder is "Thursday at 18:30", not
   * "18:30". A calendar event is the thing a reminder actually is.
   *
   * It goes through the calendar's own "new event" screen, prefilled — never written behind
   * your back. Times travel as UTC (the Z): the calendar owns the timezone conversion, and
   * doing it ourselves is how events end up an hour off twice a year.
   */
  const sendToCalendar = async (reminder: Reminder) => {
    if (!reminder.dueAt) return;

    const stamp = (date: Date) =>
      date.toISOString().replace(/[-:]|\.\d{3}/g, "");
    const end = new Date(reminder.dueAt.getTime() + 30 * 60 * 1000);
    const url =
      "https://calendar.google.com/calendar/render?action=TEMPLATE" +
      `&text=${encodeURIComponent(reminder.title)}` +
      `&dates=${stamp(reminder.dueAt)}/${stamp(end)}` +
      `&details=${encodeURIComponent("Aviso de Flare")}`;

    try {
      await Linking.openURL(url);
    } catch {
      notice("No se ha podido abrir el calendario");
    }
  };

  const removeConfirmed = async (reminder: Reminder) => {
    if (!spaceId) return;
    setActingOn(null);
    await deleteDoc(doc(db, "spaces", spaceId, "reminders", reminder.id));
  };

  // What's waiting is ordered by when it comes due, soonest first; the ones without a date
  // wait at the back. Anything just marked "Hecho" stays out while its undo window is open.
  const pending = reminders
    .filter((reminder) => !hiddenIds.has(reminder.id))
    .sort(
      (a, b) =>
        (a.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) -
        (b.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER),
    );

  return (
    <>
      <Animated.ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + Spacing[24],
          paddingBottom: BottomTabInset + Spacing[64],
        }}
      >
        <View className="gap-4 px-6">
          <ScreenHeader title="Avisos" />

          {canNotify === false && (
            <GlowCard color={palette.accent}>
              <Eyebrow color={palette.accent}>Avisos apagados</Eyebrow>
              <ThemedText className="leading-6 text-muted-foreground">
                Se guardan igual, pero este teléfono no sonará a la hora
                marcada.
              </ThemedText>
              <View className="mt-1">
                <GhostButton
                  title="Activar avisos"
                  color={palette.accent}
                  onPress={requestNotificationAccess}
                />
              </View>
            </GlowCard>
          )}

          {isAdding && (
            <GlowCard color={palette.you}>
              <Eyebrow color={palette.you}>Nuevo aviso</Eyebrow>

              {/* Whose phone will ring. Each person is their light; "para mí" is one more
                  chip, because putting something on yourself is now a normal thing to do. */}
              {members.length > 1 && (
                <View className="flex-row flex-wrap gap-2">
                  {members.map((member) => {
                    const isSelected = targetUids.includes(member.uid);
                    const color = palette.colorFor(member.uid);
                    const label = member.uid === user?.uid ? "Para mí" : member.name;

                    return (
                      <Pressable
                        key={member.uid}
                        onPress={() => toggleTarget(member.uid)}
                        className="rounded-full border px-4 py-2 active:opacity-70"
                        style={
                          isSelected
                            ? [{ backgroundColor: `${color}22`, borderColor: color }, glow(color, 10, "33")]
                            : { borderColor: theme.border }
                        }>
                        <ThemedText
                          type="smallBold"
                          style={{ color: isSelected ? color : theme.textSecondary }}>
                          {label}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="¿Qué no se puede olvidar?"
                placeholderTextColor={theme.textSecondary}
                autoFocus
                className="rounded-2xl border border-border bg-background px-4 py-4 text-base text-foreground"
                style={styles.inputText}
              />
              {/* The field says the date the way you'd say it out loud, not as raw digits. */}
              <DateTimePicker
                value={dueAt}
                onChange={setDueAt}
                mode="datetime"
                minimumDate={new Date()}
                locale="es-ES"
                is24Hour
                className="w-full"
              >
                <DateTimePickerTrigger className="w-full min-h-0 rounded-none border-0">
                  <View
                    className="w-full rounded-2xl border border-border bg-background px-4 py-4"
                    style={dueAt ? neonBorder(palette.you, "55") : undefined}
                  >
                    <ThemedText
                      className={
                        dueAt ? "text-base" : "text-base text-muted-foreground"
                      }
                      style={[styles.inputText, dueAt ? { color: palette.you } : undefined]}
                    >
                      {dueAt ? formatDueDate(dueAt) : "¿Cuándo?"}
                    </ThemedText>
                  </View>
                </DateTimePickerTrigger>
              </DateTimePicker>
              <View className="mt-2 gap-2">
                <GradientButton
                  title={
                    targetUids.every((uid) => uid === user?.uid)
                      ? "Guardar aviso"
                      : "Enviar aviso"
                  }
                  onPress={addReminder}
                  disabled={!title.trim() || targetUids.length === 0}
                  isLoading={isSending}
                />
                <Pressable
                  onPress={() => setIsAdding(false)}
                  className="active:opacity-70"
                >
                  <ThemedText
                    type="small"
                    className="py-2 text-center text-muted-foreground"
                  >
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
                    {isAlone
                      ? "Nada pendiente. Cuando pongas uno, este teléfono sonará a su hora."
                      : "Nada pendiente. Cuando pongas uno, sonará en el móvil que elijas a su hora."}
                  </ThemedText>
                </GlowCard>
              )}

              {pending.map((reminder) => {
                // The reminder wears the light of whoever has to do it — that's the question
                // a glance at the list is answering. Old ones only know who wrote them.
                const color = palette.colorFor(reminder.targetUids?.[0] ?? reminder.createdByUid);
                const overdue = reminder.dueAt
                  ? isOverdue(reminder.dueAt)
                  : false;
                return (
                  <View key={reminder.id}>
                    <GlowCard color={color}>
                      <View className="flex-row items-start gap-3">
                        <View
                          style={[
                            styles.identityPoint,
                            { backgroundColor: color },
                            glow(color, 12, "77"),
                          ]}
                        />
                        <View className="flex-1 gap-1">
                          <ThemedText type="default" style={styles.reminderTitle}>
                            {reminder.title}
                          </ThemedText>
                          <View className="flex-row items-center gap-2">
                            <ThemedText
                              type="small"
                              style={styles.reminderTime}
                              className={overdue ? "text-destructive" : "text-muted-foreground"}
                            >
                              {reminder.dueAt ? formatDueDate(reminder.dueAt) : reminder.dueLabel}
                            </ThemedText>
                            {overdue && (
                              <ThemedText
                                type="small"
                                style={styles.reminderTime}
                                className="text-destructive"
                              >
                                · se pasó
                              </ThemedText>
                            )}
                          </View>
                        </View>
                        <Pressable onPress={() => setActingOn(reminder)} hitSlop={10}>
                          <ThemedText type="small" className="text-destructive">
                            Borrar
                          </ThemedText>
                        </Pressable>
                      </View>
                      <View style={styles.actionsRow}>
                        <Pressable onPress={() => markDone(reminder)}>
                          <ThemedText type="smallBold" style={styles.actionText} className="text-partner">
                            Hecho
                          </ThemedText>
                        </Pressable>
                        <DateTimePicker
                          value={reminder.dueAt ?? undefined}
                          onChange={(date) => postpone(reminder, date)}
                          mode="datetime"
                          minimumDate={new Date()}
                          locale="es-ES"
                          is24Hour
                        >
                          <DateTimePickerTrigger className="min-h-0 rounded-none border-0">
                            <ThemedText
                              type="smallBold"
                              style={styles.actionText}
                              className="text-muted-foreground"
                            >
                              Posponer
                            </ThemedText>
                          </DateTimePickerTrigger>
                        </DateTimePicker>
                        {reminder.dueAt && (
                          <Pressable
                            onPress={() => sendToCalendar(reminder)}
                            hitSlop={10}
                            accessibilityLabel="Añadirlo al calendario"
                            className="active:opacity-70"
                          >
                            <CalendarGlyph color={theme.textSecondary} />
                          </Pressable>
                        )}
                      </View>
                    </GlowCard>
                  </View>
                );
              })}
            </>
          )}
        </View>
      </Animated.ScrollView>

      {!isAdding && (
        <Fab
          onPress={openForm}
          placement="bottom right"
          className="overflow-hidden rounded-full p-0"
          style={[
            { bottom: BottomTabInset + Spacing[24] },
            glow(palette.accent, 24, "77"),
          ]}
        >
          {/* The same cross as in Fotos. It's the same gesture — add something — so it has to
              be the same shape, or the app is speaking two languages about one idea. */}
          <LinearGradient
            colors={palette.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              paddingHorizontal: Spacing[32],
              paddingVertical: Spacing[16],
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Svg width={22} height={22} viewBox="0 0 22 22">
              <Path
                d="M11 4v14M4 11h14"
                stroke={theme.background}
                strokeWidth={2.6}
                strokeLinecap="round"
              />
            </Svg>
          </LinearGradient>
        </Fab>
      )}

      <Actionsheet isOpen={Boolean(actingOn)} onClose={() => setActingOn(null)}>
        <ActionsheetBackdrop />
        <ActionsheetContent>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <ActionsheetItem onPress={() => actingOn && removeConfirmed(actingOn)}>
            <ActionsheetItemText className="text-destructive">Borrar aviso</ActionsheetItemText>
          </ActionsheetItem>
          <ActionsheetItem onPress={() => setActingOn(null)}>
            <ActionsheetItemText>Cancelar</ActionsheetItemText>
          </ActionsheetItem>
        </ActionsheetContent>
      </Actionsheet>
    </>
  );
}

const styles = StyleSheet.create({
  inputText: {
    fontFamily: "Outfit_400Regular",
    fontSize: 16,
    lineHeight: 24,
  },
  identityPoint: {
    width: 11,
    height: 11,
    borderRadius: 999,
    marginTop: 7,
  },
  reminderTitle: {
    color: "#D8DBE8",
    fontFamily: "Outfit_400Regular",
    fontSize: 15,
    lineHeight: 21,
  },
  reminderTime: {
    color: "#7E849A",
    fontFamily: "Outfit_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  actionsRow: {
    marginTop: Spacing[12],
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[20],
  },
  actionText: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 14,
    lineHeight: 20,
  },
});
