'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

import { fetchGiphyGifs, type GiphyGif } from '@/lib/giphy';

export function GifPicker({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (gif: GiphyGif) => Promise<boolean>;
}) {
  const [search, setSearch] = useState('');
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return undefined;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setIsLoading(true);
      setError('');
      void fetchGiphyGifs(search, controller.signal)
        .then(setGifs)
        .catch((caught) => {
          if (!controller.signal.aborted) {
            setError(caught instanceof Error ? caught.message : 'No se han podido cargar los GIFs.');
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    }, 300);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [isOpen, search]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop gif-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="gif-picker" role="dialog" aria-modal="true" aria-label="Buscar un GIF" onMouseDown={(event) => event.stopPropagation()}>
        <div className="gif-picker-heading">
          <div>
            <p className="eyebrow">POWERED BY GIPHY</p>
            <h2>Elige un GIF</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>×</button>
        </div>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar GIFs"
          maxLength={50}
          autoFocus
        />
        <div className="gif-results">
          {error && <p className="form-error">{error}</p>}
          {isLoading ? (
            <div className="gif-loading" role="status">Buscando…</div>
          ) : (
            <div className="gif-grid">
              {gifs.map((gif) => (
                <button
                  type="button"
                  disabled={Boolean(isSending)}
                  onClick={() => {
                    setIsSending(gif.giphyId);
                    void onSelect(gif).then((sent) => {
                      setIsSending('');
                      if (sent) onClose();
                    });
                  }}
                  key={gif.giphyId}>
                  <Image
                    src={gif.previewUrl}
                    alt={gif.altText}
                    fill
                    sizes="(max-width: 640px) 44vw, 180px"
                    unoptimized
                  />
                  {isSending === gif.giphyId && <span>Enviando…</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
