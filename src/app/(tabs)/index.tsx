import { router } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from '@react-native-firebase/firestore';
import { useEffect, useRef, useState } from 'react';
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
import { BrandLockup, Eyebrow, GlowCard } from '@/components/brand';
import { CalendarGlyph, ChevronGlyph, SettingsGlyph } from '@/components/icons';
import { SpaceSwitcherMenu, type SwitcherAnchor } from '@/components/space-switcher-menu';
import { CardSkeletons } from '@/components/loading';
import { ThemedText } from '@/components/themed-text';
import { Spinner } from '@/components/ui/spinner';
import {
  BottomTabInset,
  Colors,
  MaxContentWidth,
  glow,
  neonBorder,
  Radius,
  Spacing,
} from '@/constants/theme';
import { useSpace } from '@/context/space-context';
import { useNotice } from '@/hooks/use-notice';
import { usePalette } from '@/hooks/use-palette';
import { uploadFileToCloudinary } from '@/lib/cloudinary';
import { db } from '@/lib/firebase';
import { sendPushNotification } from '@/lib/push';

const theme = Colors.dark;

type Reminder = {
  id: string;
  title: string;
  dueLabel: string;
  dueAt: Date | null;
  createdByUid?: string;
};
type Message = { id: string; text: string; senderId: string; createdAt: Date | null };
type HomePhoto = {
  id: string;
  imageUrl: string;
  uploadedByUid: string;
  kind: 'image' | 'document';
  fileName?: string;
};

/** "contrato-alquiler.pdf" → "PDF" — all this small a thumbnail can hold. */
function fileFormat(fileName: string | undefined) {
  const extension = fileName?.split('.').pop();
  return extension ? extension.toUpperCase() : 'DOC';
}

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

