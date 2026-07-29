import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CloseGlyph } from '@/components/icons';
import { ThemedText } from '@/components/themed-text';
import { Modal, ModalBackdrop, ModalContent } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import { Colors, Spacing } from '@/constants/theme';
import {
  fetchGiphyGifs,
  getGiphyApiKey,
  type GiphyGif,
} from '@/lib/giphy';

const theme = Colors.dark;

export function GifPicker({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (gif: GiphyGif) => Promise<boolean>;
}) {
  const insets = useSafeAreaInsets();
  const requestId = useRef(0);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) return;
    setDraft('');
    setSearch('');
    setGifs([]);
    setNextOffset(null);
    setError(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const timeout = setTimeout(() => setSearch(draft.trim()), 350);
    return () => clearTimeout(timeout);
  }, [draft, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const currentRequest = ++requestId.current;
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    fetchGiphyGifs({ search, signal: controller.signal })
      .then((page) => {
        if (currentRequest !== requestId.current) return;
        setGifs(page.gifs);
        setNextOffset(page.nextOffset);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted || currentRequest !== requestId.current) return;
        setGifs([]);
        setNextOffset(null);
        setError(reason instanceof Error ? reason.message : 'No se han podido cargar los GIFs');
      })
      .finally(() => {
        if (currentRequest === requestId.current) setIsLoading(false);
      });

    return () => controller.abort();
  }, [isOpen, search]);

  const loadMore = async () => {
    if (nextOffset === null || isLoading || isLoadingMore) return;
    setIsLoadingMore(true);

    try {
      const page = await fetchGiphyGifs({ search, offset: nextOffset });
      setGifs((current) => [...current, ...page.gifs]);
      setNextOffset(page.nextOffset);
    } catch {
      // The current grid remains useful if only the next page fails.
    } finally {
      setIsLoadingMore(false);
    }
  };

  const selectGif = async (gif: GiphyGif) => {
    if (selectingId) return;
    setSelectingId(gif.giphyId);

    try {
      const sent = await onSelect(gif);
      if (sent) {
        onClose();
      }
    } finally {
      setSelectingId(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="full">
      <ModalBackdrop className="bg-background/95" />
      <ModalContent className="h-full rounded-none border-0 bg-background p-0 shadow-none">
        <View
          className="mx-auto h-full w-full max-w-200"
          style={{
            paddingTop: insets.top + Spacing[16],
            paddingBottom: insets.bottom + Spacing[16],
          }}
        >
          <View className="flex-row items-center justify-between px-6 pb-4">
            <View>
              <ThemedText type="title">GIF</ThemedText>
              <ThemedText type="small" className="text-muted-foreground">
                {search ? `Resultados para “${search}”` : 'Tendencias'}
              </ThemedText>
            </View>
            <Pressable
              accessibilityLabel="Cerrar GIFs"
              onPress={onClose}
              className="rounded-full border border-border bg-card p-3 active:bg-muted"
            >
              <CloseGlyph color={theme.text} />
            </Pressable>
          </View>

          <View className="px-6 pb-3">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              autoCorrect={false}
              autoCapitalize="none"
              maxLength={50}
              placeholder="Buscar en GIPHY"
              placeholderTextColor={theme.textSecondary}
              className="rounded-full border border-input bg-card px-5 py-4 text-base text-foreground"
            />
          </View>

          {!getGiphyApiKey() ? (
            <View className="flex-1 items-center justify-center px-8">
              <ThemedText type="headline" className="text-center">
                Falta conectar GIPHY
              </ThemedText>
              <ThemedText className="mt-2 text-center leading-6 text-muted-foreground">
                Añade EXPO_PUBLIC_GIPHY_API_KEY al entorno de la app.
              </ThemedText>
            </View>
          ) : isLoading ? (
            <View className="flex-1 items-center justify-center">
              <Spinner size="large" />
            </View>
          ) : error ? (
            <View className="flex-1 items-center justify-center px-8">
              <ThemedText type="headline" className="text-center">
                No han llegado los GIFs
              </ThemedText>
              <ThemedText className="mt-2 text-center leading-6 text-muted-foreground">
                {error}
              </ThemedText>
            </View>
          ) : gifs.length === 0 ? (
            <View className="flex-1 items-center justify-center px-8">
              <ThemedText className="text-center text-muted-foreground">
                No hay resultados para esa búsqueda.
              </ThemedText>
            </View>
          ) : (
            // A virtualized native list matters here: every visible cell is animated media.
            <FlatList
              data={gifs}
              numColumns={2}
              keyExtractor={(gif) => gif.giphyId}
              keyboardShouldPersistTaps="handled"
              onEndReached={loadMore}
              onEndReachedThreshold={0.5}
              contentContainerStyle={{ paddingHorizontal: Spacing[20], paddingBottom: Spacing[16] }}
              renderItem={({ item }) => (
                <View className="w-1/2 p-1">
                  <Pressable
                    accessibilityLabel={`Enviar ${item.altText}`}
                    disabled={Boolean(selectingId)}
                    onPress={() => selectGif(item)}
                    className="h-36 overflow-hidden rounded-2xl border border-border bg-card active:border-accent"
                  >
                    <Image
                      source={{ uri: item.previewUrl }}
                      alt={item.altText}
                      autoplay
                      cachePolicy="none"
                      contentFit="cover"
                      style={{ width: '100%', height: '100%' }}
                    />
                    {item.username ? (
                      <View className="absolute bottom-1 left-1 max-w-32 rounded-full bg-background/80 px-2 py-1">
                        <ThemedText
                          type="small"
                          numberOfLines={1}
                          ellipsizeMode="tail"
                          className="text-foreground"
                        >
                          @{item.username}
                        </ThemedText>
                      </View>
                    ) : null}
                    {selectingId === item.giphyId && (
                      <View className="absolute inset-0 items-center justify-center bg-background/70">
                        <Spinner />
                      </View>
                    )}
                  </Pressable>
                </View>
              )}
              ListFooterComponent={
                isLoadingMore ? (
                  <View className="items-center py-4">
                    <Spinner />
                  </View>
                ) : null
              }
            />
          )}

          <View className="items-center pt-2">
            <Image
              source={require('../../assets/images/powered-by-giphy.png')}
              alt="Powered by GIPHY"
              contentFit="contain"
              style={{ width: 100, height: 21 }}
            />
          </View>
        </View>
      </ModalContent>
    </Modal>
  );
}
