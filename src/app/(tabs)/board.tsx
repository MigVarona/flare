import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, ScrollView, TextInput, View } from "react-native";
// React Native's own keyboard handling broke on Android once Expo turned on edge-to-edge.
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlowCard, ScreenHeader } from "@/components/brand";
import { PinGlyph } from "@/components/icons";
import { LightSignal, isSignalId, useSignalMeaning, type SignalId } from "@/components/light-signals";
import { MessageSkeletons } from "@/components/loading";
import { DeathMs, MessageLight, StepMs } from "@/components/message-light";
import { SignalPicker } from "@/components/signal-picker";
import { ThemedText } from "@/components/themed-text";
import { Modal, ModalBackdrop, ModalContent } from "@/components/ui/modal";
import {
  BoardCapacity,
  BottomTabInset,
  Colors,
  glow,
  MaxPinnedItems,
  Spacing,
} from "@/constants/theme";
import { useSpace } from "@/context/space-context";
import { useNotice } from "@/hooks/use-notice";
import { usePalette } from "@/hooks/use-palette";
import { db } from "@/lib/firebase";
import { sendPushNotification } from "@/lib/push";

const theme = Colors.dark;

type Note = {
  id: string;
  text: string;
  senderId: string;
  reactions: Record<string, SignalId>;
  /** Sits outside the count, and doesn't fade with age. At most two at a time. */
  pinned: boolean;
};

/**
 * The Tablón — the door of the fridge, digital. Seven slots for what's true *now*: the wifi
 * password, "llave en el buzón", a photo of the schedule. Not a chat: there's no history to
 * scroll, so nothing here is trying to be remembered on its own — pin the one or two things
 * that need to survive the rest ageing out.
 */
