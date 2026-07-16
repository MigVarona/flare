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

import { ScreenHeader } from "@/components/brand";
import { LightSignal, isSignalId, type SignalId } from "@/components/light-signals";
import { MessageSkeletons } from "@/components/loading";
import { DeathMs, MessageLight, StepMs } from "@/components/message-light";
import { SignalPicker } from "@/components/signal-picker";
import { ThemedText } from "@/components/themed-text";
import { Modal, ModalBackdrop, ModalContent } from "@/components/ui/modal";
import {
  BottomTabInset,
  Colors,
  glow,
  MessageCapacity,
  Spacing,
} from "@/constants/theme";
import { useCouple } from "@/context/couple-context";
import { usePalette } from "@/hooks/use-palette";
import { db } from "@/lib/firebase";
import { sendPushNotification } from "@/lib/push";

const theme = Colors.dark;

type Message = {
  id: string;
  text: string;
  senderId: string;
  reactions: Record<string, SignalId>;
};

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { user, coupleId, partnerUid, myName } = useCouple();
  const palette = usePalette();
  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [viewing, setViewing] = useState<Message | null>(null);
  const [reactingTo, setReactingTo] = useState<Message | null>(null);
  /** Messages we've already asked to delete, so a second snapshot doesn't ask again. */
  const trimmed = useRef(new Set<string>());
  /** The ones the surge is on its way to put out. They're still here; they just aren't for long. */
  const [dying, setDying] = useState<string[]>([]);
  /** Bumped by every arrival. The bubbles watch it to know when to carry the surge. */
  const [surge, setSurge] = useState(0);
  const newest = useRef<string | null>(null);


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
    if (!coupleId) return undefined;
    const messagesQuery = query(
      collection(db, "couples", coupleId, "messages"),
      orderBy("createdAt", "asc"),
    );
    return onSnapshot(messagesQuery, (snapshot) => {
      setMessages(
        snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          text: docSnapshot.data().text as string,
          senderId: docSnapshot.data().senderId as string,
          reactions: (docSnapshot.data().reactions as Record<string, SignalId>) ?? {},
        })),
      );
      setIsLoading(false);

      // An arrival sends a surge up the conversation. Not on first load, though: opening the
      // chat is not an event, and lighting the whole screen up would say something happened.
      const arrived = snapshot.docs.at(-1)?.id ?? null;
      if (newest.current && arrived && arrived !== newest.current) {
        setSurge((count) => count + 1);
      }
      newest.current = arrived;

      // The space holds five. Trimming used to be the sender's job, done against their own
      // copy of the list — so two people writing at the same moment could each count five,
      // and leave six standing, or throw the same one out twice.
      //
      // Whoever *sees* too many trims instead. Both phones may reach for the same message,
      // and that's fine: deleting what's already gone changes nothing. They converge on five
      // without having to agree on anything.
      //
      // The delay is the point: the light has to go out before the record does, or the
      // message would simply blink out of existence and the rule would stay invisible.
      const overflow = snapshot.docs.length - MessageCapacity;
      for (const oldest of snapshot.docs.slice(0, Math.max(0, overflow))) {
        if (trimmed.current.has(oldest.id)) continue;
        trimmed.current.add(oldest.id);
        setDying((ids) => [...ids, oldest.id]);
        // A light going out is felt, not just seen. It's the one thing here you can't undo.
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setTimeout(() => void deleteDoc(oldest.ref), DeathMs);
      }
    });
  }, [coupleId]);

  const canSend = draft.trim().length > 0;

  const sendMessage = async () => {
    if (!coupleId || !user || !draft.trim()) return;
    const text = draft.trim();
    setDraft("");

    await addDoc(collection(db, "couples", coupleId, "messages"), {
      text,
      senderId: user.uid,
      createdAt: serverTimestamp(),
    });

    if (partnerUid) {
      sendPushNotification(coupleId, partnerUid, myName, text, "/chat");
    }
  };

  const react = async (message: Message, signal: SignalId | null) => {
    if (!coupleId || !user) return;
    setReactingTo(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await updateDoc(doc(db, "couples", coupleId, "messages", message.id), {
      [`reactions.${user.uid}`]: signal ?? deleteField(),
    });
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-background" behavior="padding">
      <View
        className="w-full max-w-200 flex-1 self-center"
        style={{ paddingTop: insets.top + Spacing[24] }}
      >
        <View className="px-6">
          <ScreenHeader title="Mensajes" />
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
          ) : messages.length === 0 ? (
            <ThemedText className="py-16 text-center leading-6 text-muted-foreground">
              Dejad el primer mensaje encendido.
            </ThemedText>
          ) : (
            messages.map((message, index) => {
              const isMine = message.senderId === user?.uid;
              const color = isMine ? palette.you : palette.partner;

              // The oldest message is the faintest: it is already on its way out.
              // The rule is shown as light, not explained in a label.
              const distance = messages.length - 1 - index;
              const rest = Math.max(
                0.35,
                1 - distance * (0.65 / Math.max(1, MessageCapacity - 1)),
              );
              const signals = Object.entries(message.reactions);

              const open = Gesture.Tap()
                .numberOfTaps(1)
                .onEnd(() => scheduleOnRN(setViewing, message));
              const answer = Gesture.LongPress()
                .minDuration(350)
                .onStart(() => scheduleOnRN(setReactingTo, message));
              const gesture = Gesture.Exclusive(answer, open);

              return (
                <GestureDetector key={message.id} gesture={gesture}>
                  <Animated.View
                  key={message.id}
                  entering={FadeIn.duration(260)}
                  exiting={FadeOut.duration(220)}
                  layout={LinearTransition.duration(260)}
                  className={
                    isMine ? "max-w-[82%] self-end" : "max-w-[82%] self-start"
                  }
                >
                    <MessageLight
                        color={color}
                        isMine={isMine}
                        rest={rest}
                        delay={distance * StepMs}
                        isDying={dying.includes(message.id)}
                      >
                        <ThemedText className="text-base leading-6">
                          {message.text}
                        </ThemedText>
                        {signals.length > 0 && (
                          <View className="mt-3 flex-row gap-1.5">
                            {signals.map(([uid, signal]) =>
                              isSignalId(signal) ? (
                                <LightSignal
                                  key={uid}
                                  id={signal}
                                  color={uid === user?.uid ? palette.you : palette.partner}
                                  size={16}
                                />
                              ) : null,
                            )}
                          </View>
                        )}
                    </MessageLight>
                  </Animated.View>
                </GestureDetector>
              );
            })
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
              onSubmitEditing={sendMessage}
            />
            <Pressable
              onPress={canSend ? sendMessage : undefined}
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
            <View className="absolute left-0 right-0 px-6" style={{ top: insets.top + Spacing[16] }}>
              <Pressable
                onPress={() => setViewing(null)}
                className="self-start rounded-full border border-border bg-background/80 px-4 py-3 active:opacity-70"
              >
                <ThemedText type="smallBold">Cerrar</ThemedText>
              </Pressable>
            </View>

            {viewing && (
              <View className={viewing.senderId === user?.uid ? "items-end" : "items-start"}>
                <MessageLight
                  color={viewing.senderId === user?.uid ? palette.you : palette.partner}
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
                          <LightSignal
                            key={uid}
                            id={signal}
                            color={uid === user?.uid ? palette.you : palette.partner}
                            size={22}
                          />
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
