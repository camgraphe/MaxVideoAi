'use client';
import { Maximize, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { useRef } from 'react';
import type { AppLocale } from '@/i18n/locales';
import { usePublicVideoControls } from '@/components/media/usePublicVideoControls';
import type { CreatorResultVideoMedia } from './CreatorResultMedia';
import { creatorResultCopy } from './creator-result-copy';

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/** Manual original playback: the poster reserves geometry, no MP4 is requested before Play. */
export function CreatorResultVideo({ media, label, locale, priority = false }: {
  media: CreatorResultVideoMedia; label: string; locale: AppLocale; priority?: boolean;
}) {
  const copy = creatorResultCopy(locale);
  const playback = usePublicVideoControls(media.original, 'comparison', 'original');
  const player = useRef<HTMLDivElement>(null);
  const fullscreen = locale === 'fr' ? 'Plein écran' : locale === 'es' ? 'Pantalla completa' : 'Full screen';
  const toggleFullscreen = () => {
    if (document.fullscreenElement) { void document.exitFullscreen().catch(() => {}); return; }
    if (player.current?.requestFullscreen) { void player.current.requestFullscreen().catch(() => {}); return; }
    const video = playback.videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    video?.webkitEnterFullscreen?.();
  };
  return <div className="creator-result-video">
    {priority ? <link rel="preload" as="image" href={media.poster} {...{ fetchpriority: 'high' }} /> : null}
    <h3>{label}</h3>
    <div className="creator-result-player" ref={player}>
      <video ref={playback.videoRef} src={media.original} poster={media.poster} width={media.width} height={media.height}
        style={{ aspectRatio: `${media.width}/${media.height}` }} playsInline preload="none" aria-label={label} {...playback.events} />
      <div className="creator-result-transport">
        <button type="button" aria-label={`${playback.isPlaying ? copy.pause : copy.play} — ${label}`} onClick={playback.togglePlayback}>{playback.isPlaying ? <Pause size={18} /> : <Play size={18} />}</button>
        <span>{clock(playback.currentTime)} / {clock(playback.duration || media.duration)}</span>
        <input type="range" aria-label={`${copy.seek} — ${label}`} min="0" max={playback.duration || media.duration} step="0.05" value={playback.currentTime} disabled={!playback.duration} onChange={event => playback.seek(event.target.value)} />
        {media.hasAudio ? <button type="button" aria-label={playback.isMuted ? copy.sound : copy.mute} onClick={playback.toggleMuted}>{playback.isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button> : null}
        <button type="button" aria-label={`${fullscreen} — ${label}`} onClick={toggleFullscreen}><Maximize size={17} /></button>
      </div>
    </div>
    {playback.terminalError ? <p role="alert">{copy.error} <a href={media.original} download>{copy.download}</a></p> : null}
  </div>;
}
