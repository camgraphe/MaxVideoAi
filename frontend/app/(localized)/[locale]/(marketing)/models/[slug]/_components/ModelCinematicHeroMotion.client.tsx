'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LoaderCircle, Pause, Play } from 'lucide-react';
import { usePublicVideoPlayback } from '@/components/media/usePublicVideoPlayback';
import { isCrawlerUserAgent } from '@/lib/crawler-user-agent';
import type { CinematicPresentation } from '../_lib/model-page-cinematic-data';

/** Optional background motion; the server-rendered responsive image remains the cover. */
export function ModelCinematicHeroMotion({ src, title, ui }: {
  src: string; title: string; ui: CinematicPresentation['ui'];
}) {
  const container = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const userPaused = useRef(false);
  const manual = useRef(false);
  const [visible, setVisible] = useState(false);
  const [automatic, setAutomatic] = useState(false);
  const [intended, setIntended] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasFrame, setHasFrame] = useState(false);
  const { attempt, terminalError, begin, fail, setContext, measureNode, measurePlaying,
    measureWaiting, measurePause, restartMeasurement } = usePublicVideoPlayback('model');

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 768px)');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection;
    const update = () => setAutomatic(desktop.matches && !motion.matches && !connection?.saveData && !isCrawlerUserAgent(navigator.userAgent));
    update();
    desktop.addEventListener('change', update);
    motion.addEventListener('change', update);
    connection?.addEventListener('change', update);
    return () => { desktop.removeEventListener('change', update); motion.removeEventListener('change', update); connection?.removeEventListener('change', update); };
  }, []);

  useEffect(() => {
    let inView = false;
    const update = () => setVisible(inView && document.visibilityState !== 'hidden');
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; update(); }, { threshold: 0.05 });
    if (container.current) observer.observe(container.current);
    document.addEventListener('visibilitychange', update);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, []);

  const start = useCallback((trigger: 'automatic' | 'user') => {
    manual.current = trigger === 'user';
    userPaused.current = false;
    begin(src, trigger, { force: terminalError });
    if (trigger === 'user') restartMeasurement(trigger);
    setIntended(true);
    setLoading(true);
  }, [begin, restartMeasurement, src, terminalError]);

  useEffect(() => {
    if (!visible || !automatic || attempt || userPaused.current) return;
    // Let the critical poster and page finish before requesting background video.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => { timer = setTimeout(() => start('automatic'), 1200); };
    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });
    return () => { clearTimeout(timer); window.removeEventListener('load', schedule); };
  }, [attempt, automatic, start, visible]);

  useEffect(() => {
    const node = video.current;
    const canPlay = visible && intended && (automatic || manual.current) && !terminalError;
    setContext({ intended: canPlay, visible });
    if (!node) return;
    if (!canPlay) { node.pause(); setPlaying(false); setLoading(false); return; }
    let cancelled = false;
    node.muted = true;
    measureNode(node);
    setLoading(true);
    void node.play().catch(() => {
      if (cancelled) return;
      setIntended(false); setLoading(false); setPlaying(false);
    });
    return () => { cancelled = true; node.pause(); };
  }, [attempt?.id, automatic, intended, measureNode, setContext, terminalError, visible]);

  const label = playing || (loading && intended) ? ui.pause : terminalError ? ui.retry : ui.play;
  return <>
    <div ref={container} className="cinema-hero-motion" aria-hidden="true">
      {attempt ? <video key={attempt.id} ref={video} src={attempt.rendition.src} muted loop playsInline preload="none"
        tabIndex={-1} className={`cinema-hero-image${hasFrame && !terminalError ? ' is-ready' : ''}`}
        onPlaying={event => { setHasFrame(true); setPlaying(true); setLoading(false); measurePlaying(event.currentTarget); }}
        onPause={() => { setPlaying(false); measurePause(); }}
        onWaiting={() => { setLoading(true); measureWaiting(); }}
        onError={event => { setHasFrame(false); setLoading(false); fail(attempt.id, event.currentTarget.error?.code); }} /> : null}
    </div>
    <button type="button" className="cinema-hero-playback" aria-label={`${label} — ${title}`} title={label}
      onClick={() => {
        if (intended && (playing || loading)) { userPaused.current = true; setIntended(false); }
        else start('user');
      }}>
      {loading ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
    </button>
  </>;
}
