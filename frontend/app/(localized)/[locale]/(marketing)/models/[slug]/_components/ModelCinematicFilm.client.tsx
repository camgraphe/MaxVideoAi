'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { LoaderCircle, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { usePublicVideoControls } from '@/components/media/usePublicVideoControls';
import type { CinematicPresentation } from '../_lib/model-page-cinematic-data';

/** Playback replaces the still inside its approved mask, without changing geometry. */
export function ModelCinematicFilm({ video, poster, title, ui, mask = 'create' }: {
  video: string; poster: string; title: string; ui: CinematicPresentation['ui'];
  mask?: 'create' | 'frame' | 'gallery';
}) {
  const container = useRef<HTMLDivElement>(null);
  const controls = usePublicVideoControls(video, 'watch', 'auto', container);
  const [hasFrame, setHasFrame] = useState(false);
  const label = controls.isPlaying ? ui.pause : controls.terminalError ? ui.retry : ui.play;
  return <div className="cinema-inline-film" ref={container}>
    <div className={`cinema-editorial-media cinema-editorial-media--${mask}`}>
      <video ref={controls.videoRef} src={video} preload="none" playsInline aria-label={title}
        {...controls.events} onPlaying={event => { controls.events.onPlaying(event); setHasFrame(true); }} />
      {!hasFrame || controls.terminalError ? <Image src={poster} alt={title} fill loading="lazy" sizes={mask === 'gallery' ? '(min-width: 768px) 356px, 320px' : '(min-width: 1600px) 800px, (min-width: 768px) 52vw, 90vw'} /> : null}
    </div>
    <div className="cinema-inline-controls">
      {hasFrame ? <button type="button" className="cinema-media-control" onClick={controls.toggleMuted} aria-label={controls.isMuted ? ui.unmute : ui.mute} title={controls.isMuted ? ui.unmute : ui.mute}>
        {controls.isMuted ? <VolumeX size={17} aria-hidden="true" /> : <Volume2 size={17} aria-hidden="true" />}
      </button> : null}
      <button type="button" className="cinema-media-control" onClick={controls.togglePlayback} aria-label={`${label} — ${title}`} title={label}>
        {controls.isLoading ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : controls.isPlaying ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}
      </button>
    </div>
  </div>;
}
