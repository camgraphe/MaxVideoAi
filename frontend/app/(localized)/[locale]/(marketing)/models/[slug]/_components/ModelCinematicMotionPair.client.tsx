'use client';

import Image from 'next/image';
import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeftRight, LoaderCircle, Play, Pause } from 'lucide-react';
import { usePublicVideoControls } from '@/components/media/usePublicVideoControls';
import type { CinematicPresentation } from '../_lib/model-page-cinematic-data';

type Clip = { src: string; poster: string; width: number; height: number; durationSeconds: number };

/** Two unchanged originals, one silent playback control and native-speed time axis. */
export function ModelCinematicMotionPair({ source, result, sourceLabel, resultLabel, ui, layout = 'pair' }: {
  source: Clip; result: Clip; sourceLabel: string; resultLabel: string; ui: CinematicPresentation['ui'];
  layout?: 'pair' | 'reveal';
}) {
  const sliderId = useId();
  const [reveal, setReveal] = useState(50);
  const container = useRef<HTMLDivElement>(null);
  const first = usePublicVideoControls(source.src, 'comparison', 'original', container);
  const second = usePublicVideoControls(result.src, 'comparison', 'original', container);
  const [sourceFrame, setSourceFrame] = useState(false);
  const [resultFrame, setResultFrame] = useState(false);
  const playing = first.isPlaying || second.isPlaying;
  const error = first.terminalError || second.terminalError;
  const { setMuted: muteSource, pause: pauseSource } = first;
  const { setMuted: muteResult, pause: pauseResult } = second;
  const pause = () => { pauseSource(); pauseResult(); };
  const seek = (value: string) => { first.seek(value); second.seek(value); };

  useEffect(() => { muteSource(true); muteResult(true); }, [muteSource, muteResult]);
  useEffect(() => {
    if (error) { pauseSource(); pauseResult(); }
  }, [error, pauseSource, pauseResult]);
  useEffect(() => {
    if (!first.isPlaying || !second.isPlaying) return;
    // Correct decoder-start drift against the same original timestamps, never playbackRate.
    const timer = window.setInterval(() => {
      const a = first.videoRef.current, b = second.videoRef.current;
      if (!a || !b || a.paused || b.paused || a.seeking || b.seeking || a.readyState < 3 || b.readyState < 3) return;
      if (Math.abs(a.currentTime - b.currentTime) > 0.12) b.currentTime = a.currentTime;
    }, 250);
    return () => window.clearInterval(timer);
  }, [first.isPlaying, second.isPlaying, first.videoRef, second.videoRef]);

  const toggle = () => {
    if (playing) { pause(); return; }
    if (first.videoRef.current?.ended || second.videoRef.current?.ended) seek('0');
    first.togglePlayback(); second.togglePlayback();
  };
  const clips = [
    { clip: source, label: sourceLabel, controls: first, ready: sourceFrame, readyNow: () => setSourceFrame(true) },
    { clip: result, label: resultLabel, controls: second, ready: resultFrame, readyNow: () => setResultFrame(true) },
  ];
  function moveReveal(event: React.PointerEvent<HTMLInputElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setReveal(Math.round(Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100))));
  }
  return <div className={`cinema-motion-player${layout === 'reveal' ? ' cinema-edit-player' : ''}`} ref={container}>
    {layout === 'reveal' ? <>
      <div className="cinema-edit-stage">
        {clips.map(({clip, label, controls, ready, readyNow}, index) => <div className="cinema-edit-layer" key={clip.src} style={index ? {clipPath:`inset(0 0 0 ${reveal}%)`} : undefined}>
          <video ref={controls.videoRef} src={clip.src} preload="none" muted playsInline aria-label={label}
            {...controls.events} onPlaying={event => {controls.events.onPlaying(event); readyNow();}} onEnded={pause} />
          {!ready || error ? <Image src={clip.poster} alt={label} fill sizes="(min-width: 768px) 48vw, 90vw" loading="lazy" /> : null}
        </div>)}
        <span className="cinema-compare-tag cinema-compare-tag--before">{sourceLabel}</span><span className="cinema-compare-tag cinema-compare-tag--after">{resultLabel}</span>
        <span className="cinema-compare-divider" style={{left:`${reveal}%`}} aria-hidden="true"><span><ArrowLeftRight size={20} strokeWidth={1.5} /></span></span>
        <label className="cinema-compare-hint" htmlFor={sliderId}>{ui.compare}<ArrowLeftRight size={16} aria-hidden="true" /></label>
        <input id={sliderId} className="cinema-compare-input" type="range" min={0} max={100} value={reveal} aria-valuetext={`${reveal}%`}
          onChange={event => setReveal(Number(event.target.value))}
          onPointerDown={event => {event.preventDefault();event.currentTarget.focus({preventScroll:true});event.currentTarget.setPointerCapture(event.pointerId);moveReveal(event);}}
          onPointerMove={event => {if(event.currentTarget.hasPointerCapture(event.pointerId))moveReveal(event);}}
          onPointerUp={event => {if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}} />
      </div>
      <button type="button" className="cinema-media-control cinema-edit-toggle" onClick={toggle} aria-label={playing ? ui.pause : error ? ui.retry : ui.playTogether}>
        {first.isLoading || second.isLoading ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : playing ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}
      </button>
    </> : <div className="cinema-focus-pair">
      <button type="button" className="cinema-media-control cinema-motion-pair-toggle" onClick={toggle} aria-label={playing ? ui.pause : error ? ui.retry : ui.playTogether} title={playing ? ui.pause : ui.playTogether}>
        {first.isLoading || second.isLoading ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : playing ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}
      </button>
      {clips.map(({ clip, label, controls, ready, readyNow }) => <figure key={clip.src}>
        <div className="cinema-motion-frame">
          <video ref={controls.videoRef} src={clip.src} preload="none" muted playsInline aria-label={label}
            {...controls.events} onPlaying={event => { controls.events.onPlaying(event); readyNow(); }}
            onEnded={pause} />
          {!ready || error ? <Image src={clip.poster} alt={label} fill sizes="(min-width: 768px) 220px, 44vw" loading="lazy" /> : null}
        </div>
        <figcaption>{label}</figcaption>
      </figure>)}
    </div>}
    {error ? <p role="alert" className="cinema-motion-error">{ui.retry}</p> : null}
  </div>;
}
