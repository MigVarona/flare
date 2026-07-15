import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
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
import { Pressable, Share, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandLockup, Eyebrow, GhostButton, GlowCard, IdentityDot } from '@/components/brand';
import { CardSkeletons } from '@/components/loading';
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
import { usePalette } from '@/hooks/use-palette';
import { db } from '@/lib/firebase';

const theme = Colors.dark;

type Reminder = { title: string; dueLabel: string; createdByUid?: string };

/** A reminder with no date isn't due before anything: it waits at the end. */
function dueTime(dueAt: Timestamp | null | undefined) {
  return dueAt ? dueAt.toMillis() : Number.MAX_SAFE_INTEGER;
}
type Photo = { url: string; uploadedByUid: string };
type Message = { text: string; senderId: string };

function previewText(text: string, max = 92) {
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
}

export default function HomeScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const { user, coupleId, isWaitingForPartner, inviteCode, spaceName, myName, partnerName } =
    useCouple();
  const palette = usePalette();

  const [nextReminder, setNextReminder] = useState<Reminder | null>(null);
  const [lastMessage, setLastMessage] = useState<Message | null>(null);
  const [recentPhotos, setRecentPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      const first = snapshot.docs
        .map((docSnapshot) => docSnapshot.data())
        .sort((a, b) => dueTime(a.dueAt as Timestamp | null) - dueTime(b.dueAt as Timestamp | null))
        .at(0);

      setNextReminder(
        first
          ? {
              title: first.title as string,
              dueLabel: first.dueLabel as string,
              createdByUid: first.createdByUid as string | undefined,
            }
          : null,
      );
      setIsLoading(false);
    });
  }, [coupleId]);

  useEffect(() => {
    if (!coupleId) return undefined;
    const messagesQuery = query(
      collection(db, 'couples', coupleId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(1),
    );
    return onSnapshot(messagesQuery, (snapshot) => {
      const first = snapshot.docs[0];
      setLastMessage(
        first
          ? { text: first.data().text as string, senderId: first.data().senderId as string }
          : null,
      );
    });
  }, [coupleId]);

  useEffect(() => {
    if (!coupleId) return undefined;
    const photosQuery = query(
      collection(db, 'couples', coupleId, 'photos'),
      orderBy('createdAt', 'desc'),
      limit(1),
    );
    return onSnapshot(photosQuery, (snapshot) => {
      setRecentPhotos(
        snapshot.docs.map((docSnapshot) => ({
          url: docSnapshot.data().imageUrl as string,
          uploadedByUid: docSnapshot.data().uploadedByUid as string,
        })),
      );
    });
  }, [coupleId]);

  const lastPhoto = recentPhotos[0] ?? null;
  const lastPhotoColor =
    lastPhoto?.uploadedByUid === user?.uid ? palette.you : palette.partner;
  const nextReminderColor = nextReminder
    ? nextReminder.createdByUid === user?.uid
      ? palette.you
      : palette.partner
    : undefined;
  const lastMessageColor = lastMessage
    ? lastMessage.senderId === user?.uid
      ? palette.you
      : palette.partner
    : undefined;

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
          <ThemedText type="title" style={styles.spaceTitle}>
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

        {isLoading && <CardSkeletons count={3} />}

        {!isLoading && (
          <Pressable onPress={() => router.push('/reminders')} className="active:opacity-80">
            <GlowCard color={nextReminderColor} style={styles.compactCard}>
              <Eyebrow>Avisos</Eyebrow>
              {nextReminder ? (
                <>
                  <ThemedText type="headline">{nextReminder.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {nextReminder.dueLabel}
                  </ThemedText>
                </>
              ) : (
                <>
                  <ThemedText type="small" themeColor="textSecondary">
                    Nada pendiente por ahora.
                  </ThemedText>
                </>
              )}
            </GlowCard>
          </Pressable>
        )}

        {isLoading ? null : lastPhoto ? (
          <Pressable onPress={() => router.push('/gallery')}>
            <View style={[styles.photoCard, neonBorder(lastPhotoColor, 'BB')]}>
              <Image source={{ uri: lastPhoto.url }} style={styles.photoHero} />
              <LinearGradient
                colors={['transparent', 'rgba(1,3,15,0.55)', 'rgba(1,3,15,0.95)']}
                style={styles.photoScrim}
              />
              <View style={styles.photoOverlay}>
                <Eyebrow>Fotos</Eyebrow>
              </View>
            </View>
          </Pressable>
        ) : (
          <Pressable onPress={() => router.push('/gallery')} className="active:opacity-80">
            <GlowCard style={styles.compactCard}>
              <Eyebrow>Fotos</Eyebrow>
              <ThemedText type="small" themeColor="textSecondary">
                Todavía no hay fotos.
              </ThemedText>
            </GlowCard>
          </Pressable>
        )}

        {isLoading ? null : (
        <Pressable onPress={() => router.push('/chat')} className="active:opacity-80">
        <GlowCard color={lastMessageColor} style={styles.compactCard}>
          <Eyebrow>Mensajes</Eyebrow>
          {lastMessage ? (
            <>
              <ThemedText type="headline">{previewText(lastMessage.text)}</ThemedText>
            </>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              Caben cinco. El primero sigue libre.
            </ThemedText>
          )}

        </GlowCard>
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
  compactCard: {
    marginTop: 0,
  },
  photoCard: {
    height: 240,
    borderRadius: Radius.large,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: theme.backgroundElement,
  },
  photoHero: {
    ...StyleSheet.absoluteFill,
  },
  photoScrim: {
    ...StyleSheet.absoluteFill,
    top: '35%',
  },
  photoOverlay: {
    gap: Spacing[8],
    padding: Spacing[24],
  },
});
