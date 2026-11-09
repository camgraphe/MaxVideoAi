'use client';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useLibraryDisplayAccess } from '@/hooks/useLibraryMediaAccess';
import { parseImageDisplay } from '@/lib/image-display';
import { hasStoredLibraryThumbnail } from '@/lib/library-image';
import type { AssetBrowserAsset } from './AssetLibraryBrowser';
import { LibraryImageThumbnail } from './LibraryImageThumbnail.client';
const LightboxViewport = lazy(() => import('./LibraryLightboxViewport.client'));

/** Display-only reader. Identity, actions and navigation remain in the parent owner. */
export function ProgressiveMediaReader({
  asset,
  locale,
  label,
}: {
  asset: AssetBrowserAsset;
  locale: string;
  label: string;
}) {
  const media = useLibraryDisplayAccess(asset);
  const [ready, setReady] = useState<string | null>(null);
  const [original, setOriginal] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const currentSource = useRef('');
  const display =
    asset.kind === 'image'
      ? parseImageDisplay(asset.imageDisplay, asset.url, asset.previewUrl)
      : undefined;
  const originalSource =
    media.access.accessUrl ?? (asset.readAccessRef ? '' : asset.url);
  const source =
    asset.kind === 'image' && display && !original
      ? (media.access.previewAccessUrl ??
        (asset.readAccessRef ? originalSource : display.url))
      : asset.kind === 'video'
        ? (media.access.playbackAccessUrl ??
          (asset.readAccessRef
            ? originalSource
            : (asset.playbackVideoUrl ?? originalSource)))
        : originalSource;
  currentSource.current = media.retired ? '' : source;
  useEffect(() => {
    const node = root.current;
    return () => {
      // Release the decoder on source change, close and retirement; no neighbor AV mounts.
      node?.querySelectorAll('video,audio').forEach((element) => {
        const av = element as HTMLMediaElement;
        if (!av.paused) av.pause();
        av.removeAttribute('src');
        av.querySelectorAll('source').forEach((child) =>
          child.removeAttribute('src'),
        );
      });
    };
  }, [asset.id, asset.url, media.retired]);
  if (media.retired) return null;
  const recover = (captured: string) => {
    void media.refresh().then((recovered) => {
      if (currentSource.current !== captured || recovered) return;
      if (display && !original) setOriginal(true);
      else setFailed(true);
    });
  };
  const retry = locale.startsWith('fr')
    ? 'Réessayer'
    : locale.startsWith('es')
      ? 'Reintentar'
      : 'Retry';
  const unavailable = locale.startsWith('fr')
    ? 'Lecture indisponible.'
    : locale.startsWith('es')
      ? 'Reproducción no disponible.'
      : 'Playback unavailable.';
  return (
    <div
      ref={root}
      className="app-library-reader"
      data-media-kind={asset.kind}
      onKeyDown={(event) => {
        if ((event.target as HTMLElement).closest('video,audio'))
          event.stopPropagation();
      }}
      onLoadCapture={(event) => {
        const image = event.target as HTMLImageElement;
        if (image.tagName !== 'IMG' || image.src !== source) return;
        const captured = source;
        void (
          typeof image.decode === 'function'
            ? image.decode()
            : Promise.resolve()
        )
          .then(() => {
            if (currentSource.current === captured) setReady(captured);
          })
          .catch(() => {
            if (currentSource.current === captured) recover(captured);
          });
      }}
      onErrorCapture={(event) => {
        const target = event.target as HTMLMediaElement;
        if (!['IMG', 'VIDEO', 'AUDIO', 'SOURCE'].includes(target.tagName))
          return;
        if (
          target.tagName === 'IMG' &&
          (target as unknown as HTMLImageElement).src !== source
        )
          return;
        recover(source);
      }}
    >
      {asset.kind === 'image' && ready !== source ? (
        <div className="app-library-reader-placeholder">
          {hasStoredLibraryThumbnail(asset) ? (
            <LibraryImageThumbnail asset={asset} posterOnly alt={label} />
          ) : null}
        </div>
      ) : null}
      {!source ? null : asset.kind === 'audio' ? (
        <audio
          key={attempt}
          src={source}
          controls
          preload="none"
          aria-label={label}
        />
      ) : (
        <Suspense
          fallback={
            asset.kind === 'video' ? (
              <LibraryImageThumbnail asset={asset} posterOnly alt={label} />
            ) : null
          }
        >
          <LightboxViewport
            key={attempt}
            asset={asset}
            display={original ? undefined : display}
            source={source}
            poster={
              media.access.thumbnailAccessUrl ?? asset.thumbUrl ?? undefined
            }
            label={label}
            locale={locale}
          />
        </Suspense>
      )}
      {failed || media.error ? (
        <p role="alert">
          {unavailable}{' '}
          <button
            type="button"
            onClick={() => {
              media.beginAttempt();
              setFailed(false);
              void media.refresh().then((recovered) => {
                if (recovered || !asset.readAccessRef) setAttempt((n) => n + 1);
              });
            }}
          >
            {retry}
          </button>
        </p>
      ) : null}
    </div>
  );
}
