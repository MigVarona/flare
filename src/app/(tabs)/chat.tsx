import { LinearGradient } from 'expo-linear-gradient';
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, TextInput, View } from 'react-native';
// React Native's own keyboard handling broke on Android once Expo turned on edge-to-edge.
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Eyebrow } from '@/components/brand';
import { LightSignal, isSignalId, type SignalId } from '@/components/light-signals';
import { MessageSkeletons } from '@/components/loading';
import { SignalPicker } from '@/components/signal-picker';
import { ThemedText } from '@/components/themed-text';
import {
  BottomTabInset,
  Colors,
  glow,
  MessageCapacity,
  neonBorder,
  Spacing,
} from '@/constants/theme';
import { useCouple } from '@/context/couple-context';
import { usePalette } from '@/hooks/use-palette';
import { db } from '@/lib/firebase';
import { sendPushNotification } from '@/lib/push';

const theme = Colors.dark;

type Message = {
  id: string;
  text: string;
  senderId: string;
  /** Who answered with light, and with which signal. */
  reactions: Record<string, SignalId>;
};

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { user, coupleId, partnerUid } = useCouple();
  const palette = usePalette();
  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [reactingTo, setReactingTo] = useState<Message | null>(null);

  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardOpen(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardOpen(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  useEffect(() => {
    if (!coupleId) return undefined;
    const messagesQuery = query(
      collection(db, 'couples', coupleId, 'messages'),
      orderBy('createdAt', 'asc'),
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
    });
  }, [coupleId]);

  const react = async (message: Message, signal: SignalId | null) => {
    if (!coupleId || !user) return;
    setReactingTo(null);
    await updateDoc(doc(db, 'couples', coupleId, 'messages', message.id), {
      [`reactions.${user.uid}`]: signal ?? deleteField(),
    });
  };

  const canSend = draft.trim().length > 0;

  const sendMessage = async () => {
    if (!coupleId || !user || !draft.trim()) return;
    const text = draft.trim();
    setDraft('');

    await addDoc(collection(db, 'couples', coupleId, 'messages'), {
      text,
      senderId: user.uid,
      createdAt: serverTimestamp(),
    });

    // The space only holds so much. Anything older than that stops existing —
    // for both of you, at the same time.
    const overflow = messages.length + 1 - MessageCapacity;
    if (overflow > 0) {
      await Promise.all(
        messages
          .slice(0, overflow)
          .map((message) => deleteDoc(doc(db, 'couples', coupleId, 'messages', message.id))),
      );
    }

    if (partnerUid) {
      const partnerSnapshot = await getDoc(doc(db, 'users', partnerUid));
      const partnerToken = partnerSnapshot.data()?.expoPushToken as string | undefined;
      if (partnerToken) {
        sendPushNotification(partnerToken, 'Mensaje nuevo', text);
      }
    }
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-background" behavior="padding">
      <View
        className="w-full max-w-200 flex-1 self-center"
        style={{ paddingTop: insets.top + Spacing.four }}>
        <View className="gap-2 px-6 pb-4">
          <Eyebrow>Solo cabe lo de ahora</Eyebrow>
          <ThemedText type="title" className="text-[34px] leading-10 font-extrabold tracking-tight">
            Mensajes
          </ThemedText>
        </View>

        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerClassName="gap-3 px-6 py-6"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
          {isLoading ? (
            <MessageSkeletons />
          ) : messages.length === 0 ? (
            <ThemedText className="py-16 text-center leading-6 text-muted-foreground">
              Aquí no cabe el ruido. Solo lo que de verdad le quieras decir.
            </ThemedText>
          ) : (
            messages.map((message, index) => {
              const isMine = message.senderId === user?.uid;
              const color = isMine ? palette.you : palette.partner;

              // The oldest message is the faintest: it is already on its way out.
              // The rule is shown as light, not explained in a label.
              const age = messages.length - 1 - index;
              const fade = Math.max(0.35, 1 - age * (0.65 / Math.max(1, MessageCapacity - 1)));

              const signals = Object.entries(message.reactions);
              const doubleTap = Gesture.Tap()
                .numberOfTaps(2)
                .onEnd(() => scheduleOnRN(setReactingTo, message));

              return (
                <Animated.View
                  key={message.id}
                  entering={FadeIn.duration(260)}
                  exiting={FadeOut.duration(420)}
                  layout={LinearTransition.duration(260)}
                  className={isMine ? 'max-w-[82%] self-end' : 'max-w-[82%] self-start'}>
                  <GestureDetector gesture={doubleTap}>
                    <View
                      className={`rounded-3xl px-4 py-4 ${
                        isMine ? 'rounded-br-lg' : 'rounded-bl-lg'
                      }`}
                      style={[
                        { opacity: fade, backgroundColor: `${color}1A` },
                        neonBorder(color, '77'),
                        glow(color, 14, '33'),
                      ]}>
                      <ThemedText className="text-base leading-6">{message.text}</ThemedText>
                    </View>
                  </GestureDetector>

                  {signals.length > 0 && (
                    <View
                      className={`mt-1 flex-row gap-2 ${isMine ? 'justify-end pr-3' : 'pl-3'}`}>
                      {signals.map(([uid, signal]) =>
                        isSignalId(signal) ? (
                          <LightSignal
                            key={uid}
                            id={signal}
                            color={uid === user?.uid ? palette.you : palette.partner}
                            size={20}
                          />
                        ) : null,
                      )}
                    </View>
                  )}
                </Animated.View>
              );
            })
          )}
        </ScrollView>

        <View
          className="border-t border-border px-6 pt-4"
          style={{
            paddingBottom: isKeyboardOpen ? Spacing.three : insets.bottom + BottomTabInset,
          }}>
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
                canSend ? '' : 'opacity-35'
              }`}
              style={canSend ? glow(palette.accent, 18, '66') : undefined}>
              <LinearGradient
                colors={palette.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ paddingHorizontal: Spacing.four, paddingVertical: Spacing.three }}>
                <ThemedText type="smallBold" style={{ color: theme.background }}>
                  Enviar
                </ThemedText>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>

      <SignalPicker
        isOpen={Boolean(reactingTo)}
        current={reactingTo && user ? reactingTo.reactions[user.uid] : null}
        onPick={(signal) => reactingTo && react(reactingTo, signal)}
        onClose={() => setReactingTo(null)}
      />
    </KeyboardAvoidingView>
  );
}
