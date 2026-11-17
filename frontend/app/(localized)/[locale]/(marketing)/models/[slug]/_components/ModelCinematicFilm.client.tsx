'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { LoaderCircle, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { usePublicVideoControls } from '@/components/media/usePublicVideoControls';
import type { ModelKeyframeDemoViewModel } from '../_lib/model-page-keyframe-demo';
import type { CinematicPresentation } from '../_lib/model-page-cinematic-data';

/** Playback replaces the still inside its approved mask, without changing geometry. */
export function ModelCinematicFilm({ video, poster, title, ui, mask = 'create', keyframes }: {
  video: string; poster: string; title: string; ui: CinematicPresentation['ui'];
  keyframes?: Pick<ModelKeyframeDemoViewModel, 'timeline' | 'copy' | 'recipe'>;
  mask?: 'create' | 'frame' | 'gallery';
}) {
  const container = useRef<HTMLDivElement>(null);
  const controls = usePublicVideoControls(video, 'watch', 'auto', container);
  const [hasFrame, setHasFrame] = useState(false);
  const pendingSeek = useRef<number | null>(null);
  function selectFrame(seconds: number) {
    const node = controls.videoRef.current;
    if (!node) return;
    controls.pause();
    if (node.readyState >= 1) {
      node.currentTime = Math.min(seconds, Math.max(0, node.duration - 1 / 24));
      if (node.readyState >= 2) setHasFrame(true);
    } else {
      pendingSeek.current = seconds;
      node.preload = 'metadata';
      node.load();
    }
  }
  const label = controls.isPlaying ? ui.pause : controls.terminalError ? ui.retry : ui.play;
  return <><div className="cinema-inline-film" ref={container}>
    <div className={`cinema-editorial-media cinema-editorial-media--${mask}`}>
      <video ref={controls.videoRef} src={video} preload="none" playsInline aria-label={title}
        {...controls.events} onLoadedMetadata={event => {
          controls.events.onLoadedMetadata(event);
          if (pendingSeek.current !== null) {
            selectFrame(pendingSeek.current);
            pendingSeek.current = null;
          }
        }} onSeeked={() => { if (keyframes) setHasFrame(true); }} onPlaying={event => { controls.events.onPlaying(event); setHasFrame(true); }} />
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
  </div>
    {keyframes ? <div className="cinema-film-anchors">
      <div className="cinema-film-anchors-heading"><strong>{keyframes.copy.imagesLabel}</strong><span>{keyframes.copy.timelineLabel} · 24 fps</span></div>
      <div className="cinema-film-ruler" aria-hidden="true">
        {keyframes.timeline.map(frame => <i key={frame.frameIndex} style={{ left: `${100 * frame.seconds / keyframes.recipe.durationSec}%` }} />)}
        <b style={{ left: `${Math.min(100, 100 * controls.currentTime / keyframes.recipe.durationSec)}%` }} />
      </div>
      <ol className="cinema-film-anchors-list">{keyframes.timeline.map((frame, index) => <li key={frame.frameIndex} id={`keyframe-example-frame-${frame.frameIndex}`}>
        <button type="button" onClick={() => selectFrame(frame.seconds)}
          aria-current={controls.currentTime + 1 / 24 >= frame.seconds && (index + 1 === keyframes.timeline.length || controls.currentTime + 1 / 24 < keyframes.timeline[index + 1].seconds) ? 'step' : undefined}>
          <Image src={frame.imageUrl} alt="" aria-hidden="true" width={240} height={135} sizes="(min-width: 800px) 180px, 120px" loading="lazy" />
          <strong>{frame.timeLabel}</strong><span>{frame.caption || `${keyframes.copy.frameLabel} ${frame.number}`}</span>
        </button>
      </li>)}</ol>
    </div> : null}
  </>;
}
