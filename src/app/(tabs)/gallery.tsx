import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import {
  addDoc,
  collection,
  deleteField,
  doc,
  onSnapshot,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LinearGradient } from 'expo-linear-gradient';

import { Eyebrow, GhostButton, GlowCard, ScreenHeader } from '@/components/brand';
import Svg, { Path } from 'react-native-svg';

import { LightSignal, isSignalId, useSignalMeaning, type SignalId } from '@/components/light-signals';
import { PhotoGridSkeleton } from '@/components/loading';
import { SignalPicker } from '@/components/signal-picker';
import { ThemedText } from '@/components/themed-text';
import { Fab } from '@/components/ui/fab';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetItem,
  ActionsheetItemText,
} from '@/components/ui/actionsheet';
import { Modal, ModalBackdrop, ModalContent } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import { BottomTabInset, Colors, glow, neonBorder, Spacing } from '@/constants/theme';
import { useSpace } from '@/context/space-context';
import { useNotice } from '@/hooks/use-notice';
import { usePalette } from '@/hooks/use-palette';
import { deletePhoto, uploadPhotoToCloudinary } from '@/lib/cloudinary';
import { db } from '@/lib/firebase';
import { sendPushNotification } from '@/lib/push';

const theme = Colors.dark;

/** How many photos arrive at a time. Enough to fill the screen twice over. */
const PageSize = 30;

type Photo = {
  id: string;
  imageUrl: string;
  cloudinaryPublicId?: string;
  uploadedByUid: string;
  reactions: Record<string, SignalId>;
};

