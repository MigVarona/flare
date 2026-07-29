const apiBase = 'https://api.giphy.com/v1';
const pageSize = 24;

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

type Rendition = {
  url?: string;
  webp?: string;
  width?: string;
  height?: string;
};

type ApiGif = {
  id?: string;
  title?: string;
  alt_text?: string;
  username?: string;
  url?: string;
  user?: { display_name?: string };
  images?: {
    original?: Rendition;
    fixed_width?: Rendition;
    fixed_width_small?: Rendition;
  };
};

type ApiResponse = {
  data?: ApiGif[];
  meta?: { status?: number; msg?: string };
};

function dimension(value?: string) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 320;
}

function text(value: string | undefined, fallback: string, max: number) {
  return (value?.trim() || fallback).slice(0, max);
}

function readGif(item: ApiGif): GiphyGif | null {
  const original = item.images?.original;
  const preview = item.images?.fixed_width_small ?? item.images?.fixed_width ?? original;
  const mediaUrl = original?.webp || original?.url;
  const previewUrl = preview?.webp || preview?.url;
  if (!item.id || !item.url || !mediaUrl || !previewUrl) return null;

  const title = text(item.title, 'GIF de GIPHY', 200);
  return {
    giphyId: item.id,
    sourceUrl: item.url,
    title,
    altText: text(item.alt_text, title, 500),
    username: text(item.user?.display_name || item.username, '', 100),
    width: dimension(original?.width ?? preview?.width),
    height: dimension(original?.height ?? preview?.height),
    mediaUrl,
    previewUrl,
  };
}

async function request(endpoint: string, params: URLSearchParams, signal?: AbortSignal) {
  const apiKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY;
  if (!apiKey) throw new Error('Falta configurar GIPHY para la web.');
  params.set('api_key', apiKey);
  params.set('rating', 'pg-13');

  const response = await fetch(`${apiBase}/${endpoint}?${params.toString()}`, { signal });
  const payload = (await response.json()) as ApiResponse;
  if (!response.ok || (payload.meta?.status && payload.meta.status >= 400)) {
    throw new Error(payload.meta?.msg || 'GIPHY no ha podido cargar los GIFs.');
  }
  return (payload.data ?? []).map(readGif).filter((gif): gif is GiphyGif => gif !== null);
}

export function fetchGiphyGifs(search: string, signal?: AbortSignal) {
  const normalized = search.trim().slice(0, 50);
  const params = new URLSearchParams({
    limit: String(pageSize),
    offset: '0',
    bundle: 'messaging_non_clips',
    country_code: 'ES',
  });
  if (normalized) {
    params.set('q', normalized);
    params.set('lang', 'es');
  }
  return request(normalized ? 'gifs/search' : 'gifs/trending', params, signal);
}

export function fetchGiphyGifsById(ids: string[]) {
  const unique = [...new Set(ids)].filter(Boolean).slice(0, 100);
  if (unique.length === 0) return Promise.resolve([]);
  return request('gifs', new URLSearchParams({ ids: unique.join(',') }));
}

export function toGifMessage(gif: GiphyGif): GifMessage {
  const { mediaUrl: _mediaUrl, previewUrl: _previewUrl, ...message } = gif;
  return message;
}
