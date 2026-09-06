'use client';

import { useEffect, useRef, useState } from 'react';
import { usePublicVideoPlayback } from '@/components/media/usePublicVideoPlayback';
import { isCrawlerUserAgent } from '@/lib/crawler-user-agent';

/** Incidental card previews never transfer video before visible playback intent. */
export function useExampleCardPlayback(src: string | null, requested: boolean, exclusive: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const { attempt, terminalError, begin, fail, setContext, measureNode, measurePlaying,
    measureWaiting, measurePause, restartMeasurement } = usePublicVideoPlayback('examples-card');
  const playbackAttempt = requested && allowed && !terminalError && attempt?.rendition.originalSrc === src ? attempt : null;

  useEffect(() => {
    if (!requested || !src) { setAllowed(false); return; }
    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection;
    const sync = () => setAllowed(document.visibilityState !== 'hidden' && !motion?.matches
      && !connection?.saveData && !isCrawlerUserAgent(navigator.userAgent));
    sync();
    document.addEventListener('visibilitychange', sync);
    motion?.addEventListener?.('change', sync);
    connection?.addEventListener?.('change', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      motion?.removeEventListener?.('change', sync);
      connection?.removeEventListener?.('change', sync);
    };
  }, [requested, src]);

  useEffect(() => {
    if (requested && allowed && src) begin(src, 'automatic');
  }, [allowed, begin, requested, src]);

  useEffect(() => {
    const node = videoRef.current;
    setVideoReady(false);
    if (!node || !playbackAttempt) return;
    let active = true;
    node.muted = true;
    if (exclusive) document.querySelectorAll<HTMLVideoElement>('video[data-examples-card]').forEach((other) => {
      if (other !== node) other.pause();
    });
    setContext({ intended: true, visible: true });
    measureNode(node);
    if (!playbackAttempt.usedOriginalFallback) restartMeasurement('automatic');
    const rejected = () => {
      if (!active) return;
      setVideoReady(false);
      setContext({ intended: false });
      measurePause();
    };
    try { void node.play()?.catch(rejected); } catch { rejected(); }
    return () => {
      active = false;
      setContext({ intended: false, visible: false });
      measurePause();
      node.pause();
    };
  }, [exclusive, measureNode, measurePause, playbackAttempt, restartMeasurement, setContext]);

  const events = {
    onPlaying: (event: React.SyntheticEvent<HTMLVideoElement>) => {
      if (videoRef.current !== event.currentTarget || !playbackAttempt) return;
      setVideoReady(true);
      measurePlaying(event.currentTarget);
    },
    onWaiting: () => { setVideoReady(false); measureWaiting(); },
    onPause: () => { setVideoReady(false); setContext({ intended: false }); measurePause(); },
    onError: (event: React.SyntheticEvent<HTMLVideoElement>) => {
      if (videoRef.current !== event.currentTarget || !playbackAttempt) return;
      setVideoReady(false);
      fail(playbackAttempt.id, event.currentTarget.error?.code);
    },
  };
  return { videoRef, playbackAttempt, events, videoReady: Boolean(playbackAttempt) && videoReady };
}
