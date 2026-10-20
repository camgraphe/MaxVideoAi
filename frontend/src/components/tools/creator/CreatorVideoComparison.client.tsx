'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { creatorWorkspaceCopy } from './creator-workspace-copy';
import styles from './creator-workspace.module.css';

type Props = {
  locale: string;
  sourceUrl: string;
  resultUrl: string;
  sourcePoster?: string | null;
  resultPoster?: string | null;
  sourceStartSec?: number;
  sourceEndSec?: number;
  onRetry?(): void;
};

/** Signed originals stay exact. One manual transport owns both private readers. */
export function CreatorVideoComparison(props: Props) {
  return <ComparisonSession key={`${props.sourceUrl}:${props.resultUrl}:${props.sourceStartSec}:${props.sourceEndSec}`} {...props} />;
}

function ComparisonSession({ locale, sourceUrl, resultUrl, sourcePoster, resultPoster, sourceStartSec = 0, sourceEndSec, onRetry }: Props) {
  const copy = creatorWorkspaceCopy(locale);
  const container = useRef<HTMLDivElement>(null), source = useRef<HTMLVideoElement>(null), result = useRef<HTMLVideoElement>(null);
  const intended = useRef(false), generation = useRef(0), waiting = useRef(new Set<HTMLVideoElement>());
  const position = useRef(0), limit = useRef(0);
  const [time, setTime] = useState(0), [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false), [buffering, setBuffering] = useState(false), [failed, setFailed] = useState(false), [muted, setMuted] = useState(false);
  const pauseNodes = useCallback(() => {
    for (const node of [source.current, result.current]) if (node && !node.paused) node.pause();
  }, []);
  const stop = useCallback(() => {
    generation.current += 1;
    intended.current = false;
    waiting.current.clear();
    pauseNodes();
    setPlaying(false);
    setBuffering(false);
  }, [pauseNodes]);
  const seek = useCallback((value: number) => {
    const next = Math.max(0, limit.current > 0 ? Math.min(limit.current, value) : value);
    position.current = next;
    setTime(next);
    // Setting before metadata also records the browser's default playback start.
    for (const [node, offset] of [[source.current, sourceStartSec], [result.current, 0]] as const) {
      if (node) try { node.currentTime = next + offset; } catch { /* Metadata will apply the pending position. */ }
    }
  }, [sourceStartSec]);
  const play = useCallback(() => {
    if (!intended.current || !source.current || !result.current || document.visibilityState === 'hidden') return;
    const token = ++generation.current;
    setPlaying(true);
    setBuffering(false);
    try {
      void Promise.all([source.current.play(), result.current.play()]).catch(() => {
        if (token !== generation.current) return;
        stop();
        setFailed(true);
      });
    } catch { stop(); setFailed(true); }
  }, [stop]);
  const sync = useCallback(() => {
    if (!source.current || !result.current) return;
    const next = result.current.currentTime;
    if (limit.current > 0 && next >= limit.current) { seek(limit.current); stop(); return; }
    position.current = next;
    setTime(next);
    if (Math.abs(source.current.currentTime - sourceStartSec - next) > 0.08) {
      try { source.current.currentTime = sourceStartSec + next; } catch { /* A pending seek resumes when metadata is ready. */ }
    }
  }, [seek, sourceStartSec, stop]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => { sync(); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, sync]);
  useEffect(() => {
    const before = source.current, after = result.current;
    const hidden = () => { if (document.visibilityState === 'hidden') stop(); };
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      if (entries.every(entry => !entry.isIntersecting)) stop();
    });
    if (container.current) observer?.observe(container.current);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      intended.current = false;
      generation.current += 1;
      observer?.disconnect();
      document.removeEventListener('visibilitychange', hidden);
      for (const node of [before, after]) if (node && !node.paused) node.pause();
    };
  }, [stop]);

  const events = {
    onLoadedMetadata: () => {
      const before = source.current?.duration, after = result.current?.duration;
      if (before && after && Number.isFinite(before) && Number.isFinite(after)) {
        limit.current = Math.max(0, Math.min(after, before - sourceStartSec, (sourceEndSec ?? before) - sourceStartSec));
        setDuration(limit.current);
      }
      seek(position.current);
    },
    onWaiting: (event: React.SyntheticEvent<HTMLVideoElement>) => {
      if (!intended.current) return;
      waiting.current.add(event.currentTarget);
      generation.current += 1;
      pauseNodes();
      setBuffering(true);
    },
    onCanPlay: (event: React.SyntheticEvent<HTMLVideoElement>) => {
      const wasWaiting = waiting.current.delete(event.currentTarget);
      if (wasWaiting && waiting.current.size === 0 && intended.current) play();
    },
    onEnded: () => { seek(limit.current || position.current); stop(); },
    onError: () => { stop(); setFailed(true); },
  };
  return <div ref={container} className={styles.comparison}>
    <div className={styles.comparisonVideos}>
      <figure><figcaption>{copy.original}</figcaption><video ref={source} src={sourceUrl} poster={sourcePoster ?? undefined} aria-label={copy.original} muted preload="none" playsInline {...events} /></figure>
      <figure><figcaption>{copy.result}</figcaption><video ref={result} src={resultUrl} poster={resultPoster ?? undefined} aria-label={copy.result} muted={muted} preload="none" playsInline {...events} onTimeUpdate={sync} /></figure>
    </div>
    <div className={styles.actions}>
      <button type="button" disabled={failed} onClick={() => {
        if (intended.current) { stop(); return; }
        if (limit.current && position.current >= limit.current) seek(0); else seek(position.current);
        intended.current = true;
        play();
      }}>{playing ? copy.pauseTogether : copy.playTogether}</button>
      <button type="button" aria-pressed={muted} onClick={() => setMuted(value => !value)}>{muted ? copy.enableResultSound : copy.muteResultSound}</button>
      <label className={styles.comparisonSeek}>{copy.playbackPosition}<input type="range" min={0} max={duration || 0} step={0.01} value={time} disabled={!duration || failed} onChange={event => seek(Number(event.target.value))} /></label>
      <output>{time.toFixed(1)} / {duration.toFixed(1)} s</output>
    </div>
    <p className={styles.comparisonHint}>{buffering ? copy.comparisonBuffering : copy.comparisonHint}</p>
    {failed ? <p className={styles.error} role="alert">{copy.previewError}{onRetry ? <button type="button" onClick={onRetry}>{copy.retry}</button> : null}</p> : null}
  </div>;
}
