'use client';

import Image from 'next/image';
import { useState } from 'react';
import { usePublicVideoControls } from '@/components/media/usePublicVideoControls';

type CreativeFilmProps = {
  poster: string; video: string; title: string; model: string;
  playLabel: string; loadingLabel: string; errorLabel: string;
  sizes?: string;
};

/** A manual, below-fold film: responsive cover, no speculative video transfer. */
export function CreativeFilm({ poster, video, title, model, playLabel, loadingLabel, errorLabel, sizes = '(max-width: 700px) 100vw, 50vw' }: CreativeFilmProps) {
  const controls = usePublicVideoControls(video, 'watch');
  const [hasFrame, setHasFrame] = useState(false);
  const covered = !hasFrame || controls.terminalError;
  return <div className="creative-film" data-film-state={controls.isPlaying ? 'playing' : 'paused'}>
    <video ref={controls.videoRef} src={video} preload="none" playsInline controls={hasFrame}
      aria-label={`${title} · ${model}`} {...controls.events}
      onPlaying={(event) => { controls.events.onPlaying(event); setHasFrame(true); }} />
    {covered ? <Image src={poster} alt={title} fill sizes={sizes} loading="lazy" className="creative-film-cover" /> : null}
    {covered ? <button type="button" className="creative-film-play" onClick={controls.togglePlayback}
      aria-label={`${playLabel} — ${title}`}><span aria-hidden="true">▶</span><span>{controls.isLoading ? loadingLabel : controls.terminalError ? errorLabel : playLabel}</span></button> : null}
  </div>;
}
