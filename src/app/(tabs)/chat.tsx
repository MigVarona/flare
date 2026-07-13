import { LinearGradient } from 'expo-linear-gradient';
import {
  addDoc,
  collection,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Eyebrow } from '@/components/brand';
import { ThemedText } from '@/components/themed-text';
import {
  BottomTabInset,
  BrandGradient,
  Colors,
  glow,
  MaxContentWidth,
  neonBorder,
  Radius,
  Spacing,
} from '@/constants/theme';
import { useCouple } from '@/context/couple-context';
import { db } from '@/lib/firebase';

const theme = Colors.dark;

type Message = {
  id: string;
  text: string;
  senderId: string;
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { user, coupleId, dailyMessageLimit } = useCouple();

  const [messages, setMessages] = useState<Message[]>([]);
  const [sentToday, setSentToday] = useState(0);
  const [draft, setDraft] = useState('');

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
        })),
      );
    });
  }, [coupleId]);

  useEffect(() => {
    if (!coupleId || !user) return undefined;
    const quotaRef = doc(db, 'couples', coupleId, 'messageQuotas', `${user.uid}_${todayKey()}`);
    return onSnapshot(quotaRef, (snapshot) => {
      setSentToday((snapshot.data()?.used as number | undefined) ?? 0);
    });
  }, [coupleId, user]);

  const remaining = dailyMessageLimit - sentToday;
  const canSend = remaining > 0 && draft.trim().length > 0;

  const sendMessage = async () => {
    if (!coupleId || !user || remaining <= 0 || !draft.trim()) return;
    const text = draft.trim();
    setDraft('');
    await addDoc(collection(db, 'couples', coupleId, 'messages'), {
      text,
      senderId: user.uid,
      createdAt: serverTimestamp(),
    });
    await setDoc(
      doc(db, 'couples', coupleId, 'messageQuotas', `${user.uid}_${todayKey()}`),
      { userId: user.uid, date: todayKey(), used: increment(1) },
      { merge: true },
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top}>
      <View style={[styles.inner, { paddingTop: insets.top + Spacing.four }]}>
        <View style={styles.header}>
          <Eyebrow>Contadas, por eso importan</Eyebrow>
          <ThemedText type="title" style={styles.title}>
            Mensajes
          </ThemedText>

          <View style={styles.quotaBar}>
            {Array.from({ length: dailyMessageLimit }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.quotaTick,
                  index < remaining
                    ? [{ backgroundColor: theme.you }, glow(theme.you, 6, 'AA')]
                    : styles.quotaTickSpent,
                ]}
              />
            ))}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {remaining > 0
              ? `Te quedan ${remaining} de ${dailyMessageLimit} hoy`
              : 'Has gastado los de hoy'}
          </ThemedText>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.messages}
          showsVerticalScrollIndicator={false}>
          {messages.length === 0 && (
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              Aquí no cabe el ruido. Solo lo que de verdad le quieras decir.
            </ThemedText>
          )}

          {messages.map((message) => {
            const isMine = message.senderId === user?.uid;
            const color = isMine ? theme.you : theme.partner;
            return (
              <View
                key={message.id}
                style={[
                  styles.bubble,
                  isMine ? styles.bubbleMine : styles.bubbleTheirs,
                  { backgroundColor: `${color}1A` },
                  neonBorder(color, '77'),
                  glow(color, 14, '33'),
                ]}>
                <ThemedText style={styles.bubbleText}>{message.text}</ThemedText>
              </View>
            );
          })}
        </ScrollView>

        <View style={[styles.composer, { paddingBottom: insets.bottom + BottomTabInset }]}>
          {remaining > 0 ? (
            <View style={styles.composerRow}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Escribe…"
                placeholderTextColor={theme.textSecondary}
                style={styles.input}
                onSubmitEditing={sendMessage}
              />
              <Pressable
                onPress={canSend ? sendMessage : undefined}
                disabled={!canSend}
                style={({ pressed }) => [
                  styles.sendWrapper,
                  canSend && glow(theme.accent, 18, '66'),
                  pressed && styles.pressed,
                  !canSend && styles.disabled,
                ]}>
                <LinearGradient
                  colors={BrandGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.sendFill}>
                  <ThemedText type="smallBold" style={styles.sendLabel}>
                    Enviar
                  </ThemedText>
                </LinearGradient>
              </Pressable>
            </View>
          ) : (
            <ThemedText themeColor="textSecondary" style={styles.blocked}>
              Vuelve mañana. Guárdate lo que le quieras decir.
            </ThemedText>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.background,
  },
  flex: {
    flex: 1,
  },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  quotaBar: {
    flexDirection: 'row',
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  quotaTick: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  quotaTickSpent: {
    backgroundColor: theme.backgroundSelected,
  },
  messages: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Radius.large,
  },
  bubbleMine: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: Radius.small,
  },
  bubbleTheirs: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: Radius.small,
  },
  bubbleText: {
    fontSize: 16,
    lineHeight: 23,
  },
  empty: {
    textAlign: 'center',
    lineHeight: 22,
    paddingVertical: Spacing.six,
  },
  composer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    backgroundColor: theme.backgroundElement,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    fontSize: 16,
    color: theme.text,
    ...neonBorder(theme.border, 'FF'),
  },
  sendWrapper: {
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  sendFill: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  sendLabel: {
    color: '#0B0710',
    fontWeight: '800',
  },
  blocked: {
    textAlign: 'center',
    lineHeight: 22,
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.35,
  },
});
