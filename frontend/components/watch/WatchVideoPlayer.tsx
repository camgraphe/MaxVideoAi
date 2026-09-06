'use client';

import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Film, Maximize2, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { PublicVideoQualitySelect } from '@/components/media/PublicVideoQualitySelect';
import { usePublicVideoControls } from '@/components/media/usePublicVideoControls';

type WatchVideoPlayerProps = {
  src: string;
  poster: string;
  title: string;
  engineLabel: string;
  hasAudio: boolean;
  containerStyle?: CSSProperties;
  videoStyle?: CSSProperties;
};

type FullscreenVideoElement = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
};

function formatTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0:00';
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function WatchVideoPlayer({
  src,
  poster,
  title,
  engineLabel,
  hasAudio,
  containerStyle,
  videoStyle,
}: WatchVideoPlayerProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const {
    videoRef, events, isPlaying, isLoading, isMuted, duration, currentTime, terminalError,
    quality, changeQuality, hasQualityChoice, togglePlayback, toggleMuted, seek,
  } = usePublicVideoControls(src, 'watch');
  const [canFullscreen, setCanFullscreen] = useState(false);

  useEffect(() => {
    setCanFullscreen(
      typeof shellRef.current?.requestFullscreen === 'function' ||
      typeof (videoRef.current as FullscreenVideoElement | null)?.webkitEnterFullscreen === 'function'
    );
  }, [videoRef]);

  const toggleFullscreen = async () => {
    const shell = shellRef.current;
    if (!shell) return;
    try {
      if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
        await document.exitFullscreen();
      } else if (typeof shell.requestFullscreen === 'function') {
        await shell.requestFullscreen();
      } else {
        // iPhone Safari exposes fullscreen on the video instead of its container.
        (videoRef.current as FullscreenVideoElement | null)?.webkitEnterFullscreen?.();
      }
    } catch {
      // A browser can refuse fullscreen or media may not be ready yet. Keep playback usable.
    }
  };

  return (
    <div ref={shellRef} className="relative overflow-hidden rounded-t-card bg-black" style={containerStyle}>
      <video
        key={src}
        ref={videoRef}
        src={src}
        poster={poster}
        className="h-full w-full object-contain"
        playsInline
        preload="none"
        muted={isMuted}
        aria-label={title}
        style={videoStyle}
        onClick={togglePlayback}
        {...events}
      />
      {hasQualityChoice ? (
        <div className="absolute bottom-20 right-4 z-20">
          <PublicVideoQualitySelect value={quality} onChange={changeQuality} title={title} />
        </div>
      ) : null}
      {isLoading ? (
        <span role="status" className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-pill bg-black/70 px-4 py-2 text-sm text-white">
          Loading video…
        </span>
      ) : null}
      {terminalError ? (
        <span role="alert" className="pointer-events-none absolute inset-x-4 top-16 rounded-lg bg-black/70 px-3 py-2 text-center text-sm text-white">
          Video unavailable. Press Play to retry.
        </span>
      ) : null}
      <div className="pointer-events-none absolute left-4 top-4 inline-flex items-center gap-2 rounded-pill bg-surface-on-media-dark-70 px-3 py-2 text-xs font-semibold text-on-inverse shadow-card backdrop-blur">
        <Film className="h-4 w-4" aria-hidden />
        {engineLabel}
      </div>
      {hasAudio ? (
        <div className="pointer-events-none absolute right-4 top-4 inline-flex items-center gap-2 rounded-pill bg-surface-on-media-dark-70 px-3 py-2 text-xs font-semibold text-on-inverse shadow-card backdrop-blur">
          <Volume2 className="h-4 w-4" aria-hidden />
          Audio enabled
        </div>
      ) : null}
      {!isPlaying ? (
        <button
          type="button"
          aria-label={`Play ${title}`}
          onClick={togglePlayback}
          className="absolute left-1/2 top-1/2 inline-flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-surface-on-media-dark-55 text-on-inverse shadow-[0_20px_52px_rgba(0,0,0,0.32)] backdrop-blur-sm transition hover:bg-surface-on-media-dark-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          <Play className="ml-1 h-7 w-7 fill-current" aria-hidden />
        </button>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-4 pb-4 pt-16 text-on-inverse">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={isPlaying ? 'Pause video' : 'Play video'}
            onClick={togglePlayback}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-inverse transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isPlaying ? <Pause className="h-4 w-4 fill-current" aria-hidden /> : <Play className="ml-0.5 h-4 w-4 fill-current" aria-hidden />}
          </button>
          <span className="w-20 shrink-0 text-xs font-semibold tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(0, duration)}
            step={0.1}
            value={Math.min(currentTime, duration || currentTime)}
            aria-label={`Seek ${title}`}
            onChange={(event) => seek(event.currentTarget.value)}
            className="h-1 min-w-0 flex-1 cursor-pointer accent-white"
          />
          <button
            type="button"
            aria-label={isMuted ? 'Unmute video' : 'Mute video'}
            onClick={toggleMuted}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-inverse transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isMuted ? <VolumeX className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
          </button>
          {canFullscreen ? (
            <button
              type="button"
              aria-label="Fullscreen video"
              onClick={toggleFullscreen}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-inverse transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Maximize2 className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
