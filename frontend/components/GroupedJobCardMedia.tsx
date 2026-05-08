'use client';

/* eslint-disable @next/next/no-img-element */
import clsx from 'clsx';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GroupSummary } from '@/types/groups';
import { AudioWaveformThumb } from '@/components/ui/AudioWaveformThumb';
import { isPlaceholderMediaUrl } from '@/lib/media';

export const GROUPED_JOB_THUMB_SIZES = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 320px';

type NavigatorWithConnection = Navigator & {
  connection?: {
    effectiveType?: string;
    saveData?: boolean;
  };
};

export function shouldWarmVisiblePreview(): boolean {
  if (typeof navigator === 'undefined') return true;
  const connection = (navigator as NavigatorWithConnection).connection;
  if (connection?.saveData) return false;
  const effectiveType = connection?.effectiveType;
  return effectiveType !== 'slow-2g' && effectiveType !== '2g';
}

function ThumbImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const baseClass = clsx('h-full w-full pointer-events-none', className);
  if (src.startsWith('data:')) {
    return <img src={src} alt={alt} className={baseClass} />;
  }
  return <Image src={src} alt={alt} fill className={baseClass} sizes={GROUPED_JOB_THUMB_SIZES} />;
}

export function GroupPreviewMedia({
  preview,
  audioUrl,
  audioLabel,
  shouldPlay,
  shouldWarm,
  fit = 'contain',
}: {
  preview: GroupSummary['previews'][number] | undefined;
  audioUrl?: string | null;
  audioLabel?: string | null;
  shouldPlay: boolean;
  shouldWarm: boolean;
  fit?: 'contain' | 'cover';
}) {
  const displayVideoUrl = preview?.previewVideoUrl ?? preview?.videoUrl ?? null;
  const hasOptimizedPreview = Boolean(preview?.previewVideoUrl);
  const hasVideo = Boolean(displayVideoUrl);
  const hasAudioOnly = Boolean(audioUrl) && !hasVideo;
  const thumbSrc = preview?.thumbUrl && !isPlaceholderMediaUrl(preview.thumbUrl) ? preview.thumbUrl : null;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoReadyRef = useRef(false);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    if (!hasVideo) return;
    videoReadyRef.current = false;
    setVideoReady(false);
  }, [hasVideo, displayVideoUrl]);

  const markVideoReady = useCallback(() => {
    if (videoReadyRef.current) return;
    videoReadyRef.current = true;
    setVideoReady(true);
  }, []);

  const playPreviewVideo = useCallback(() => {
    const element = videoRef.current;
    if (!element) return;
    element.preload = 'auto';
    if (
      element.networkState === HTMLMediaElement.NETWORK_EMPTY ||
      (element.networkState === HTMLMediaElement.NETWORK_IDLE && element.readyState < HTMLMediaElement.HAVE_CURRENT_DATA)
    ) {
      element.load();
    }
    if (element.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }
    const playPromise = element.play();
    if (playPromise) {
      playPromise.catch(() => {
        /* ignore autoplay rejection */
      });
    }
  }, []);

  useEffect(() => {
    if (!hasVideo) return;
    const element = videoRef.current;
    if (!element) return;
    if (shouldPlay) {
      playPreviewVideo();
    } else {
      element.pause();
      if (
        shouldWarm &&
        hasOptimizedPreview &&
        (element.networkState === HTMLMediaElement.NETWORK_EMPTY ||
          (element.networkState === HTMLMediaElement.NETWORK_IDLE && element.readyState < HTMLMediaElement.HAVE_CURRENT_DATA))
      ) {
        element.preload = 'auto';
        element.load();
      }
    }
  }, [hasVideo, hasOptimizedPreview, playPreviewVideo, displayVideoUrl, shouldPlay, shouldWarm]);

  const handleCanPlay = () => {
    markVideoReady();
    if (shouldPlay) {
      playPreviewVideo();
    }
  };

  const handleLoadedData = () => {
    markVideoReady();
    if (shouldPlay) {
      playPreviewVideo();
    }
  };

  if (hasVideo && displayVideoUrl) {
    const poster = thumbSrc ?? undefined;
    return (
      <div className="relative h-full w-full overflow-hidden rounded-[inherit]">
        {thumbSrc ? (
          <ThumbImage
            src={thumbSrc}
            alt=""
            className={clsx(
              'absolute inset-0 transition-opacity duration-150 ease-out',
              fit === 'cover' ? 'object-cover scale-[1.06] transform-gpu' : 'object-contain',
              shouldPlay && videoReady ? 'opacity-0' : 'opacity-100'
            )}
          />
        ) : null}
        <video
          ref={videoRef}
          src={displayVideoUrl}
          poster={poster}
          className={clsx(
            'absolute inset-0 h-full w-full pointer-events-none transition-opacity duration-150 ease-out',
            fit === 'cover' ? 'object-cover scale-[1.06] transform-gpu' : 'object-contain',
            videoReady ? 'opacity-100' : 'opacity-0'
          )}
          muted
          playsInline
          autoPlay={shouldPlay}
          loop
          preload={shouldPlay || (shouldWarm && hasOptimizedPreview) ? 'auto' : 'none'}
          onLoadedData={handleLoadedData}
          onCanPlay={handleCanPlay}
        />
      </div>
    );
  }
  if (hasAudioOnly) {
    return (
      <AudioWaveformThumb
        seed={audioUrl ?? preview?.id ?? 'audio-preview'}
        thumbSrc={thumbSrc}
        label={audioLabel}
        active={shouldPlay}
      />
    );
  }
  if (thumbSrc) {
    return (
      <div className="relative h-full w-full overflow-hidden rounded-[inherit]">
        <ThumbImage
          src={thumbSrc}
          alt=""
          className={fit === 'cover' ? 'object-cover scale-[1.06] transform-gpu' : 'object-contain'}
        />
      </div>
    );
  }
  return null;
}
