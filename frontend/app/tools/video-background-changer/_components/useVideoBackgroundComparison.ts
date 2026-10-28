'use client';

import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { usePublicVideoControls } from '@/components/media/usePublicVideoControls';
import type { VideoBackgroundMedia } from '../_lib/media';

export type ComparisonSound = 'off' | 'source' | 'result';

/** Pair timing lives here; original selection, retry and measurement stay with public controls. */
export function useVideoBackgroundComparison(media: VideoBackgroundMedia) {
  const containerRef = useRef<HTMLDivElement>(null);
  const source = usePublicVideoControls(media.source.src, 'comparison', 'original', containerRef);
  const result = usePublicVideoControls(media.result.src, 'comparison', 'original', containerRef);
  const owners = useRef([source, result]);
  owners.current = [source, result];
  const intended = useRef(false), waiting = useRef(new Set<HTMLVideoElement>()), position = useRef(0);
  const soundRef = useRef<ComparisonSound>('off');
  const [sound, updateSound] = useState<ComparisonSound>('off');
  const [playing, setPlaying] = useState(false), [buffering, setBuffering] = useState(false), [failed, setFailed] = useState(false);
  const [time, setTime] = useState(0);
  const [frames, setFrames] = useState([false, false]);
  const duration = Math.max(source.duration || media.source.durationSec, result.duration || media.result.durationSec);
  const durationRef = useRef(duration); durationRef.current = duration;

  const applySound = useCallback(() => {
    owners.current[0].setMuted(soundRef.current !== 'source');
    owners.current[1].setMuted(soundRef.current !== 'result');
  }, []);
  const setSound = useCallback((next: ComparisonSound) => {
    soundRef.current = next; updateSound(next); applySound();
  }, [applySound]);
  const pauseNodes = useCallback(() => { for (const owner of owners.current) owner.pause(); }, []);
  const pause = useCallback(() => {
    intended.current = false; waiting.current.clear(); pauseNodes(); setPlaying(false); setBuffering(false);
  }, [pauseNodes]);
  const align = useCallback((value: number) => {
    const next = Math.max(0, Math.min(durationRef.current, value));
    position.current = next; setTime(next);
    for (const owner of owners.current) {
      const node = owner.videoRef.current;
      if (!node) continue;
      const end = Number.isFinite(node.duration) ? node.duration : next;
      try { node.currentTime = Math.min(next, end); } catch { /* Loaded metadata applies the pending position. */ }
    }
  }, []);
  const seek = useCallback((value: number) => {
    if (!Number.isFinite(value)) return;
    align(value);
    for (const owner of owners.current) if (owner.videoRef.current?.readyState === 0) owner.videoRef.current.load();
  }, [align]);
  const start = useCallback(() => {
    if (!intended.current || document.visibilityState === 'hidden') return;
    applySound(); setFailed(false); setPlaying(true); setBuffering(false);
    for (const owner of owners.current) if (owner.videoRef.current?.paused) owner.togglePlayback();
  }, [applySound]);
  const togglePlayback = useCallback(() => {
    if (intended.current) { pause(); return; }
    if (position.current >= durationRef.current - 0.01) align(0);
    intended.current = true; start();
  }, [align, pause, start]);

  useEffect(() => {
    applySound();
    const hidden = () => { if (document.visibilityState === 'hidden') pause(); };
    document.addEventListener('visibilitychange', hidden);
    return () => { document.removeEventListener('visibilitychange', hidden); pause(); };
  }, [applySound, media.source.src, media.result.src, pause]);

  useEffect(() => {
    if (!intended.current || waiting.current.size > 0) return;
    if (owners.current.some(owner => !owner.isPlaying && !owner.isLoading && !owner.videoRef.current?.ended)) {
      pause(); setFailed(true);
    }
  }, [source.isPlaying, source.isLoading, result.isPlaying, result.isLoading, pause]);

  const track = (index: number, owner: typeof source) => ({
    ...owner,
    events: {
      ...owner.events,
      onLoadedMetadata: (event: SyntheticEvent<HTMLVideoElement>) => {
        owner.events.onLoadedMetadata(event);
        const node = event.currentTarget;
        node.currentTime = Math.min(position.current, Number.isFinite(node.duration) ? node.duration : position.current);
      },
      onLoadedData: () => setFrames(previous => previous.map((value, i) => i === index ? true : value)),
      onSeeked: () => setFrames(previous => previous.map((value, i) => i === index ? true : value)),
      onPlaying: (event: SyntheticEvent<HTMLVideoElement>) => {
        owner.events.onPlaying(event);
        setFrames(previous => previous.map((value, i) => i === index ? true : value));
      },
      onPause: (event: SyntheticEvent<HTMLVideoElement>) => {
        owner.events.onPause(event);
        if (intended.current && waiting.current.size === 0 && !event.currentTarget.ended) pause();
      },
      onTimeUpdate: (event: SyntheticEvent<HTMLVideoElement>) => {
        owner.events.onTimeUpdate(event);
        if (index !== 1) return;
        const next = event.currentTarget.currentTime;
        position.current = next; setTime(next);
        const before = owners.current[0].videoRef.current;
        if (intended.current && before && !before.ended && Math.abs(before.currentTime - next) > 0.12) {
          before.currentTime = Math.min(next, before.duration || next);
        }
      },
      onWaiting: (event: SyntheticEvent<HTMLVideoElement>) => {
        owner.events.onWaiting();
        if (!intended.current) return;
        waiting.current.add(event.currentTarget); pauseNodes(); setBuffering(true);
      },
      onCanPlay: (event: SyntheticEvent<HTMLVideoElement>) => {
        if (waiting.current.delete(event.currentTarget) && waiting.current.size === 0) start();
      },
      onEnded: () => {
        owner.events.onEnded();
        if (owners.current.every(item => item.videoRef.current?.ended)) {
          position.current = durationRef.current; setTime(durationRef.current); pause();
        }
      },
      onError: (event: SyntheticEvent<HTMLVideoElement>) => { owner.events.onError(event); pause(); setFailed(true); },
    },
  });
  return { containerRef, source: track(0, source), result: track(1, result), togglePlayback, pause, seek, setSound, sound, playing, buffering, failed, time, duration, frames };
}