export default function BoardScreen() {
  const insets = useSafeAreaInsets();
  const { user, spaceId, otherMembers, myName, isAlone } = useSpace();
  const palette = usePalette();
  const notice = useNotice();
  const showSignalMeaning = useSignalMeaning();
  const scrollRef = useRef<ScrollView>(null);

  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [viewing, setViewing] = useState<Note | null>(null);
  const [reactingTo, setReactingTo] = useState<Note | null>(null);
  /** Notes we've already asked to delete, so a second snapshot doesn't ask again. */
  const trimmed = useRef(new Set<string>());
  /** The ones the surge is on its way to put out. They're still here; they just aren't for long. */
  const [dying, setDying] = useState<string[]>([]);
  /** Bumped by every arrival. The bubbles watch it to know when to carry the surge. */
  const [surge, setSurge] = useState(0);
  const newest = useRef<string | null>(null);
  /** Shown once, the first time the board is opened, to explain the capacity. */
  const [showCapacityNotice, setShowCapacityNotice] = useState(false);

  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", () =>
      setIsKeyboardOpen(true),
    );
    const hidden = Keyboard.addListener("keyboardDidHide", () =>
      setIsKeyboardOpen(false),
    );
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  useEffect(() => {
    AsyncStorage.getItem("boardCapacityNoticeSeen").then((seen) => {
      if (!seen) setShowCapacityNotice(true);
    });
  }, []);

  const dismissCapacityNotice = () => {
    setShowCapacityNotice(false);
    void AsyncStorage.setItem("boardCapacityNoticeSeen", "true");
  };

  useEffect(() => {
    if (!spaceId) return undefined;
    const notesQuery = query(
      collection(db, "spaces", spaceId, "messages"),
      orderBy("createdAt", "asc"),
    );
    return onSnapshot(notesQuery, (snapshot) => {
      setNotes(
        snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          text: docSnapshot.data().text as string,
          senderId: docSnapshot.data().senderId as string,
          reactions: (docSnapshot.data().reactions as Record<string, SignalId>) ?? {},
          pinned: (docSnapshot.data().pinned as boolean | undefined) ?? false,
        })),
      );
      setIsLoading(false);

      // An arrival sends a surge up the board. Not on first load, though: opening it isn't
      // an event, and lighting the whole screen up would say something happened.
      const arrived = snapshot.docs.at(-1)?.id ?? null;
      if (newest.current && arrived && arrived !== newest.current) {
        setSurge((count) => count + 1);
      }
      newest.current = arrived;

      // The board holds seven — pinned notes don't count against that, and don't get
      // trimmed. Trimming used to be the sender's job, done against their own copy of the
      // list — so two people writing at the same moment could each count seven and leave
      // eight standing, or throw the same one out twice.
      //
      // Whoever *sees* too many trims instead. Both phones may reach for the same note, and
      // that's fine: deleting what's already gone changes nothing. They converge on seven
      // without having to agree on anything.
      //
      // The delay is the point: the light has to go out before the record does, or the
      // note would simply blink out of existence and the rule would stay invisible.
      const regularDocs = snapshot.docs.filter((docSnapshot) => !docSnapshot.data().pinned);
      const overflow = regularDocs.length - BoardCapacity;
      for (const oldest of regularDocs.slice(0, Math.max(0, overflow))) {
        if (trimmed.current.has(oldest.id)) continue;
        trimmed.current.add(oldest.id);
        setDying((ids) => [...ids, oldest.id]);
        // A light going out is felt, not just seen. It's the one thing here you can't undo.
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setTimeout(() => void deleteDoc(oldest.ref), DeathMs);
      }
    });
  }, [spaceId]);

  const pinnedNotes = notes.filter((note) => note.pinned);
  const regularNotes = notes.filter((note) => !note.pinned);

  const canSend = draft.trim().length > 0;

  const sendNote = async () => {
    if (!spaceId || !user || !draft.trim()) return;
    const text = draft.trim();
    setDraft("");

    try {
      await addDoc(collection(db, "spaces", spaceId, "messages"), {
        text,
        senderId: user.uid,
        createdAt: serverTimestamp(),
      });
    } catch {
      // The draft is already cleared — give it back rather than lose what they typed.
      setDraft(text);
      notice("No se ha podido dejar la nota");
      return;
    }

    for (const member of otherMembers) {
      sendPushNotification(spaceId, member.uid, myName, text, "/board").then((ok) => {
        if (!ok) notice("No hemos podido avisar a todos");
      });
    }
  };

  const react = async (note: Note, signal: SignalId | null) => {
    if (!spaceId || !user) return;
    setReactingTo(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await updateDoc(doc(db, "spaces", spaceId, "messages", note.id), {
      [`reactions.${user.uid}`]: signal ?? deleteField(),
    });
  };

  /** Fixing something to the board is a soft house rule, not a security boundary — the two
   *  slots are kept here, on the client, rather than fought over in the rules. */
  const togglePin = async (note: Note) => {
    if (!spaceId) return;
    if (!note.pinned && pinnedNotes.length >= MaxPinnedItems) {
      notice(`Ya hay ${MaxPinnedItems} notas fijadas — desfija una para poner otra`);
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await updateDoc(doc(db, "spaces", spaceId, "messages", note.id), { pinned: !note.pinned });
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-background" behavior="padding">
      <View
        className="w-full max-w-200 flex-1 self-center"
        style={{ paddingTop: insets.top + Spacing[24] }}
      >
        <View className="px-6">
          <ScreenHeader title="Tablón" />
          {showCapacityNotice && (
            <GlowCard style={{ marginBottom: Spacing[16] }}>
              <ThemedText className="leading-6">
                No es un chat de siempre: es la puerta de la nevera. Caben siete notas — las más
                viejas se apagan al llegar una nueva. Mantén pulsada una para fijarla y que no se
                apague, hasta dos a la vez.
              </ThemedText>
              <Pressable onPress={dismissCapacityNotice} hitSlop={12} className="self-end">
                <ThemedText type="smallBold" style={{ color: palette.accent }}>
                  Entendido
                </ThemedText>
              </Pressable>
            </GlowCard>
          )}
        </View>

        <Animated.ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerClassName="gap-3 px-6 py-6"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: true })
          }
        >
          {isLoading ? (
            <MessageSkeletons />
          ) : (
            <>
              {pinnedNotes.length > 0 && (
                <View className="mb-2 gap-3">
                  {pinnedNotes.map((note) => (
                    <NoteBubble
                      key={note.id}
                      note={note}
                      isMine={note.senderId === user?.uid}
                      color={palette.colorFor(note.senderId)}
                      rest={1}
                      delay={0}
                      isDying={false}
                      onOpen={() => setViewing(note)}
                      onLongPress={() => setReactingTo(note)}
                      onTogglePin={() => togglePin(note)}
                      showSignalMeaning={showSignalMeaning}
                      colorFor={palette.colorFor}
                    />
                  ))}
                  <View className="h-px bg-border" />
                </View>
              )}

              {regularNotes.length === 0 && pinnedNotes.length === 0 ? (
                <ThemedText className="py-16 text-center leading-6 text-muted-foreground">
                  {isAlone ? "Deja la primera nota encendida." : "Dejad la primera nota encendida."}
                </ThemedText>
              ) : (
                regularNotes.map((note, index) => {
                  // The oldest note is the faintest: it is already on its way out. The rule
                  // is shown as light, not explained in a label.
                  const distance = regularNotes.length - 1 - index;
                  const rest = Math.max(
                    0.35,
                    1 - distance * (0.65 / Math.max(1, BoardCapacity - 1)),
                  );

                  return (
                    <NoteBubble
                      key={note.id}
                      note={note}
                      isMine={note.senderId === user?.uid}
                      color={palette.colorFor(note.senderId)}
                      rest={rest}
                      delay={distance * StepMs}
                      isDying={dying.includes(note.id)}
                      onOpen={() => setViewing(note)}
                      onLongPress={() => setReactingTo(note)}
                      onTogglePin={() => togglePin(note)}
                      showSignalMeaning={showSignalMeaning}
                      colorFor={palette.colorFor}
                    />
                  );
                })
              )}
            </>
          )}
        </Animated.ScrollView>

        <View
          className="border-t border-border px-6 pt-4"
          style={{
            // The bar ends 68px up from the bottom; clearing it by the inset alone left twelve
            // pixels between the two, which reads as a collision rather than a layout.
            paddingBottom: isKeyboardOpen
              ? Spacing[16]
              : insets.bottom + BottomTabInset + Spacing[16],
          }}
        >
          <View className="flex-row items-center gap-2">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Escribe…"
              placeholderTextColor={theme.textSecondary}
              className="flex-1 rounded-full border border-border bg-card px-6 py-4 text-base text-foreground"
              onSubmitEditing={sendNote}
            />
            <Pressable
              onPress={canSend ? sendNote : undefined}
              disabled={!canSend}
              className={`overflow-hidden rounded-full active:opacity-75 ${
                canSend ? "" : "opacity-35"
              }`}
              style={canSend ? glow(palette.accent, 18, "66") : undefined}
            >
              <LinearGradient
                colors={palette.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  paddingHorizontal: Spacing[24],
                  paddingVertical: Spacing[16],
                }}
              >
                <ThemedText
                  type="smallBold"
                  style={{ color: theme.background }}
                >
                  Enviar
                </ThemedText>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
      <Modal isOpen={Boolean(viewing)} onClose={() => setViewing(null)} size="full">
        <ModalBackdrop className="bg-background/95" />
        <ModalContent className="h-full rounded-none border-0 bg-transparent p-0 shadow-none">
          <View
            className="h-full w-full justify-center px-6"
            style={{
              paddingTop: insets.top + Spacing[24],
              paddingBottom: insets.bottom + Spacing[24],
            }}
          >
            <View
              className="absolute left-0 right-0 flex-row items-center justify-between px-6"
              style={{ top: insets.top + Spacing[16] }}>
              <Pressable
                onPress={() => setViewing(null)}
                className="self-start rounded-full border border-border bg-background/80 px-4 py-3 active:opacity-70"
              >
                <ThemedText type="smallBold">Cerrar</ThemedText>
              </Pressable>
              {viewing && (
                <Pressable
                  onPress={() => togglePin(viewing)}
                  hitSlop={12}
                  className="flex-row items-center gap-2 rounded-full border border-border bg-background/80 px-4 py-3 active:opacity-70">
                  <PinGlyph
                    color={viewing.pinned ? palette.accent : theme.textSecondary}
                    filled={viewing.pinned}
                    size={14}
                  />
                  <ThemedText
                    type="smallBold"
                    style={{ color: viewing.pinned ? palette.accent : theme.textSecondary }}>
                    {viewing.pinned ? "Fijada" : "Fijar"}
                  </ThemedText>
                </Pressable>
              )}
            </View>

            {viewing && (
              <View className={viewing.senderId === user?.uid ? "items-end" : "items-start"}>
                <MessageLight
                  color={palette.colorFor(viewing.senderId)}
                  isMine={viewing.senderId === user?.uid}
                  rest={1}
                  delay={0}
                  isDying={false}
                >
                  <ThemedText className="text-2xl leading-8">{viewing.text}</ThemedText>
                  {Object.entries(viewing.reactions).length > 0 && (
                    <View className="mt-4 flex-row gap-2">
                      {Object.entries(viewing.reactions).map(([uid, signal]) =>
                        isSignalId(signal) ? (
                          <Pressable key={uid} onPress={() => showSignalMeaning(signal)} hitSlop={8}>
                            <LightSignal
                              id={signal}
                              color={palette.colorFor(uid)}
                              size={22}
                            />
                          </Pressable>
                        ) : null,
                      )}
                    </View>
                  )}
                </MessageLight>
              </View>
            )}

            {viewing && (
              <View
                className="absolute left-0 right-0 flex-row items-center justify-center px-6"
                style={{ bottom: insets.bottom + Spacing[24] }}
              >
                <Pressable
                  onPress={() => setReactingTo(viewing)}
                  className="rounded-full border border-border bg-background/85 px-5 py-3 active:opacity-70"
                >
                  <ThemedText type="smallBold" style={{ color: palette.accent }}>
                    Responder
                  </ThemedText>
                </Pressable>
              </View>
            )}
          </View>
        </ModalContent>
      </Modal>

      <SignalPicker
        isOpen={Boolean(reactingTo)}
        current={reactingTo && user ? reactingTo.reactions[user.uid] : null}
        onPick={(signal) => reactingTo && react(reactingTo, signal)}
        onClose={() => setReactingTo(null)}
      />
    </KeyboardAvoidingView>
  );
}

