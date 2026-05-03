'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';

type WatchKeyFramesProps = {
  videoUrl: string;
  posterUrl: string;
  title: string;
  durationSec?: number | null;
  keyframeUrls?: {
    start?: string | null;
    middle?: string | null;
    end?: string | null;
  } | null;
};

type KeyFrame = {
  label: string;
  seekSec: number;
  imageUrl?: string | null;
};

const FRAME_LABELS = ['Opening frame', 'Motion beat', 'Final shot'];

function buildKeyFrames(
  durationSec?: number | null,
  keyframeUrls?: WatchKeyFramesProps['keyframeUrls']
): KeyFrame[] {
  const duration = Number.isFinite(Number(durationSec)) && Number(durationSec) > 0 ? Number(durationSec) : 6;
  const endSafe = Math.max(0.2, duration - 0.35);
  const seeks = [0.15, duration * 0.5, endSafe].map((value) => Math.min(endSafe, Math.max(0, value)));
  const urls = [keyframeUrls?.start, keyframeUrls?.middle, keyframeUrls?.end];
  return FRAME_LABELS.map((label, index) => ({
    label,
    seekSec: Number(seeks[index].toFixed(2)),
    imageUrl: urls[index] ?? null,
  }));
}

function WatchKeyFrameTile({
  frame,
  videoUrl,
  posterUrl,
  title,
  active,
}: {
  frame: KeyFrame;
  videoUrl: string;
  posterUrl: string;
  title: string;
  active: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);
  const hasPreparedImage = Boolean(frame.imageUrl);
  const source = useMemo(() => {
    if (!active || hasPreparedImage) return null;
    return `${videoUrl}#t=${frame.seekSec}`;
  }, [active, frame.seekSec, hasPreparedImage, videoUrl]);

  useEffect(() => {
    setReady(false);
  }, [source]);

  return (
    <figure className="overflow-hidden rounded-input border border-hairline bg-surface-2">
      <div className="relative aspect-video bg-surface-on-media-dark-5">
        <Image
          src={frame.imageUrl ?? posterUrl}
          alt=""
          fill
          className="object-cover"
          sizes="(min-width: 1280px) 250px, (min-width: 640px) 30vw, 100vw"
        />
        {source ? (
          <video
            ref={videoRef}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${ready ? 'opacity-100' : 'opacity-0'}`}
            muted
            playsInline
            preload="metadata"
            aria-label={`${title} - ${frame.label}`}
            onLoadedMetadata={(event) => {
              const player = event.currentTarget;
              try {
                player.currentTime = frame.seekSec;
              } catch {
                setReady(true);
              }
            }}
            onLoadedData={() => setReady(true)}
            onSeeked={() => setReady(true)}
          >
            <source src={source} type="video/mp4" />
          </video>
        ) : null}
      </div>
      <figcaption className="px-3 py-2 text-center text-xs text-text-secondary">{frame.label}</figcaption>
    </figure>
  );
}

export function WatchKeyFrames({ videoUrl, posterUrl, title, durationSec, keyframeUrls }: WatchKeyFramesProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(false);
  const keyFrames = useMemo(() => buildKeyFrames(durationSec, keyframeUrls), [durationSec, keyframeUrls]);

  useEffect(() => {
    if (active) return undefined;
    const element = rootRef.current;
    if (!element) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setActive(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setActive(true);
        observer.disconnect();
      },
      { root: null, rootMargin: '320px 0px', threshold: 0.01 }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [active]);

  return (
    <div ref={rootRef} className="mt-4 grid gap-3 sm:grid-cols-3">
      {keyFrames.map((frame) => (
        <WatchKeyFrameTile
          key={frame.label}
          frame={frame}
          videoUrl={videoUrl}
          posterUrl={posterUrl}
          title={title}
          active={active}
        />
      ))}
    </div>
  );
}
