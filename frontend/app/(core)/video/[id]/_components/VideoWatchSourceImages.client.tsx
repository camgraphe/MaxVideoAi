/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react';
import type { WatchPageSourceImage } from '@/server/watch-page-signals';

export type WatchSourceImageItem = WatchPageSourceImage & {
  imageUrl: string;
  thumbnailUrl?: string;
};

function resolveNextIndex(current: number | null, direction: -1 | 1, count: number) {
  if (!count) return null;
  if (current === null) return 0;
  return (current + direction + count) % count;
}

export function VideoWatchSourceImagesClient({ images }: { images: WatchSourceImageItem[] }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedImage = selectedIndex === null ? null : images[selectedIndex] ?? null;
  const selectedPosition = selectedIndex === null ? null : selectedIndex + 1;
  const hasMultipleImages = images.length > 1;

  useEffect(() => {
    if (selectedIndex === null) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedIndex(null);
      } else if (event.key === 'ArrowLeft') {
        setSelectedIndex((current) => resolveNextIndex(current, -1, images.length));
      } else if (event.key === 'ArrowRight') {
        setSelectedIndex((current) => resolveNextIndex(current, 1, images.length));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [images.length, selectedIndex]);

  if (!images.length) return null;

  const showPreviousImage = () => setSelectedIndex((current) => resolveNextIndex(current, -1, images.length));
  const showNextImage = () => setSelectedIndex((current) => resolveNextIndex(current, 1, images.length));

  return (
    <>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {images.map((sourceImage, index) => {
          const thumbnailUrl = sourceImage.thumbnailUrl ?? sourceImage.imageUrl;
          return (
            <figure key={sourceImage.key} className="overflow-hidden rounded-input border border-hairline bg-surface-2">
              <button
                type="button"
                onClick={() => setSelectedIndex(index)}
                className="group block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                aria-label={`Open ${sourceImage.label} larger`}
              >
                <span className="relative flex aspect-square items-center justify-center bg-black">
                  <img
                    src={thumbnailUrl}
                    alt={sourceImage.alt}
                    loading="lazy"
                    className="h-full w-full object-contain transition group-hover:brightness-105"
                  />
                  <span className="absolute bottom-2 right-2 rounded-pill bg-black/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-micro text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                    View larger
                  </span>
                </span>
              </button>
              <figcaption className="px-3 py-2 text-xs font-semibold text-text-secondary">{sourceImage.label}</figcaption>
            </figure>
          );
        })}
      </div>

      {selectedImage ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="watch-source-image-title"
          className="fixed inset-0 z-50 bg-black/80 px-4 py-4 text-white sm:px-6 sm:py-6"
        >
          <button
            type="button"
            aria-label="Close source image viewer"
            className="absolute inset-0 cursor-default"
            onClick={() => setSelectedIndex(null)}
          />
          <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 id="watch-source-image-title" className="text-sm font-semibold text-white">
                  {selectedImage.label}
                </h3>
                <p className="mt-1 text-xs text-white/70">
                  {selectedPosition} of {images.length}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={selectedImage.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center gap-2 rounded-input border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden />
                  Open original
                </a>
                <button
                  type="button"
                  onClick={() => setSelectedIndex(null)}
                  aria-label="Close source image viewer"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-input border border-white/20 bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>
            </div>

            <div className="relative flex min-h-0 flex-1 items-center justify-center">
              {hasMultipleImages ? (
                <button
                  type="button"
                  onClick={showPreviousImage}
                  aria-label="Show previous source image"
                  className="absolute left-0 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white transition hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden />
                </button>
              ) : null}
              <img src={selectedImage.imageUrl} alt={selectedImage.alt} className="max-h-full max-w-full object-contain shadow-2xl" />
              {hasMultipleImages ? (
                <button
                  type="button"
                  onClick={showNextImage}
                  aria-label="Show next source image"
                  className="absolute right-0 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white transition hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