function NoteBubble({
  note,
  isMine,
  color,
  rest,
  delay,
  isDying,
  onOpen,
  onLongPress,
  onTogglePin,
  showSignalMeaning,
  colorFor,
}: {
  note: Note;
  isMine: boolean;
  color: string;
  rest: number;
  delay: number;
  isDying: boolean;
  onOpen: () => void;
  onLongPress: () => void;
  onTogglePin: () => void;
  showSignalMeaning: (signal: SignalId) => void;
  colorFor: (uid: string) => string;
}) {
  const signals = Object.entries(note.reactions);

  const open = Gesture.Tap().numberOfTaps(1).onEnd(() => scheduleOnRN(onOpen));
  const answer = Gesture.LongPress().minDuration(350).onStart(() => scheduleOnRN(onLongPress));
  const gesture = Gesture.Exclusive(answer, open);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        entering={FadeIn.duration(260)}
        exiting={FadeOut.duration(220)}
        layout={LinearTransition.duration(260)}
        className={isMine ? "max-w-[82%] self-end" : "max-w-[82%] self-start"}
      >
        <MessageLight color={color} isMine={isMine} rest={rest} delay={delay} isDying={isDying}>
          <View className="flex-row items-start gap-2">
            <ThemedText className="flex-1 text-base leading-6">{note.text}</ThemedText>
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                onTogglePin();
              }}
              hitSlop={10}
              className="active:opacity-60">
              <PinGlyph
                color={note.pinned ? color : `${theme.textSecondary}99`}
                filled={note.pinned}
                size={14}
              />
            </Pressable>
          </View>
          {signals.length > 0 && (
            <View className="mt-3 flex-row gap-1.5">
              {signals.map(([uid, signal]) =>
                isSignalId(signal) ? (
                  <GestureDetector
                    key={uid}
                    gesture={Gesture.Tap().onEnd(() => scheduleOnRN(showSignalMeaning, signal))}>
                    <LightSignal id={signal} color={colorFor(uid)} size={16} />
                  </GestureDetector>
                ) : null,
              )}
            </View>
          )}
        </MessageLight>
      </Animated.View>
    </GestureDetector>
  );
}
