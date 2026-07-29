import { Platform } from 'react-native';

const GIPHY_API_BASE = 'https://api.giphy.com/v1';
const PAGE_SIZE = 24;

export type GifMessage = {
  giphyId: string;
  sourceUrl: string;
  title: string;
  altText: string;
  username: string;
  width: number;
  height: number;
};

export type GiphyGif = GifMessage & {
  mediaUrl: string;
  previewUrl: string;
};

type GiphyRendition = {
  url?: string;
  webp?: string;
  width?: string;
  height?: string;
};

type GiphyApiGif = {
  id?: string;
  title?: string;
  alt_text?: string;
  username?: string;
  url?: string;
  user?: {
    display_name?: string;
  };
  images?: {
    original?: GiphyRendition;
    fixed_width?: GiphyRendition;
    fixed_width_small?: GiphyRendition;
  };
};

type GiphyResponse = {
  data?: GiphyApiGif[];
  pagination?: {
    count?: number;
    offset?: number;
    total_count?: number;
  };
  meta?: {
    status?: number;
    msg?: string;
  };
};

export type GiphyPage = {
  gifs: GiphyGif[];
  nextOffset: number | null;
};

/**
 * Expo only inlines EXPO_PUBLIC variables when accessed directly. Platform-specific keys
 * satisfy GIPHY's production requirement, while the shared key keeps local setup simple.
 */
export function getGiphyApiKey() {
  const platformKey = Platform.select({
    ios: process.env.EXPO_PUBLIC_GIPHY_IOS_API_KEY,
    android: process.env.EXPO_PUBLIC_GIPHY_ANDROID_API_KEY,
    web: process.env.EXPO_PUBLIC_GIPHY_WEB_API_KEY,
  });

  return platformKey || process.env.EXPO_PUBLIC_GIPHY_API_KEY || '';
}

function parseDimension(value: string | undefined) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 320;
}

function cleanText(value: string | undefined, fallback: string, max: number) {
  return (value?.trim() || fallback).slice(0, max);
}

function readGif(item: GiphyApiGif): GiphyGif | null {
  const original = item.images?.original;
  const preview = item.images?.fixed_width_small ?? item.images?.fixed_width ?? original;
  const url = original?.webp || original?.url;
  const previewUrl = preview?.webp || preview?.url;

  if (!item.id || !url || !previewUrl || !item.url) return null;

  const title = cleanText(item.title, 'GIF de GIPHY', 200);

  return {
    giphyId: item.id,
    mediaUrl: url,
    previewUrl,
    sourceUrl: item.url,
    title,
    altText: cleanText(item.alt_text, title, 500),
    username: cleanText(item.user?.display_name || item.username, '', 100),
    width: parseDimension(original?.width ?? preview?.width),
    height: parseDimension(original?.height ?? preview?.height),
  };
}

export async function fetchGiphyGifs({
  search,
  offset = 0,
  signal,
}: {
  search: string;
  offset?: number;
  signal?: AbortSignal;
}): Promise<GiphyPage> {
  const apiKey = getGiphyApiKey();
  if (!apiKey) {
    throw new Error('Falta configurar la clave de GIPHY');
  }

  const normalizedSearch = search.trim().slice(0, 50);
  const endpoint = normalizedSearch ? 'gifs/search' : 'gifs/trending';
  const params = new URLSearchParams({
    api_key: apiKey,
    limit: String(PAGE_SIZE),
    offset: String(offset),
    rating: 'pg-13',
    bundle: 'messaging_non_clips',
    country_code: 'ES',
    remove_low_contrast: 'true',
  });

  if (normalizedSearch) {
    params.set('q', normalizedSearch);
    params.set('lang', 'es');
  }

  const response = await fetch(`${GIPHY_API_BASE}/${endpoint}?${params.toString()}`, { signal });
  const payload = (await response.json()) as GiphyResponse;

  if (!response.ok || (payload.meta?.status && payload.meta.status >= 400)) {
    throw new Error(payload.meta?.msg || 'GIPHY no ha podido cargar los GIFs');
  }

  const gifs = (payload.data ?? [])
    .map(readGif)
    .filter((gif): gif is GiphyGif => gif !== null);
  const nextOffset = offset + (payload.pagination?.count ?? gifs.length);
  const total = payload.pagination?.total_count ?? nextOffset;

  return {
    gifs,
    nextOffset: nextOffset < total ? nextOffset : null,
  };
}

export async function fetchGiphyGifsById(giphyIds: string[]): Promise<GiphyGif[]> {
  const apiKey = getGiphyApiKey();
  const ids = [...new Set(giphyIds)].filter(Boolean).slice(0, 100);
  if (!apiKey || ids.length === 0) return [];

  const params = new URLSearchParams({
    api_key: apiKey,
    ids: ids.join(','),
    rating: 'pg-13',
  });
  const response = await fetch(`${GIPHY_API_BASE}/gifs?${params.toString()}`);
  const payload = (await response.json()) as GiphyResponse;

  if (!response.ok || (payload.meta?.status && payload.meta.status >= 400)) return [];

  return (payload.data ?? [])
    .map(readGif)
    .filter((gif): gif is GiphyGif => gif !== null);
}

export function toGifMessage(gif: GiphyGif): GifMessage {
  const {
    mediaUrl: _mediaUrl,
    previewUrl: _previewUrl,
    ...message
  } = gif;
  return message;
}
