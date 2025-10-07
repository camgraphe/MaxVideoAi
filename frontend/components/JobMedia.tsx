'use client';

/* eslint-disable @next/next/no-img-element */
import clsx from 'clsx';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Job } from '@/types/jobs';
import { getPlaceholderMedia } from '@/lib/placeholderMedia';

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
  const placeholder = useMemo(() => getPlaceholderMedia(job.jobId), [job.jobId]);
  const videoUrl =
    typeof job.videoUrl === 'string' && job.videoUrl.startsWith('http')
      ? job.videoUrl
      : placeholder.videoUrl;
  const poster =
    typeof job.thumbUrl === 'string' && job.thumbUrl.startsWith('http')
      ? job.thumbUrl
      : placeholder.posterUrl;
  const [isHovered, setHovered] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return undefined;

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
  }, [videoUrl, job.jobId]);

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
  }, [isHovered, videoUrl]);

  const effectiveAspect = job.aspectRatio ?? placeholder.aspectRatio;

  const aspectClass = useMemo(() => {
    if (effectiveAspect === '9:16') return 'aspect-[9/16]';
    if (effectiveAspect === '1:1') return 'aspect-square';
    return 'aspect-[16/9]';
  }, [effectiveAspect]);

  const objectFitClass = objectFit === 'contain' ? 'object-contain' : 'object-cover';

  if (!videoUrl) {
    if (!poster) return null;
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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
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
