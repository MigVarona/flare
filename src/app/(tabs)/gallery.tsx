import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Eyebrow, GhostButton, GlowCard, IdentityDot } from '@/components/brand';
import { ThemedText } from '@/components/themed-text';
import {
  BottomTabInset,
  Colors,
  glow,
  MaxContentWidth,
  neonBorder,
  Radius,
  Spacing,
} from '@/constants/theme';
import { useCouple } from '@/context/couple-context';
import { uploadPhotoToCloudinary } from '@/lib/cloudinary';
import { db } from '@/lib/firebase';

const theme = Colors.dark;

type Photo = {
  id: string;
  imageUrl: string;
  uploadedByUid: string;
};

export default function GalleryScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const { coupleId, user } = useCouple();

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isUploading, setIsUploading] = useState(false);

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
        })),
      );
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
    } finally {
      setIsUploading(false);
    }
  };

  const mine = photos.filter((photo) => photo.uploadedByUid === user?.uid).length;
  const theirs = photos.length - mine;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: safeAreaInsets.top + Spacing.four, paddingBottom: BottomTabInset + Spacing.five },
      ]}>
      <View style={styles.inner}>
        <View style={styles.header}>
          <Eyebrow>Lo que habéis visto</Eyebrow>
          <View style={styles.headerRow}>
            <ThemedText type="title" style={styles.title}>
              Fotos
            </ThemedText>
            <GhostButton
              title={isUploading ? 'Subiendo…' : 'Subir'}
              color={theme.you}
              disabled={isUploading}
              onPress={pickAndUploadPhoto}
            />
          </View>

          {photos.length > 0 && (
            <View style={styles.tallyRow}>
              <View style={styles.tally}>
                <IdentityDot isMine />
                <ThemedText type="small" themeColor="textSecondary">
                  {mine} tuyas
                </ThemedText>
              </View>
              <View style={styles.tally}>
                <IdentityDot isMine={false} />
                <ThemedText type="small" themeColor="textSecondary">
                  {theirs} suyas
                </ThemedText>
              </View>
            </View>
          )}
        </View>

        {photos.length === 0 ? (
          <GlowCard>
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              Aquí solo entra lo que subís vosotros dos. Todavía está vacío.
            </ThemedText>
          </GlowCard>
        ) : (
          <View style={styles.grid}>
            {photos.map((photo) => {
              const isMine = photo.uploadedByUid === user?.uid;
              const color = isMine ? theme.you : theme.partner;
              return (
                <View
                  key={photo.id}
                  style={[styles.photoFrame, neonBorder(color, 'BB'), glow(color, 16, '3A')]}>
                  <Image source={{ uri: photo.imageUrl }} style={styles.photo} />
                </View>
              );
            })}
          </View>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  tallyRow: {
    flexDirection: 'row',
    gap: Spacing.four,
    marginTop: Spacing.one,
  },
  tally: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  photoFrame: {
    width: '31.7%',
    aspectRatio: 1,
    borderRadius: Radius.medium,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  empty: {
    lineHeight: 22,
  },
});
