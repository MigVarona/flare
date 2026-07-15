import { router } from 'expo-router';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { BrandLockup, Eyebrow, GhostButton, GlowCard, IdentityDot } from '@/components/brand';
import { CardSkeletons } from '@/components/loading';
import { ThemedText } from '@/components/themed-text';
import {
  BottomTabInset,
  Colors,
  MaxContentWidth,
  glow,
  neonBorder,
  Radius,
  Spacing,
} from '@/constants/theme';
import { useCouple } from '@/context/couple-context';
import { usePalette } from '@/hooks/use-palette';
import { db } from '@/lib/firebase';

const theme = Colors.dark;

type Reminder = {
  id: string;
  title: string;
  dueLabel: string;
  dueAt: Date | null;
  createdByUid?: string;
};
type Message = { id: string; text: string; senderId: string; createdAt: Date | null };

/** A reminder with no date isn't due before anything: it waits at the end. */
function dueTime(dueAt: Timestamp | null | undefined) {
  return dueAt ? dueAt.toMillis() : Number.MAX_SAFE_INTEGER;
}

function previewText(text: string, max = 92) {
  return text.length > max ? `${text.slice(0, max - 1).trim()}...` : text;
}

function messageTime(date: Date | null) {
  if (!date) return '';

  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function BellGlyph({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M7.2 10.5a4.8 4.8 0 0 1 9.6 0v3.1l1.5 2.3H5.7l1.5-2.3v-3.1Z"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10 18.1a2.15 2.15 0 0 0 4 0M12 4.9V3.7"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default function HomeScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user, coupleId, isWaitingForPartner, inviteCode, spaceName, myName, partnerName } =
    useCouple();
  const palette = usePalette();

  const [pendingReminders, setPendingReminders] = useState<Reminder[]>([]);
  const [activeReminderIndex, setActiveReminderIndex] = useState(0);
  const [recentMessages, setRecentMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reminderCardWidth = Math.min(MaxContentWidth - Spacing[48], width - Spacing[48]);
  const reminderSnapWidth = reminderCardWidth + Spacing[12];

  useEffect(() => {
    if (!coupleId) return undefined;
    const remindersQuery = query(
      collection(db, 'couples', coupleId, 'reminders'),
      where('status', '==', 'pending'),
    );
    return onSnapshot(remindersQuery, (snapshot) => {
      // "Next" means the one that comes due first — not the one written first. Sorting
      // here rather than in the query keeps the dateless ones, which have nowhere to
      // fall in an ordered query, at the back instead of at the front.
      const next = snapshot.docs
        .map((docSnapshot) => ({ id: docSnapshot.id, data: docSnapshot.data() }))
        .sort(
          (a, b) =>
            dueTime(a.data.dueAt as Timestamp | null) -
            dueTime(b.data.dueAt as Timestamp | null),
        )
        .map(({ id, data }) => ({
          id,
          title: data.title as string,
          dueLabel: data.dueLabel as string,
          dueAt: (data.dueAt as Timestamp | undefined)?.toDate() ?? null,
          createdByUid: data.createdByUid as string | undefined,
        }));

      setPendingReminders(next);
      setActiveReminderIndex((index) => Math.min(index, Math.max(next.length - 1, 0)));
      setIsLoading(false);
    });
  }, [coupleId]);

  useEffect(() => {
    if (!coupleId) return undefined;
    const messagesQuery = query(
      collection(db, 'couples', coupleId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(5),
    );
    return onSnapshot(messagesQuery, (snapshot) => {
      setRecentMessages(
        snapshot.docs
          .map((docSnapshot) => {
            const data = docSnapshot.data();
            const createdAt = data.createdAt as Timestamp | undefined;

            return {
              id: docSnapshot.id,
              text: data.text as string,
              senderId: data.senderId as string,
              createdAt: createdAt ? createdAt.toDate() : null,
            };
          })
          .reverse(),
      );
    });
  }, [coupleId]);

  const colorForUid = (uid?: string) => (uid === user?.uid ? palette.you : palette.partner);

  function handleReminderScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / reminderSnapWidth);
    setActiveReminderIndex(Math.min(Math.max(nextIndex, 0), pendingReminders.length - 1));
  }

  async function sendReminderToCalendar(reminder: Reminder) {
    if (!reminder.dueAt) {
      router.push('/reminders');
      return;
    }

    const stamp = (date: Date) => date.toISOString().replace(/[-:]|\.\d{3}/g, '');
    const end = new Date(reminder.dueAt.getTime() + 30 * 60 * 1000);
    const url =
      'https://calendar.google.com/calendar/render?action=TEMPLATE' +
      `&text=${encodeURIComponent(reminder.title)}` +
      `&dates=${stamp(reminder.dueAt)}/${stamp(end)}` +
      `&details=${encodeURIComponent('Aviso de Churri')}`;

    try {
      await Linking.openURL(url);
    } catch {
      router.push('/reminders');
    }
  }

  return (
    <View style={styles.screen}>
    <Animated.ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingTop: safeAreaInsets.top + Spacing[24], paddingBottom: BottomTabInset + Spacing[32] },
      ]}>
      <View style={styles.inner}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <BrandLockup size={34} />
            <Pressable
              onPress={() => router.push('/settings')}
              hitSlop={12}
              style={({ pressed }) => pressed && styles.pressed}>
              <Eyebrow>Ajustes</Eyebrow>
            </Pressable>
          </View>
          <ThemedText type="default" style={styles.spaceTitle}>
            {spaceName ?? 'Vuestro espacio'}
          </ThemedText>
          <View style={styles.presenceRow}>
            <IdentityDot isMine size={12} />
            <ThemedText type="small" themeColor="textSecondary">
              {myName}
            </ThemedText>
            <View style={styles.presenceGap} />
            <IdentityDot isMine={false} size={12} />
            <ThemedText type="small" themeColor="textSecondary">
              {isWaitingForPartner ? 'Sin llegar' : partnerName}
            </ThemedText>
          </View>
        </View>

        {isWaitingForPartner && inviteCode && (
          <GlowCard color={palette.accent}>
            <Eyebrow color={palette.accent}>La llave</Eyebrow>
            <ThemedText type="key" selectable>
              {inviteCode}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Hace falta para entrar
            </ThemedText>
            <View style={styles.cardAction}>
              <GhostButton
                title="Compartir llave"
                color={palette.partner}
                onPress={() =>
                  Share.share({
                    message: `Esta es la llave de nuestro espacio en Churri: ${inviteCode}`,
                  })
                }
              />
            </View>
          </GlowCard>
        )}

        {isLoading && <CardSkeletons count={2} />}

        {!isLoading && (
          <View style={styles.section}>
            <ThemedText type="headline" style={styles.sectionTitle}>
              Avisos
            </ThemedText>
            {pendingReminders.length > 0 ? (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  decelerationRate="fast"
                  snapToInterval={reminderSnapWidth}
                  snapToAlignment="start"
                  contentContainerStyle={styles.reminderCarousel}
                  onMomentumScrollEnd={handleReminderScroll}>
                  {pendingReminders.map((reminder) => {
                    const reminderColor = colorForUid(reminder.createdByUid);

                    return (
                      <Pressable
                        key={reminder.id}
                        onPress={() => router.push('/reminders')}
                        style={({ pressed }) => [styles.reminderPressable, pressed && styles.pressed]}>
                        <View style={[styles.reminderCard, { width: reminderCardWidth }]}>
                          <View style={styles.reminderBody}>
                            <View style={styles.reminderMeta}>
                              <View
                                style={[
                                  styles.identityPoint,
                                  { backgroundColor: reminderColor },
                                  glow(reminderColor, 12, '77'),
                                ]}
                              />
                              <Eyebrow>Próximo</Eyebrow>
                            </View>
                            <ThemedText type="default" style={styles.homeItemTitle}>
                              {reminder.title}
                            </ThemedText>
                            <ThemedText type="small" style={styles.homeItemTime}>
                              {reminder.dueLabel}
                            </ThemedText>
                          </View>
                          <Pressable
                            onPress={(event) => {
                              event.stopPropagation();
                              void sendReminderToCalendar(reminder);
                            }}
                            hitSlop={12}
                            accessibilityRole="button"
                            accessibilityLabel="Añadir aviso al calendario"
                            style={({ pressed }) => [styles.bellButton, pressed && styles.pressed]}>
                            <BellGlyph color={theme.textSecondary} size={21} />
                          </Pressable>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                {pendingReminders.length > 1 && (
                  <View style={styles.carouselDots}>
                    {pendingReminders.map((reminder, index) => (
                      <View
                        key={reminder.id}
                        style={[
                          styles.carouselDot,
                          index === activeReminderIndex && styles.carouselDotActive,
                        ]}
                      />
                    ))}
                  </View>
                )}
              </>
            ) : (
              <Pressable onPress={() => router.push('/reminders')} className="active:opacity-80">
                <GlowCard style={styles.emptyCard}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Nada pendiente por ahora.
                  </ThemedText>
                </GlowCard>
              </Pressable>
            )}
          </View>
        )}

        {!isLoading && (
          <Pressable onPress={() => router.push('/chat')} className="active:opacity-80">
            <View style={styles.section}>
              <ThemedText type="headline" style={styles.sectionTitle}>
                Mensajes
              </ThemedText>
              {recentMessages.length > 0 ? (
                <View style={styles.messageStack}>
                  {recentMessages.map((message) => {
                    const messageColor = colorForUid(message.senderId);

                    return (
                      <View
                        key={message.id}
                        style={[
                          styles.messageBubble,
                          neonBorder(messageColor, '99'),
                          { backgroundColor: `${messageColor}0D` },
                        ]}>
                        <View style={styles.messageCopy}>
                          <ThemedText type="default" style={styles.homeItemTitle}>
                            {previewText(message.text, 86)}
                          </ThemedText>
                          <ThemedText type="small" style={styles.homeItemTime}>
                            {messageTime(message.createdAt)}
                          </ThemedText>
                        </View>
                        <View
                          style={[
                            styles.messagePoint,
                            { backgroundColor: messageColor },
                            glow(messageColor, 12, '77'),
                          ]}
                        />
                      </View>
                    );
                  })}
                </View>
              ) : (
                <GlowCard style={styles.emptyCard}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Caben cinco. El primero sigue libre.
                  </ThemedText>
                </GlowCard>
              )}
            </View>
          </Pressable>
        )}
      </View>
    </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: Spacing[24],
  },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing[16],
  },
  header: {
    gap: Spacing[8],
    marginBottom: Spacing[4],
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pressed: {
    opacity: 0.6,
  },
  spaceTitle: {
    marginTop: Spacing[12],
    fontFamily: 'Outfit_700Bold',
    fontSize: 30,
    lineHeight: 36,
  },
  presenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[8],
  },
  presenceGap: {
    width: Spacing[8],
  },
  cardAction: {
    marginTop: Spacing[8],
  },
  section: {
    gap: Spacing[12],
  },
  sectionTitle: {
    marginTop: Spacing[8],
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 20,
    lineHeight: 26,
  },
  homeItemTitle: {
    color: '#D8DBE8',
    fontFamily: 'Outfit_400Regular',
    fontSize: 15,
    lineHeight: 21,
  },
  homeItemTime: {
    color: '#7E849A',
  },
  reminderCarousel: {
    gap: Spacing[12],
    paddingRight: Spacing[4],
  },
  reminderPressable: {
    flexShrink: 0,
  },
  reminderCard: {
    minHeight: 142,
    alignItems: 'center',
    borderRadius: Radius.large,
    backgroundColor: theme.backgroundElement,
    borderWidth: 1,
    borderColor: `${theme.textSecondary}35`,
    flexDirection: 'row',
    gap: Spacing[16],
    justifyContent: 'space-between',
    padding: Spacing[24],
  },
  reminderBody: {
    flex: 1,
    gap: Spacing[8],
  },
  reminderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[8],
  },
  identityPoint: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
  },
  carouselDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing[8],
  },
  carouselDot: {
    width: 6,
    height: 6,
    borderRadius: Radius.pill,
    backgroundColor: theme.border,
  },
  carouselDotActive: {
    width: 18,
    backgroundColor: theme.text,
  },
  emptyCard: {
    marginTop: 0,
  },
  bellButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    alignSelf: 'flex-start',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    transform: [{ translateY: -6 }],
  },
  messageStack: {
    gap: Spacing[12],
  },
  messageBubble: {
    minHeight: 76,
    borderRadius: Radius.large,
    paddingHorizontal: Spacing[20],
    paddingVertical: Spacing[16],
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing[16],
  },
  messageCopy: {
    flex: 1,
    gap: Spacing[4],
  },
  messagePoint: {
    width: 11,
    height: 11,
    alignSelf: 'flex-end',
    borderRadius: Radius.pill,
    marginBottom: Spacing[8],
  },
});
