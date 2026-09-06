'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { hasPublicVideoRendition } from '@/lib/public-video-renditions';
import type { PublicVideoPlaybackAttempt, PublicVideoPlaybackSurface, PublicVideoQuality } from '@/lib/public-video-playback';
import { usePublicVideoPlayback } from './usePublicVideoPlayback';

/** Manual readers share attempts; native/custom controls retain their own presentation. */
export function usePublicVideoControls(src: string, surface: PublicVideoPlaybackSurface, defaultQuality: PublicVideoQuality = 'auto') {
  const videoRef = useRef<HTMLVideoElement>(null);
  const activeRef = useRef<PublicVideoPlaybackAttempt | null>(null);
  const intentRef = useRef(false);
  const inViewRef = useRef(true);
  const generationRef = useRef(0);
  const programmaticPlayRef = useRef(false);
  const terminalRef = useRef(false);
  const resumeTimeRef = useRef<number | null>(null);
  const volumeRef = useRef({ muted: false, volume: 1 });
  const qualityRef = useRef(defaultQuality);
  const [quality, setQuality] = useState(defaultQuality);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const { attempt, terminalError, begin, fail, setContext, measureNode,
    measurePlaying, measureWaiting, measurePause, restartMeasurement } = usePublicVideoPlayback(surface);

  const visible = useCallback(() => inViewRef.current && document.visibilityState !== 'hidden', []);
  const applyAttempt = useCallback((next: PublicVideoPlaybackAttempt) => {
    generationRef.current += 1;
    activeRef.current = next;
    const retryFailedResource = terminalRef.current;
    terminalRef.current = false;
    const node = videoRef.current;
    if (!node) return;
    // The original remains in SSR/React props. Only this owner changes the live source,
    // avoiding a second React source assignment that could abort a gesture's play().
    if (retryFailedResource || node.getAttribute('src') !== next.rendition.src) node.src = next.rendition.src;
    node.muted = volumeRef.current.muted;
    node.volume = volumeRef.current.volume;
    measureNode(node);
  }, [measureNode]);

  const stop = useCallback(() => {
    generationRef.current += 1;
    intentRef.current = false;
    programmaticPlayRef.current = false;
    setContext({ intended: false });
    measurePause();
    setIsPlaying(false);
    setIsLoading(false);
    const node = videoRef.current;
    if (node && !node.paused) node.pause();
  }, [measurePause, setContext]);

  const play = useCallback(() => {
    const node = videoRef.current;
    if (!node || !intentRef.current || !visible() || terminalRef.current) return;
    const generation = ++generationRef.current;
    programmaticPlayRef.current = true;
    setContext({ intended: true, visible: true });
    setIsPlaying(true);
    setIsLoading(true);
    const rejected = () => {
      if (generation !== generationRef.current || videoRef.current !== node) return;
      programmaticPlayRef.current = false;
      // Native media errors own rendition fallback; a denied play request stays retryable.
      if (!node.error) stop();
    };
    try { void node.play()?.catch(rejected); } catch { rejected(); }
  }, [setContext, stop, visible]);

  const prepare = useCallback((nextQuality: PublicVideoQuality) => {
    const next = begin(src, 'user', { force: true, quality: nextQuality });
    applyAttempt(next);
    return next;
  }, [applyAttempt, begin, src]);

  useEffect(() => {
    intentRef.current = false;
    resumeTimeRef.current = null;
    qualityRef.current = defaultQuality;
    setQuality(defaultQuality);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setIsLoading(false);
    setContext({ intended: false });
    prepare(defaultQuality);
    const node = videoRef.current;
    return () => {
      generationRef.current += 1;
      intentRef.current = false;
      if (node && !node.paused) node.pause();
    };
  }, [defaultQuality, prepare, setContext]);

  useEffect(() => {
    if (!attempt || attempt.rendition.originalSrc !== src || activeRef.current?.id === attempt.id) return;
    applyAttempt(attempt);
    play();
  }, [applyAttempt, attempt, play, src]);

  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;
    const sync = () => {
      setContext({ visible: visible() });
      if (!visible()) stop();
    };
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver((entries) => {
      inViewRef.current = entries.some((entry) => entry.isIntersecting);
      sync();
    }, { threshold: 0.05 });
    observer?.observe(node);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => { observer?.disconnect(); document.removeEventListener('visibilitychange', sync); };
  }, [setContext, src, stop, visible]);

  const togglePlayback = () => {
    const node = videoRef.current;
    if (!node) return;
    if (intentRef.current && !terminalRef.current) { stop(); return; }
    if (!activeRef.current || terminalRef.current) prepare(qualityRef.current);
    intentRef.current = true;
    setContext({ intended: true, visible: visible() });
    restartMeasurement('user');
    play();
  };

  const changeQuality = (next: PublicVideoQuality) => {
    if (qualityRef.current === next) return;
    const node = videoRef.current;
    const previousSource = node?.getAttribute('src');
    const completed = node && (node.ended || (node.duration > 0 && node.currentTime >= node.duration));
    resumeTimeRef.current = completed ? 0 : node?.currentTime ?? 0;
    qualityRef.current = next;
    setQuality(next);
    const selected = prepare(next);
    if (selected.rendition.src === previousSource) {
      resumeTimeRef.current = null;
      return;
    }
    if (intentRef.current) play();
  };

  const isCurrentNode = (node: HTMLVideoElement) => {
    const expected = activeRef.current?.rendition.src;
    if (node !== videoRef.current || !expected) return false;
    return !node.currentSrc || node.currentSrc === new URL(expected, document.baseURI).href;
  };

  const events = {
    onPlay: (event: React.SyntheticEvent<HTMLVideoElement>) => {
      if (!isCurrentNode(event.currentTarget)) return;
      if (!visible()) { stop(); return; }
      intentRef.current = true;
      setContext({ intended: true, visible: true });
      if (!programmaticPlayRef.current) restartMeasurement('user');
      setIsPlaying(true);
      setIsLoading(true);
    },
    onPlaying: (event: React.SyntheticEvent<HTMLVideoElement>) => {
      if (!isCurrentNode(event.currentTarget)) return;
      if (!intentRef.current || !visible()) { stop(); return; }
      programmaticPlayRef.current = false;
      setIsPlaying(true);
      setIsLoading(false);
      measurePlaying(event.currentTarget);
    },
    onWaiting: () => { if (intentRef.current) { setIsLoading(true); measureWaiting(); } },
    onPause: (event: React.SyntheticEvent<HTMLVideoElement>) => {
      // A queued pause from source replacement must not cancel a newer play().
      if (event.currentTarget === videoRef.current && event.currentTarget.paused) stop();
    },
    onEnded: stop,
    onLoadedMetadata: (event: React.SyntheticEvent<HTMLVideoElement>) => {
      const node = event.currentTarget;
      if (!isCurrentNode(node)) return;
      const length = Number.isFinite(node.duration) ? node.duration : 0;
      setDuration(length);
      if (resumeTimeRef.current !== null) {
        node.currentTime = Math.min(Math.max(0, resumeTimeRef.current), length || resumeTimeRef.current);
        resumeTimeRef.current = null;
      }
      setCurrentTime(node.currentTime || 0);
    },
    onTimeUpdate: (event: React.SyntheticEvent<HTMLVideoElement>) => {
      if (isCurrentNode(event.currentTarget)) setCurrentTime(event.currentTarget.currentTime || 0);
    },
    onVolumeChange: (event: React.SyntheticEvent<HTMLVideoElement>) => {
      volumeRef.current = { muted: event.currentTarget.muted, volume: event.currentTarget.volume };
      setIsMuted(event.currentTarget.muted);
    },
    onError: (event: React.SyntheticEvent<HTMLVideoElement>) => {
      const node = event.currentTarget;
      if (!isCurrentNode(node) || !activeRef.current || terminalRef.current) return;
      resumeTimeRef.current = node.currentTime || 0;
      const result = fail(activeRef.current.id, node.error?.code);
      if (result === 'terminal') { terminalRef.current = true; stop(); }
    },
  };

  return {
    videoRef, events, isPlaying, isLoading, isMuted, duration, currentTime, terminalError,
    quality, changeQuality, hasQualityChoice: hasPublicVideoRendition(src), togglePlayback,
    toggleMuted() {
      const node = videoRef.current;
      if (!node) return;
      node.muted = !node.muted;
      volumeRef.current.muted = node.muted;
      setIsMuted(node.muted);
    },
    seek(value: string) {
      const node = videoRef.current;
      const time = Number(value);
      if (!node || !Number.isFinite(time) || !duration) return;
      node.currentTime = Math.min(duration, Math.max(0, time));
      setCurrentTime(node.currentTime);
    },
  };
}
