import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { collection, doc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Eyebrow, GhostButton, GlowCard, IdentityDot } from '@/components/brand';
import { CardSkeletons } from '@/components/loading';
import { ThemedText } from '@/components/themed-text';
import {
  BottomTabInset,
  Colors,
  glow,
  MaxContentWidth,
  MessageCapacity,
  neonBorder,
  Radius,
  Spacing,
} from '@/constants/theme';
import { useCouple } from '@/context/couple-context';
import { usePalette } from '@/hooks/use-palette';
import { db } from '@/lib/firebase';

const theme = Colors.dark;

type Reminder = { title: string; dueLabel: string; createdByUid?: string };
type Photo = { url: string; uploadedByUid: string };
type Message = { text: string; senderId: string };

export default function HomeScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const { user, coupleId, isWaitingForPartner, inviteCode, spaceName, myName, partnerName } =
    useCouple();
  const palette = usePalette();

  const [nextReminder, setNextReminder] = useState<Reminder | null>(null);
  const [lastMessage, setLastMessage] = useState<Message | null>(null);
  const [messageCount, setMessageCount] = useState(0);
  const [recentPhotos, setRecentPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!coupleId) return undefined;
    const remindersQuery = query(
      collection(db, 'couples', coupleId, 'reminders'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'asc'),
      limit(1),
    );
    return onSnapshot(remindersQuery, (snapshot) => {
      const first = snapshot.docs[0];
      setNextReminder(
        first
          ? {
              title: first.data().title as string,
              dueLabel: first.data().dueLabel as string,
              createdByUid: first.data().createdByUid as string | undefined,
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
    );
    return onSnapshot(messagesQuery, (snapshot) => {
      const first = snapshot.docs[0];
      setLastMessage(
        first
          ? { text: first.data().text as string, senderId: first.data().senderId as string }
          : null,
      );
      setMessageCount(snapshot.size);
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

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: safeAreaInsets.top + Spacing.four, paddingBottom: BottomTabInset + Spacing.five },
      ]}>
      <View style={styles.inner}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Eyebrow>{isWaitingForPartner ? 'Falta tu pareja' : 'Estáis los dos'}</Eyebrow>
            <Pressable
              onPress={() => router.push('/settings')}
              hitSlop={12}
              style={({ pressed }) => pressed && styles.pressed}>
              <Eyebrow>Ajustes</Eyebrow>
            </Pressable>
          </View>
          <ThemedText type="title" style={styles.title}>
            {spaceName ?? 'Vuestro espacio'}
          </ThemedText>
          <View style={styles.presenceRow}>
            <IdentityDot isMine size={9} />
            <ThemedText type="small" themeColor="textSecondary">
              {myName}
            </ThemedText>
            <View style={styles.presenceGap} />
            <IdentityDot isMine={false} size={9} />
            <ThemedText type="small" themeColor="textSecondary">
              {isWaitingForPartner ? 'Sin llegar' : partnerName}
            </ThemedText>
          </View>
        </View>

        {isWaitingForPartner && inviteCode && (
          <GlowCard color={palette.accent}>
            <Eyebrow color={palette.accent}>La llave</Eyebrow>
            <ThemedText selectable style={styles.keyText}>
              {inviteCode}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Tu pareja la necesita para entrar
            </ThemedText>
            <View style={styles.cardAction}>
              <GhostButton
                title="Compartir llave"
                color={palette.partner}
                onPress={() =>
                  Share.share({
                    message: `Entra en nuestro espacio en Churriapp con esta llave: ${inviteCode}`,
                  })
                }
              />
            </View>
          </GlowCard>
        )}

        {isLoading && <CardSkeletons count={3} />}

        {!isLoading && (
          <Pressable onPress={() => router.push('/reminders')} className="active:opacity-80">
            <GlowCard>
              <Eyebrow>Lo próximo</Eyebrow>
              {nextReminder ? (
                <>
                  <View style={styles.authorRow}>
                    <IdentityDot isMine={nextReminder.createdByUid === user?.uid} />
                    <ThemedText type="small" themeColor="textSecondary">
                      {nextReminder.createdByUid === user?.uid
                        ? 'Lo pusiste tú'
                        : `Lo puso ${partnerName}`}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.cardHeadline}>{nextReminder.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {nextReminder.dueLabel}
                  </ThemedText>
                </>
              ) : (
                <ThemedText themeColor="textSecondary">Nada pendiente entre vosotros</ThemedText>
              )}
            </GlowCard>
          </Pressable>
        )}

        {isLoading ? null : lastPhoto ? (
          <Pressable onPress={() => router.push('/gallery')}>
            <View
              style={[
                styles.photoCard,
                neonBorder(lastPhotoColor, '77'),
                glow(lastPhotoColor, 26, '33'),
              ]}>
              <Image source={{ uri: lastPhoto.url }} style={styles.photoHero} />
              <LinearGradient
                colors={['transparent', 'rgba(11,7,16,0.55)', 'rgba(11,7,16,0.95)']}
                style={styles.photoScrim}
              />
              <View style={styles.photoOverlay}>
                <Eyebrow>Lo último que visteis</Eyebrow>
                <View style={styles.authorRow}>
                  <IdentityDot isMine={lastPhoto.uploadedByUid === user?.uid} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {lastPhoto.uploadedByUid === user?.uid
                      ? 'La subiste tú'
                      : `La subió ${partnerName}`}
                  </ThemedText>
                </View>
              </View>
            </View>
          </Pressable>
        ) : (
          <GlowCard>
            <Eyebrow>Lo último que visteis</Eyebrow>
            <ThemedText themeColor="textSecondary">Todavía no habéis subido nada</ThemedText>
          </GlowCard>
        )}

        {isLoading ? null : (
        <Pressable onPress={() => router.push('/chat')} className="active:opacity-80">
        <GlowCard>
          <Eyebrow>Lo último que os dijisteis</Eyebrow>
          {lastMessage ? (
            <>
              <View style={styles.authorRow}>
                <IdentityDot isMine={lastMessage.senderId === user?.uid} />
                <ThemedText type="small" themeColor="textSecondary">
                  {lastMessage.senderId === user?.uid ? myName : partnerName}
                </ThemedText>
              </View>
              <ThemedText style={styles.cardHeadline}>{lastMessage.text}</ThemedText>
            </>
          ) : (
            <ThemedText themeColor="textSecondary">Aún no os habéis escrito</ThemedText>
          )}

        </GlowCard>
        </Pressable>
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
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pressed: {
    opacity: 0.6,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  presenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  presenceGap: {
    width: Spacing.two,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  cardHeadline: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '600',
  },
  keyText: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: 8,
  },
  cardAction: {
    marginTop: Spacing.two,
  },
  photoCard: {
    height: 280,
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
    gap: Spacing.two,
    padding: Spacing.four,
  },
  quotaBlock: {
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  quotaBar: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  quotaTick: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  quotaTickSpent: {
    backgroundColor: theme.backgroundSelected,
  },
});
