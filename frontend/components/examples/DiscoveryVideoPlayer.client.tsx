'use client';
import { useRef, type CSSProperties } from 'react';
import { Maximize, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { usePublicVideoControls } from '@/components/media/usePublicVideoControls';
import type { ExampleWatchDetail } from '@/lib/example-watch-detail';
import type { ReaderCopy } from './example-reader-copy';
import styles from './example-reader-styles';

export type ReaderNavigation = { previous: () => void; next: () => void; canPrevious: boolean; canNext: boolean; busy: boolean };
const time = (seconds: number) => `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
export function DiscoveryVideoPlayer({ detail, copy }: { detail: ExampleWatchDetail; copy: ReaderCopy }) {
  const controls = usePublicVideoControls(detail.videoUrl, 'watch');
  const frame = useRef<HTMLDivElement>(null);
  const playbackButton = useRef<HTMLButtonElement>(null);
  const [width, height] = detail.aspectRatio.split(':').map(Number);
  const ratio = width > 0 && height > 0 ? width / height : 16 / 9;
  const fullscreen = async () => {
    const video = controls.videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (frame.current?.requestFullscreen) await frame.current.requestFullscreen();
      else video?.webkitEnterFullscreen?.();
    } catch { /* Fullscreen can be denied by the browser; inline playback remains available. */ }
  };
  return <div className={styles.player}>
    <div ref={frame} className={styles.stage}>
    <div className={styles.frame} style={{ '--ratio': ratio } as CSSProperties}>
      <video ref={controls.videoRef} src={detail.videoUrl} poster={detail.posterUrl ?? undefined}
        playsInline preload="none" aria-label={detail.title} {...controls.events} />
      {!controls.isPlaying && <button className={styles.centerPlay} onClick={event => {
        // Central Play disappears on startup; keep its focus on the persistent control.
        if (document.activeElement === event.currentTarget) playbackButton.current?.focus({ preventScroll: true });
        controls.togglePlayback();
      }} aria-label={copy.play}><Play size={28} fill="currentColor" /></button>}
      {(controls.terminalError || controls.isLoading) && <p className={styles.playerStatus} role="status">{controls.terminalError ? copy.playbackError : copy.loading}</p>}
    </div>
      <div className={styles.controls}>
        <input aria-label={copy.timeline} type="range" min={0} max={controls.duration || detail.durationSec || 1} step={0.1}
          value={controls.currentTime} disabled={!controls.duration} onChange={event => controls.seek(event.target.value)} />
        <div className={styles.controlRow}>
          <button ref={playbackButton} onClick={controls.togglePlayback} aria-label={controls.isPlaying ? copy.pause : copy.play}>{controls.isPlaying ? <Pause size={17}/> : <Play size={17}/>}</button>
          {detail.hasAudio && <button onClick={controls.toggleMuted} aria-label={controls.isMuted ? copy.unmute : copy.mute}>{controls.isMuted ? <VolumeX size={17}/> : <Volume2 size={17}/>}</button>}
          <span>{time(controls.currentTime)} / {time(controls.duration || detail.durationSec)}</span>
          <div className={styles.spacer}/>
          {controls.hasQualityChoice && <select aria-label={copy.quality} value={controls.quality} onChange={event => controls.changeQuality(event.target.value === 'original' ? 'original' : 'auto')}><option value="auto">Auto</option><option value="original">{copy.original}</option></select>}
          <button onClick={() => void fullscreen()} aria-label={copy.fullscreen}><Maximize size={17}/></button>
        </div>
      </div>
    </div>
  </div>;
}
