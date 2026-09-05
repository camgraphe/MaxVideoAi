'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ArrowDownUp, Play } from 'lucide-react';

type Props = {
  src: string;
  poster: string;
  label: string;
  scrollHint: string;
  playLabel: string;
  resumeScrollLabel: string;
};

export function McpScrollVideo({ src, poster, label, scrollHint, playLabel, resumeScrollLabel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const manualPlaybackRef = useRef(false);
  const scheduleScrollRef = useRef<(() => void) | null>(null);
  const hintId = useId();
  const [scrollEnabled, setScrollEnabled] = useState(false);
  const [manualPlayback, setManualPlayback] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let enabled = !preference.matches;
    let nearby = false;
    let loading = false;
    let frame = 0;

    const updateFrame = () => {
      frame = 0;
      if (!enabled || manualPlaybackRef.current || !nearby || !Number.isFinite(video.duration) || video.duration <= 0) return;

      const rect = video.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      // Advance while the product crosses the viewport; upward scroll reverses it.
      const progress = Math.min(1, Math.max(0, (viewportHeight * 0.9 - rect.top) / (rect.height + viewportHeight * 0.8)));
      const target = progress * Math.max(0, video.duration - 1 / 30);
      // Let the decoder finish its current seek before requesting the latest position.
      if (!video.seeking && Math.abs(video.currentTime - target) >= 1 / 30) {
        video.currentTime = target;
      }
    };

    const scheduleFrame = () => {
      if (enabled && !manualPlaybackRef.current && nearby && !frame) frame = window.requestAnimationFrame(updateFrame);
    };

    const loadWhenNeeded = () => {
      if (enabled && !manualPlaybackRef.current && nearby && !loading) {
        loading = true;
        video.preload = 'auto';
        video.load();
      }
      scheduleFrame();
    };

    const syncPreference = () => {
      enabled = !preference.matches;
      setScrollEnabled(enabled);
      if (enabled && !manualPlaybackRef.current) video.pause();
      loadWhenNeeded();
    };

    const observer = new IntersectionObserver(([entry]) => {
      nearby = entry.isIntersecting;
      loadWhenNeeded();
    }, { rootMargin: '200px 0px' });

    observer.observe(video);
    scheduleScrollRef.current = scheduleFrame;
    syncPreference();
    preference.addEventListener('change', syncPreference);
    window.addEventListener('scroll', scheduleFrame, { passive: true });
    window.addEventListener('resize', scheduleFrame);
    video.addEventListener('loadedmetadata', scheduleFrame);
    video.addEventListener('canplay', scheduleFrame);
    video.addEventListener('seeked', scheduleFrame);

    return () => {
      scheduleScrollRef.current = null;
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      preference.removeEventListener('change', syncPreference);
      window.removeEventListener('scroll', scheduleFrame);
      window.removeEventListener('resize', scheduleFrame);
      video.removeEventListener('loadedmetadata', scheduleFrame);
      video.removeEventListener('canplay', scheduleFrame);
      video.removeEventListener('seeked', scheduleFrame);
    };
  }, [src]);

  const startPlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    manualPlaybackRef.current = true;
    setManualPlayback(true);
    video.currentTime = 0;
    void video.play().catch(() => video.pause());
  };

  const resumeScroll = () => {
    videoRef.current?.pause();
    manualPlaybackRef.current = false;
    setManualPlayback(false);
    scheduleScrollRef.current?.();
  };

  return (
    <>
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover object-[35%_center]"
        aria-label={label}
        aria-describedby={scrollEnabled && !manualPlayback ? hintId : undefined}
        controls={!scrollEnabled || manualPlayback}
        playsInline
        muted
        loop={!scrollEnabled || manualPlayback}
        preload="none"
        poster={poster}
        src={src}
      />
      {scrollEnabled && !manualPlayback ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-8 text-[11px] text-white/90">
          <span id={hintId} className="flex items-center gap-2"><ArrowDownUp aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />{scrollHint}</span>
          <button type="button" onClick={startPlayback} aria-label={playLabel} title={playLabel} className="pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/25 bg-black/35 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            <Play aria-hidden="true" className="ml-0.5 h-4 w-4" />
          </button>
        </div>
      ) : null}
      {scrollEnabled && manualPlayback ? (
        <button type="button" onClick={resumeScroll} aria-label={resumeScrollLabel} title={resumeScrollLabel} className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/60 text-white transition-colors hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
          <ArrowDownUp aria-hidden="true" className="h-4 w-4" />
        </button>
      ) : null}
    </>
  );
}
