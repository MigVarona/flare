import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import {
  addDoc,
  collection,
  deleteField,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, ScrollView, TextInput, View } from "react-native";
// React Native's own keyboard handling broke on Android once Expo turned on edge-to-edge.
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Eyebrow, GhostButton, GlowCard, ScreenHeader } from "@/components/brand";
import { PinGlyph } from "@/components/icons";
import { LightSignal, isSignalId, useSignalMeaning, type SignalId } from "@/components/light-signals";
import { MessageSkeletons } from "@/components/loading";
import { MessageLight } from "@/components/message-light";
import { SignalPicker } from "@/components/signal-picker";
import { LinkifiedText } from "@/components/linkified-text";
import { ThemedText } from "@/components/themed-text";
import { Modal, ModalBackdrop, ModalContent } from "@/components/ui/modal";
import { BottomTabInset, Colors, glow, MaxPinnedItems, Spacing } from "@/constants/theme";
import { useSpace } from "@/context/space-context";
import { useNotice } from "@/hooks/use-notice";
import { usePalette } from "@/hooks/use-palette";
import { db } from "@/lib/firebase";
import { sendPushNotification } from "@/lib/push";

const theme = Colors.dark;

/** How many notes arrive at a time. Enough to fill the screen a few times over. */
const PageSize = 40;

type Note = {
  id: string;
  text: string;
  senderId: string;
  reactions: Record<string, SignalId>;
  /** Sits outside the page, and doesn't get buried by however much the board grows. */
  pinned: boolean;
};

function readNote(docSnapshot: { id: string; data: () => Record<string, unknown> }): Note {
  const data = docSnapshot.data();
  return {
    id: docSnapshot.id,
    text: data.text as string,
    senderId: data.senderId as string,
    reactions: (data.reactions as Record<string, SignalId>) ?? {},
    pinned: (data.pinned as boolean | undefined) ?? false,
  };
}

/**
 * The Tablón — the door of the fridge, digital. Notes for what's true *now*: the wifi
 * password, "llave en el buzón", a photo of the schedule. Nothing here ages out on its own
 * any more — fix the one or two things that matter most so they stay at the top, and scroll
 * for the rest, same as the Archivo.
 */
export default function BoardScreen() {
  const insets = useSafeAreaInsets();
  const { user, spaceId, otherMembers, myName, isAlone } = useSpace();
  const palette = usePalette();
  const notice = useNotice();
  const showSignalMeaning = useSignalMeaning();
  const scrollRef = useRef<ScrollView>(null);

  const [notes, setNotes] = useState<Note[]>([]);
  const [pinnedNotes, setPinnedNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [viewing, setViewing] = useState<Note | null>(null);
  const [reactingTo, setReactingTo] = useState<Note | null>(null);
  /** How far back we're looking — a page grows on request, not on its own. */
  const [pageSize, setPageSize] = useState(PageSize);

  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", () => setIsKeyboardOpen(true));
    const hidden = Keyboard.addListener("keyboardDidHide", () => setIsKeyboardOpen(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  useEffect(() => {
    if (!spaceId) return undefined;
    const notesQuery = query(
      collection(db, "spaces", spaceId, "messages"),
      orderBy("createdAt", "desc"),
      limit(pageSize),
    );
    return onSnapshot(notesQuery, (snapshot) => {
      setNotes(snapshot.docs.map(readNote).reverse());
      setIsLoading(false);
    });
  }, [spaceId, pageSize]);

  // Scroll to the newest note — but only when one actually arrives. "Ver más" also grows
  // this list, by adding older notes above what's already on screen, and jumping to the
  // bottom right when someone asked to read further back would undo the point of asking.
  const newestId = useRef<string | null>(null);
  useEffect(() => {
    const latest = notes.at(-1)?.id ?? null;
    if (latest !== newestId.current) {
      newestId.current = latest;
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [notes]);

  // Pinned notes live outside the page above, however far back it reaches — the whole point
  // is finding one months later — so they get their own subscription. A plain equality
  // filter needs no composite index; with at most two of them, sorting by hand is simpler
  // than asking Firestore to do it.
  useEffect(() => {
    if (!spaceId) return undefined;
    const pinnedQuery = query(collection(db, "spaces", spaceId, "messages"), where("pinned", "==", true));
    return onSnapshot(pinnedQuery, (snapshot) => {
      setPinnedNotes(snapshot.docs.map(readNote));
    });
  }, [spaceId]);

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

  /** A soft house rule, kept here rather than fought over in the rules — see the Archivo. */
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
        </View>

        <Animated.ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerClassName="gap-3 px-6 py-6"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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
                regularNotes.map((note) => (
                  <NoteBubble
                    key={note.id}
                    note={note}
                    isMine={note.senderId === user?.uid}
                    color={palette.colorFor(note.senderId)}
                    onOpen={() => setViewing(note)}
                    onLongPress={() => setReactingTo(note)}
                    onTogglePin={() => togglePin(note)}
                    showSignalMeaning={showSignalMeaning}
                    colorFor={palette.colorFor}
                  />
                ))
              )}

              {/* A full page probably means there's more behind it. Asking for it is a
                  choice, not something the screen does on its own while you scroll. */}
              {notes.length >= pageSize && (
                <View className="mt-2">
                  <GhostButton title="Ver más" onPress={() => setPageSize(pageSize + PageSize)} />
                </View>
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
                <MessageLight color={palette.colorFor(viewing.senderId)} isMine={viewing.senderId === user?.uid}>
                  <LinkifiedText text={viewing.text} className="text-2xl leading-8" />
                  {Object.entries(viewing.reactions).length > 0 && (
                    <View className="mt-4 flex-row gap-2">
                      {Object.entries(viewing.reactions).map(([uid, signal]) =>
                        isSignalId(signal) ? (
                          <Pressable key={uid} onPress={() => showSignalMeaning(signal)} hitSlop={8}>
                            <LightSignal id={signal} color={palette.colorFor(uid)} size={22} />
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
  onOpen,
  onLongPress,
  onTogglePin,
  showSignalMeaning,
  colorFor,
}: {
  note: Note;
  isMine: boolean;
  color: string;
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
        <MessageLight color={color} isMine={isMine}>
          {/* A row with a flex:1 text needs its container's width resolved before it can
              divide it up — and this bubble's width is itself "whatever the text needs,
              up to 82%", never a fixed number. That circularity is what silently collapsed
              the text to nothing before: a badge overlaid in the corner sidesteps it
              entirely, since the text goes back to being the only thing in the flow. */}
          <LinkifiedText text={note.text} className="pr-5 text-base leading-6" />
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              onTogglePin();
            }}
            hitSlop={10}
            style={{
              // Positive, not negative: sitting just inside the bubble's own padding keeps
              // this clear of the neon border — a negative offset here used to straddle the
              // stroke itself, reading as a bite taken out of the corner rather than a badge.
              position: "absolute",
              top: 6,
              right: 6,
              width: 20,
              height: 20,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: theme.background,
            }}
            className="active:opacity-60">
            <PinGlyph
              color={note.pinned ? color : `${theme.textSecondary}99`}
              filled={note.pinned}
              size={13}
            />
          </Pressable>
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
