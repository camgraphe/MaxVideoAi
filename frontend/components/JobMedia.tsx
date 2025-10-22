'use client';

/* eslint-disable @next/next/no-img-element */
import clsx from 'clsx';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Job } from '@/types/jobs';
import { normalizeMediaUrl } from '@/lib/media';

export function JobMedia({
  job,
  className,
  objectFit = 'cover',
}: {
  job: Job;
  className?: string;
  objectFit?: 'cover' | 'contain';
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoUrl = useMemo(() => normalizeMediaUrl(job.videoUrl) ?? undefined, [job.videoUrl]);
  const poster = useMemo(() => normalizeMediaUrl(job.thumbUrl) ?? undefined, [job.thumbUrl]);
  const [isHovered, setHovered] = useState(false);
  const [allowMotion, setAllowMotion] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setAllowMotion(!media.matches);
    updatePreference();
    media.addEventListener('change', updatePreference);
    return () => {
      media.removeEventListener('change', updatePreference);
    };
  }, []);

  useEffect(() => {
    if (!allowMotion) {
      setHovered(false);
    }
  }, [allowMotion]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return undefined;
    if (!allowMotion) {
      video.pause();
      return undefined;
    }

    const handleLoaded = () => {
      try {
        const midpoint = video.duration && Number.isFinite(video.duration) && video.duration > 0 ? video.duration / 2 : 0;
        video.currentTime = midpoint;
        video.pause();
      } catch {
        // Some transports may not support seeking; ignore.
      }
    };

    video.addEventListener('loadedmetadata', handleLoaded);
    video.addEventListener('loadeddata', handleLoaded);
    return () => {
      video.removeEventListener('loadedmetadata', handleLoaded);
      video.removeEventListener('loadeddata', handleLoaded);
    };
  }, [allowMotion, job.jobId, videoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return undefined;

    let canceled = false;

    const playVideo = async () => {
      try {
        await video.play();
      } catch {
        // Autoplay might be blocked; ignore.
      }
    };

    const handleInteraction = () => {
      if (!isHovered) {
        video.pause();
        try {
          const midpoint = video.duration && Number.isFinite(video.duration) && video.duration > 0 ? video.duration / 2 : 0;
          video.currentTime = midpoint;
        } catch {
          // ignore seek failures
        }
        return;
      }

      if (video.readyState >= 2) {
        void playVideo();
      } else {
        const handleCanPlay = () => {
          video.removeEventListener('canplay', handleCanPlay);
          if (!canceled && isHovered) {
            void playVideo();
          }
        };
        video.addEventListener('canplay', handleCanPlay, { once: true });
      }
    };

    handleInteraction();

    return () => {
      canceled = true;
      video.pause();
    };
  }, [allowMotion, isHovered, videoUrl]);

  const effectiveAspect = job.aspectRatio ?? '16:9';

  const aspectClass = useMemo(() => {
    if (effectiveAspect === '9:16') return 'aspect-[9/16]';
    if (effectiveAspect === '1:1') return 'aspect-square';
    return 'aspect-[16/9]';
  }, [effectiveAspect]);

  const objectFitClass = objectFit === 'contain' ? 'object-contain' : 'object-cover';

  if (!videoUrl) {
    if (!poster) {
      return (
        <div className={clsx('absolute inset-0 flex items-center justify-center bg-[var(--surface-2)] px-4 text-center text-xs font-medium text-text-muted', className)}>
          Media unavailable
        </div>
      );
    }
    if (poster.startsWith('data:')) {
      return <img src={poster} alt={job.prompt || ''} className={clsx('absolute inset-0 h-full w-full', objectFitClass, className)} />;
    }
    return (
      <Image
        src={poster}
        alt={job.prompt || ''}
        fill
        sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        className={clsx(objectFitClass, className)}
      />
    );
  }

  return (
    <div
      className={clsx('absolute inset-0 bg-[#EFF3FA]', aspectClass, className)}
      onMouseEnter={() => allowMotion && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => allowMotion && setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        poster={poster}
        className={clsx('h-full w-full', objectFitClass)}
        preload="metadata"
        playsInline
        muted
        controls={false}
        crossOrigin="anonymous"
      />
    </div>
  );
}