export default function GalleryScreen() {
  const insets = useSafeAreaInsets();
  const { width, height: screenHeight } = useWindowDimensions();
  const { spaceId, user, otherMembers, myName, isAlone } = useSpace();
  const notice = useNotice();
  const palette = usePalette();
  const showSignalMeaning = useSignalMeaning();

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [viewing, setViewing] = useState<Photo | null>(null);
  const [actingOn, setActingOn] = useState<Photo | null>(null);
  const [reactingTo, setReactingTo] = useState<Photo | null>(null);
  /**
   * How far back we're looking. The whole album used to arrive at once, which is fine with
   * twenty photos and a slow, expensive way to open the screen with five hundred.
   */
  const [pageSize, setPageSize] = useState(PageSize);

  useEffect(() => {
    if (!spaceId) return undefined;
    const photosQuery = query(
      collection(db, 'spaces', spaceId, 'photos'),
      orderBy('createdAt', 'desc'),
      limit(pageSize),
    );
    return onSnapshot(photosQuery, (snapshot) => {
      setPhotos(
        snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          imageUrl: docSnapshot.data().imageUrl as string,
          cloudinaryPublicId: docSnapshot.data().cloudinaryPublicId as string | undefined,
          uploadedByUid: docSnapshot.data().uploadedByUid as string,
          reactions: (docSnapshot.data().reactions as Record<string, SignalId>) ?? {},
        })),
      );
      setIsLoading(false);
    });
  }, [spaceId, pageSize]);

  const pickAndUploadPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (result.canceled || !spaceId || !user) return;

    setIsUploading(true);
    try {
      const uploadedPhoto = await uploadPhotoToCloudinary(result.assets[0].uri, spaceId);
      await addDoc(collection(db, 'spaces', spaceId, 'photos'), {
        imageUrl: uploadedPhoto.imageUrl,
        cloudinaryPublicId: uploadedPhoto.publicId,
        uploadedByUid: user.uid,
        createdAt: serverTimestamp(),
      });

      for (const member of otherMembers) {
        sendPushNotification(spaceId, member.uid, 'Foto nueva', `${myName} ha subido una foto`, '/gallery').then(
          (ok) => {
            if (!ok) notice('No hemos podido avisar a todos');
          },
        );
      }
    } catch {
      notice('No se ha podido subir');
    } finally {
      setIsUploading(false);
    }
  };

  const react = async (photo: Photo, signal: SignalId | null) => {
    if (!spaceId || !user) return;
    setReactingTo(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await updateDoc(doc(db, 'spaces', spaceId, 'photos', photo.id), {
      [`reactions.${user.uid}`]: signal ?? deleteField(),
    });
  };

  const removePhoto = async (photo: Photo) => {
    if (!spaceId) return;
    setActingOn(null);
    setViewing(null);
    try {
      // The Worker takes down the file and then the record. Deleting the record from here
      // would only forget where the photo was: the image itself would stay up for good.
      await deletePhoto(spaceId, photo.id);
    } catch {
      notice('No se ha podido borrar');
    }
  };

  const mine = photos.filter((photo) => photo.uploadedByUid === user?.uid).length;
  const theirs = photos.length - mine;

  // The newest photos light the room, each in the colour of whoever brought it. Scroll down
  // and the light changes hands, because further back it was a different one of you looking.

  // Two columns, edge to edge: the photos are the screen, not decoration inside a card.
  const gutter = Spacing[8];
  const columnWidth = (width - Spacing[24] * 2 - gutter) / 2;
  const viewingIsMine = viewing?.uploadedByUid === user?.uid;

  return (
    <>

      <Animated.ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + Spacing[24],
          paddingBottom: BottomTabInset + Spacing[32],
        }}>
        <View className="gap-4 px-6">
          <View>
            <ScreenHeader title="Fotos" />

            {/* The header already carries the two lights, so repeating them here would be
                the third time this screen says "there are two of you". The count says whose
                by being written in their colour — which is the whole rule of the app. */}
            {photos.length > 0 && (
              <View className="mt-1 flex-row gap-6">
                <ThemedText type="small" style={{ color: palette.you }}>
                  {mine} tuyas
                </ThemedText>
                {!isAlone && (
                  <ThemedText type="small" style={{ color: palette.partner }}>
                    {theirs} {otherMembers.length === 1 ? `de ${otherMembers[0].name}` : 'de los demás'}
                  </ThemedText>
                )}
              </View>
            )}
          </View>

          {isLoading ? (
            <PhotoGridSkeleton />
          ) : photos.length === 0 ? (
            <GlowCard>
              <ThemedText className="leading-6 text-muted-foreground">
                {isAlone ? 'Todavía no has subido ninguna.' : 'Todavía no habéis subido ninguna.'}
              </ThemedText>
            </GlowCard>
          ) : (
            <View className="flex-row gap-2">
              {[0, 1].map((column) => (
                <View key={column} className="flex-1 gap-2">
                  {photos
                    .filter((_, index) => index % 2 === column)
                    .map((photo, indexInColumn) => {
                      const color = palette.colorFor(photo.uploadedByUid);
                      // Alternating heights give the grid a rhythm instead of a rigid checkerboard.
                      const height =
                        columnWidth * ((indexInColumn + column) % 2 === 0 ? 1.35 : 1);

                      const signals = Object.entries(photo.reactions);

                      // One tap opens it; holding it down answers with light. Deleting your
                      // own photos still lives in the full-screen view.
                      const open = Gesture.Tap()
                        .numberOfTaps(1)
                        .onEnd(() => scheduleOnRN(setViewing, photo));
                      const answer = Gesture.LongPress()
                        .minDuration(350)
                        .onStart(() => scheduleOnRN(setReactingTo, photo));
                      const gesture = Gesture.Exclusive(answer, open);

                      return (
                        <GestureDetector key={photo.id} gesture={gesture}>
                          <View
                            className="overflow-hidden rounded-3xl"
                            style={[{ height }, neonBorder(color, 'BB')]}>
                            <Image
                              source={{ uri: photo.imageUrl }}
                              style={{ width: '100%', height: '100%' }}
                              contentFit="cover"
                            />

                            {signals.length > 0 && (
                              <View className="absolute right-2 bottom-2 flex-row gap-1.5 rounded-full bg-background/70 px-2 py-1.5">
                                {signals.map(([uid, signal]) =>
                                  isSignalId(signal) ? (
                                    <GestureDetector
                                      key={uid}
                                      gesture={Gesture.Tap().onEnd(() =>
                                        scheduleOnRN(showSignalMeaning, signal),
                                      )}>
                                      <LightSignal
                                        id={signal}
                                        color={palette.colorFor(uid)}
                                        size={16}
                                      />
                                    </GestureDetector>
                                  ) : null,
                                )}
                              </View>
                            )}
                          </View>
                        </GestureDetector>
                      );
                    })}
                </View>
              ))}
            </View>
          )}

          {/* A full page means there is probably more behind it. Asking for it is a choice,
              not something the screen does on its own while you scroll. */}
          {photos.length >= pageSize && (
            <View className="mt-4">
              <GhostButton title="Ver más" onPress={() => setPageSize(pageSize + PageSize)} />
            </View>
          )}
        </View>
      </Animated.ScrollView>

      <Fab
        onPress={pickAndUploadPhoto}
        isDisabled={isUploading}
        placement="bottom right"
        className="overflow-hidden rounded-full p-0"
        style={[{ bottom: BottomTabInset + Spacing[24] }, glow(palette.accent, 24, '77')]}>
        {/* A cross, not the word "Subir". The gesture is add-something, and every phone on
            earth has already taught its owner what a plus does — spelling it out is explaining
            a door handle. It's also wider than it is tall on purpose: a pill reads as a button,
            a circle reads as a camera shutter. */}
        <LinearGradient
          colors={palette.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingHorizontal: Spacing[32],
            paddingVertical: Spacing[16],
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {isUploading ? (
            <Spinner color={theme.background} />
          ) : (
            <Svg width={22} height={22} viewBox="0 0 22 22">
              <Path
                d="M11 4v14M4 11h14"
                stroke={theme.background}
                strokeWidth={2.6}
                strokeLinecap="round"
              />
            </Svg>
          )}
        </LinearGradient>
      </Fab>

      <Modal isOpen={Boolean(viewing)} onClose={() => setViewing(null)} size="full">
        <ModalBackdrop className="bg-background/95" />
        <ModalContent
          className="h-full rounded-none border-0 bg-transparent p-0 shadow-none"
          style={{ height: screenHeight }}>
          <View
            className="h-full w-full items-center justify-center"
            style={{
              paddingTop: insets.top + Spacing[16],
              paddingBottom: insets.bottom + Spacing[16],
              paddingHorizontal: Spacing[8],
            }}>
            {viewing && (
              <Image
                source={{ uri: viewing.imageUrl }}
                style={{ width: '100%', height: '100%' }}
                contentFit="contain"
              />
            )}
            <View
              className="absolute left-0 right-0 flex-row items-center justify-between px-6"
              style={{ top: insets.top + Spacing[16] }}>
              <Pressable
                onPress={() => setViewing(null)}
                className="rounded-full border border-border bg-background/80 px-4 py-3 active:opacity-70">
                <ThemedText type="smallBold">Cerrar</ThemedText>
              </Pressable>
              {viewingIsMine && viewing && (
                <Pressable onPress={() => setActingOn(viewing)} hitSlop={12}>
                  <ThemedText type="small" className="text-destructive">
                    Borrar
                  </ThemedText>
                </Pressable>
              )}
            </View>
          </View>
        </ModalContent>
      </Modal>

      <SignalPicker
        isOpen={Boolean(reactingTo)}
        current={reactingTo && user ? reactingTo.reactions[user.uid] : null}
        onPick={(signal) => reactingTo && react(reactingTo, signal)}
        onClose={() => setReactingTo(null)}
      />

      <Actionsheet isOpen={Boolean(actingOn)} onClose={() => setActingOn(null)}>
        <ActionsheetBackdrop />
        <ActionsheetContent>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <ActionsheetItem onPress={() => actingOn && removePhoto(actingOn)}>
            <ActionsheetItemText className="text-destructive">Borrar foto</ActionsheetItemText>
          </ActionsheetItem>
          <ActionsheetItem onPress={() => setActingOn(null)}>
            <ActionsheetItemText>Cancelar</ActionsheetItemText>
          </ActionsheetItem>
        </ActionsheetContent>
      </Actionsheet>
    </>
  );
}
