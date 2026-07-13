import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
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
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LinearGradient } from 'expo-linear-gradient';

import { Eyebrow, GlowCard, IdentityDot } from '@/components/brand';
import { LightSignal, isSignalId, type SignalId } from '@/components/light-signals';
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
import { useCouple } from '@/context/couple-context';
import { useNotice } from '@/hooks/use-notice';
import { usePalette } from '@/hooks/use-palette';
import { uploadPhotoToCloudinary } from '@/lib/cloudinary';
import { db } from '@/lib/firebase';
import { sendPushNotification } from '@/lib/push';

const theme = Colors.dark;

type Photo = {
  id: string;
  imageUrl: string;
  uploadedByUid: string;
  reactions: Record<string, SignalId>;
};

export default function GalleryScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { coupleId, user, partnerUid, partnerName, myName } = useCouple();
  const notice = useNotice();
  const palette = usePalette();

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [viewing, setViewing] = useState<Photo | null>(null);
  const [actingOn, setActingOn] = useState<Photo | null>(null);
  const [reactingTo, setReactingTo] = useState<Photo | null>(null);

  useEffect(() => {
    if (!coupleId) return undefined;
    const photosQuery = query(
      collection(db, 'couples', coupleId, 'photos'),
      orderBy('createdAt', 'desc'),
    );
    return onSnapshot(photosQuery, (snapshot) => {
      setPhotos(
        snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          imageUrl: docSnapshot.data().imageUrl as string,
          uploadedByUid: docSnapshot.data().uploadedByUid as string,
          reactions: (docSnapshot.data().reactions as Record<string, SignalId>) ?? {},
        })),
      );
      setIsLoading(false);
    });
  }, [coupleId]);

  const pickAndUploadPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (result.canceled || !coupleId || !user) return;

    setIsUploading(true);
    try {
      const imageUrl = await uploadPhotoToCloudinary(result.assets[0].uri);
      await addDoc(collection(db, 'couples', coupleId, 'photos'), {
        imageUrl,
        uploadedByUid: user.uid,
        createdAt: serverTimestamp(),
      });
      notice('Ya la puede ver');

      if (partnerUid) {
        const partnerSnapshot = await getDoc(doc(db, 'users', partnerUid));
        const partnerToken = partnerSnapshot.data()?.expoPushToken as string | undefined;
        if (partnerToken) {
          sendPushNotification(partnerToken, 'Foto nueva', `${myName} ha subido una foto`);
        }
      }
    } catch {
      notice('No se pudo subir', 'both');
    } finally {
      setIsUploading(false);
    }
  };

  const react = async (photo: Photo, signal: SignalId | null) => {
    if (!coupleId || !user) return;
    setReactingTo(null);
    await updateDoc(doc(db, 'couples', coupleId, 'photos', photo.id), {
      [`reactions.${user.uid}`]: signal ?? deleteField(),
    });
  };

  const deletePhoto = async (photo: Photo) => {
    if (!coupleId) return;
    setActingOn(null);
    setViewing(null);
    await deleteDoc(doc(db, 'couples', coupleId, 'photos', photo.id));
    notice('Borrada');
  };

  const mine = photos.filter((photo) => photo.uploadedByUid === user?.uid).length;
  const theirs = photos.length - mine;

  // Two columns, edge to edge: the photos are the screen, not decoration inside a card.
  const gutter = Spacing.two;
  const columnWidth = (width - Spacing.four * 2 - gutter) / 2;

  return (
    <>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{
          paddingTop: insets.top + Spacing.four,
          paddingBottom: BottomTabInset + Spacing.five,
        }}>
        <View className="gap-3 px-6">
          <View className="mb-2 gap-2">
            <Eyebrow>Lo que habéis visto</Eyebrow>
            <ThemedText
              type="title"
              className="text-[34px] leading-10 font-extrabold tracking-tight">
              Fotos
            </ThemedText>

            {photos.length > 0 && (
              <View className="mt-1 flex-row gap-6">
                <View className="flex-row items-center gap-2">
                  <IdentityDot isMine />
                  <ThemedText type="small" className="text-muted-foreground">
                    {mine} tuyas
                  </ThemedText>
                </View>
                <View className="flex-row items-center gap-2">
                  <IdentityDot isMine={false} />
                  <ThemedText type="small" className="text-muted-foreground">
                    {theirs} de {partnerName}
                  </ThemedText>
                </View>
              </View>
            )}
          </View>

          {isLoading ? (
            <PhotoGridSkeleton />
          ) : photos.length === 0 ? (
            <GlowCard>
              <ThemedText className="leading-6 text-muted-foreground">
                Aquí solo entra lo que subís vosotros dos. Todavía está vacío.
              </ThemedText>
            </GlowCard>
          ) : (
            <View className="flex-row gap-2">
              {[0, 1].map((column) => (
                <View key={column} className="flex-1 gap-2">
                  {photos
                    .filter((_, index) => index % 2 === column)
                    .map((photo, indexInColumn) => {
                      const isMine = photo.uploadedByUid === user?.uid;
                      const color = isMine ? palette.you : palette.partner;
                      // Alternating heights give the grid a rhythm instead of a rigid checkerboard.
                      const height =
                        columnWidth * ((indexInColumn + column) % 2 === 0 ? 1.35 : 1);

                      const signals = Object.entries(photo.reactions);

                      // One tap opens it, two answer with light, holding it down deletes
                      // your own. Double tap wins over single so it doesn't open first.
                      const open = Gesture.Tap()
                        .numberOfTaps(1)
                        .onEnd(() => scheduleOnRN(setViewing, photo));
                      const answer = Gesture.Tap()
                        .numberOfTaps(2)
                        .onEnd(() => scheduleOnRN(setReactingTo, photo));
                      const remove = Gesture.LongPress().onStart(() => {
                        if (isMine) scheduleOnRN(setActingOn, photo);
                      });
                      const gesture = Gesture.Exclusive(remove, answer, open);

                      return (
                        <GestureDetector key={photo.id} gesture={gesture}>
                          <View
                            className="overflow-hidden rounded-3xl"
                            style={[{ height }, neonBorder(color, 'BB'), glow(color, 16, '3A')]}>
                            <Image
                              source={{ uri: photo.imageUrl }}
                              style={{ width: '100%', height: '100%' }}
                              contentFit="cover"
                            />

                            {signals.length > 0 && (
                              <View className="absolute right-2 bottom-2 flex-row gap-1.5 rounded-full bg-background/70 px-2 py-1.5">
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
                          </View>
                        </GestureDetector>
                      );
                    })}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <Fab
        onPress={pickAndUploadPhoto}
        isDisabled={isUploading}
        placement="bottom right"
        className="overflow-hidden rounded-full p-0"
        style={[{ bottom: BottomTabInset + Spacing.four }, glow(palette.accent, 24, '77')]}>
        <LinearGradient
          colors={palette.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: Spacing.four, paddingVertical: Spacing.three }}>
          {isUploading ? (
            <Spinner color={theme.background} />
          ) : (
            <ThemedText className="font-extrabold" style={{ color: theme.background }}>
              Subir
            </ThemedText>
          )}
        </LinearGradient>
      </Fab>

      <Modal isOpen={Boolean(viewing)} onClose={() => setViewing(null)} size="full">
        <ModalBackdrop />
        <ModalContent className="border-0 bg-transparent shadow-none">
          <Pressable className="flex-1 items-center justify-center" onPress={() => setViewing(null)}>
            {viewing && (
              <Image
                source={{ uri: viewing.imageUrl }}
                style={{ width: '100%', height: '80%' }}
                contentFit="contain"
              />
            )}
          </Pressable>
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
          <ActionsheetItem onPress={() => actingOn && deletePhoto(actingOn)}>
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