export default function HomeScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user, spaceId, space, members, otherMembers, isAlone, inviteCode, myName } = useSpace();
  const notice = useNotice();
  const palette = usePalette();

  const [pendingReminders, setPendingReminders] = useState<Reminder[]>([]);
  const [activeReminderIndex, setActiveReminderIndex] = useState(0);
  const [recentMessages, setRecentMessages] = useState<Message[]>([]);
  const [recentPhotos, setRecentPhotos] = useState<HomePhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [switcherAnchor, setSwitcherAnchor] = useState<SwitcherAnchor | null>(null);
  const spaceSwitcherRef = useRef<View>(null);

  // Anchored to the pill itself, measured on open — not guessed from a fixed offset, which
  // would drift the moment the header's layout changes on some device this wasn't tried on.
  const openSwitcher = () => {
    spaceSwitcherRef.current?.measureInWindow((x, viewportY, measuredWidth, measuredHeight) => {
      setSwitcherAnchor({
        top: viewportY + measuredHeight + Spacing[8],
        right: width - (x + measuredWidth),
      });
      setIsSwitcherOpen(true);
    });
  };

  const reminderCardWidth = Math.min(MaxContentWidth - Spacing[48], width - Spacing[48]);
  const reminderSnapWidth = reminderCardWidth + Spacing[12];
  const photoItemSize = Math.max(
    56,
    Math.min(68, Math.floor((reminderCardWidth - Spacing[24] - Spacing[8] * 3) / 4)),
  );

  useEffect(() => {
    if (!spaceId) return undefined;
    const remindersQuery = query(
      collection(db, 'spaces', spaceId, 'reminders'),
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
  }, [spaceId]);

  useEffect(() => {
    if (!spaceId) return undefined;
    const messagesQuery = query(
      collection(db, 'spaces', spaceId, 'messages'),
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
  }, [spaceId]);

  useEffect(() => {
    if (!spaceId) return undefined;
    const photosQuery = query(
      collection(db, 'spaces', spaceId, 'photos'),
      orderBy('createdAt', 'desc'),
      limit(8),
    );
    return onSnapshot(photosQuery, (snapshot) => {
      setRecentPhotos(
        snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data();

          return {
            id: docSnapshot.id,
            imageUrl: data.imageUrl as string,
            uploadedByUid: data.uploadedByUid as string,
            kind: (data.kind as 'image' | 'document' | undefined) ?? 'image',
            fileName: data.fileName as string | undefined,
          };
        }),
      );
    });
  }, [spaceId]);

  const colorForUid = (uid?: string) => palette.colorFor(uid);

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
      `&details=${encodeURIComponent('Aviso de Flare')}`;

    try {
      await Linking.openURL(url);
    } catch {
      router.push('/reminders');
    }
  }

  async function pickAndUploadPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (result.canceled || !spaceId || !user) return;

    setIsUploadingPhoto(true);
    try {
      const uploadedPhoto = await uploadFileToCloudinary(result.assets[0].uri, spaceId, 'image');
      await addDoc(collection(db, 'spaces', spaceId, 'photos'), {
        imageUrl: uploadedPhoto.imageUrl,
        cloudinaryPublicId: uploadedPhoto.publicId,
        uploadedByUid: user.uid,
        kind: 'image',
        createdAt: serverTimestamp(),
      });

      for (const member of otherMembers) {
        sendPushNotification(
          spaceId,
          member.uid,
          'Foto nueva',
          `${myName} ha subido una foto`,
          '/archive',
        ).then((ok) => {
          if (!ok) notice('No hemos podido avisar a todos');
        });
      }
    } catch {
      notice('No se ha podido subir');
    } finally {
      setIsUploadingPhoto(false);
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
            <BrandLockup size={42} />
            <View style={styles.headerLinks}>
              {/* The current space, not a label about it — a filled pill with a chevron
                  reads as a control you tap to change, the way a small caps label sitting
                  next to "Ajustes" never did: the two looked like the same kind of thing. */}
              <Pressable
                ref={spaceSwitcherRef}
                onPress={openSwitcher}
                style={({ pressed }) => [styles.spaceSwitcher, pressed && styles.pressed]}>
                <ThemedText type="smallBold" numberOfLines={1} style={styles.spaceSwitcherText}>
                  {space?.kind === 'personal' ? 'Personal' : (space?.name ?? 'Espacios')}
                </ThemedText>
                <ChevronGlyph color={theme.textSecondary} size={12} />
              </Pressable>
              <Pressable
                onPress={() => router.push('/settings')}
                hitSlop={8}
                style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]}>
                <SettingsGlyph color={theme.textSecondary} size={18} />
              </Pressable>
            </View>
          </View>
          {/* Everyone in the space, each with their light. Alone in your personal space this
              is simply you — one light is a complete state, not a waiting room. */}
          <View style={styles.presenceRow}>
            {members.map((member) => (
              <View key={member.uid} style={styles.presenceMember}>
                <View
                  style={[
                    styles.presenceDot,
                    { backgroundColor: palette.colorFor(member.uid) },
                    glow(palette.colorFor(member.uid), 10, '66'),
                  ]}
                />
                <ThemedText type="small" themeColor="textSecondary">
                  {member.uid === user?.uid ? myName : member.name}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>

        {/* A waiting state, not an achievement — it shouldn't out-shout Avisos for it. The
            full-size key belongs to the screen where cutting it is the entire point
            (spaces.tsx); here it's a quiet reminder that something's still pending. */}
        {space?.kind === 'shared' && isAlone && inviteCode && (
          <Pressable
            onPress={() =>
              Share.share({ message: `Esta es la llave de nuestro espacio en Flare: ${inviteCode}` })
            }
            style={({ pressed }) => [styles.inviteRow, pressed && styles.pressed]}>
            <View style={styles.inviteRowText}>
              <ThemedText type="small" themeColor="textSecondary">
                Llave de acceso
              </ThemedText>
              <ThemedText type="smallBold" selectable style={styles.inviteRowCode}>
                {inviteCode}
              </ThemedText>
            </View>
            <ThemedText type="smallBold" style={{ color: palette.accent }}>
              Compartir
            </ThemedText>
          </Pressable>
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
                            <CalendarGlyph color={theme.textSecondary} size={24} />
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
          <Pressable onPress={() => router.push('/archive')} className="active:opacity-80">
            <View style={styles.section}>
              <View style={styles.photoHeader}>
                <View style={styles.photoTitleBlock}>
                  <ThemedText type="headline" style={styles.sectionTitle}>
                    Archivo
                  </ThemedText>
                  <View style={styles.photoIdentityRow}>
                    {members.map((member) => (
                      <View
                        key={member.uid}
                        style={[
                          styles.photoIdentityDot,
                          { backgroundColor: palette.colorFor(member.uid) },
                        ]}
                      />
                    ))}
                  </View>
                </View>
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    void pickAndUploadPhoto();
                  }}
                  disabled={isUploadingPhoto}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Subir foto"
                  style={({ pressed }) => [
                    styles.photoAddButton,
                    pressed && styles.pressed,
                    isUploadingPhoto && styles.disabled,
                  ]}>
                  {isUploadingPhoto ? (
                    <Spinner color={theme.textSecondary} />
                  ) : (
                    <ThemedText type="headline" style={styles.photoAddText}>
                      +
                    </ThemedText>
                  )}
                </Pressable>
              </View>

              {recentPhotos.length > 0 ? (
                <View style={styles.photoPreviewCard}>
                  {recentPhotos.slice(0, 3).map((photo) => {
                    const photoColor = colorForUid(photo.uploadedByUid);

                    return (
                      <View
                        key={photo.id}
                        style={[
                          styles.photoThumb,
                          { width: photoItemSize, height: photoItemSize },
                          neonBorder(photoColor, '66'),
                          glow(photoColor, 12, '33'),
                        ]}>
                        {photo.kind === 'document' ? (
                          <View
                            style={[
                              styles.photoImage,
                              { alignItems: 'center', justifyContent: 'center' },
                            ]}>
                            <ThemedText type="smallBold" style={{ color: photoColor }}>
                              {fileFormat(photo.fileName)}
                            </ThemedText>
                          </View>
                        ) : (
                          <Image
                            source={{ uri: photo.imageUrl }}
                            style={styles.photoImage}
                            contentFit="cover"
                          />
                        )}
                      </View>
                    );
                  })}
                  {recentPhotos.length > 3 && (
                    <View
                      style={[
                        styles.photoMore,
                        { width: photoItemSize, height: photoItemSize },
                      ]}>
                      <ThemedText type="smallBold" style={styles.photoMoreText}>
                        +{recentPhotos.length - 3}
                      </ThemedText>
                    </View>
                  )}
                </View>
              ) : (
                <GlowCard style={styles.emptyCard}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Todavía no habéis subido ninguna.
                  </ThemedText>
                </GlowCard>
              )}
            </View>
          </Pressable>
        )}

        {!isLoading && (
          <Pressable onPress={() => router.push('/board')} className="active:opacity-80">
            <View style={styles.section}>
              <ThemedText type="headline" style={styles.sectionTitle}>
                Tablón
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
                    Todavía nada. El primero sigue libre.
                  </ThemedText>
                </GlowCard>
              )}
            </View>
          </Pressable>
        )}
      </View>
    </Animated.ScrollView>
      <SpaceSwitcherMenu
        isOpen={isSwitcherOpen}
        anchor={switcherAnchor}
        onClose={() => setIsSwitcherOpen(false)}
      />
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
    gap: Spacing[16],
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
  disabled: {
    opacity: 0.45,
  },
  presenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing[12],
  },
  presenceMember: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[8],
  },
  presenceDot: {
    width: 12,
    height: 12,
    borderRadius: Radius.pill,
  },
  headerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[8],
  },
  spaceSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[4],
    maxWidth: 150,
    paddingVertical: Spacing[8],
    paddingHorizontal: Spacing[12],
    borderRadius: Radius.pill,
    backgroundColor: theme.backgroundElement,
  },
  spaceSwitcherText: {
    flexShrink: 1,
  },
  settingsButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    backgroundColor: theme.backgroundElement,
  },
  photoIdentityDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
  },
  cardAction: {
    marginTop: Spacing[8],
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing[12],
    paddingVertical: Spacing[12],
    paddingHorizontal: Spacing[16],
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.backgroundElement,
  },
  inviteRowText: {
    flex: 1,
    gap: Spacing[2],
  },
  inviteRowCode: {
    letterSpacing: 3,
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
  photoHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  photoTitleBlock: {
    gap: Spacing[4],
  },
  photoIdentityRow: {
    flexDirection: 'row',
    gap: Spacing[8],
  },
  photoAddButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    backgroundColor: theme.backgroundSelected,
    ...neonBorder(theme.border, 'FF'),
  },
  photoAddText: {
    color: theme.textSecondary,
    lineHeight: 26,
    transform: [{ translateY: -1 }],
  },
  // No enclosing box on purpose — the full Archivo screen doesn't wrap its grid in one
  // either. A fixed-width card behind a variable number of thumbnails just leaves dead
  // space next to the pile whenever it's a photo or two shy of full.
  photoPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[8],
  },
  photoThumb: {
    overflow: 'hidden',
    borderRadius: Radius.small,
    backgroundColor: theme.backgroundSelected,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoMore: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.medium,
    backgroundColor: theme.backgroundSelected,
    ...neonBorder(theme.border, 'FF'),
  },
  photoMoreText: {
    color: theme.text,
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
    width: 11,
    height: 11,
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
    width: 40,
    height: 40,
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
