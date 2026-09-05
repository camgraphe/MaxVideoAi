'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { dispatchAnalyticsEvent } from '@/lib/analytics-client';
import {
  createPublicVideoOriginalFallbackAttempt,
  createPublicVideoPlaybackMeasurement,
  selectPublicVideoPlaybackRendition,
  type PublicVideoPlaybackAttempt,
  type PublicVideoPlaybackSurface,
  type PublicVideoPlaybackTrigger,
} from '@/lib/public-video-playback';

type FailureResult = 'fallback' | 'terminal' | 'stale';

function browserNow(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

function browserViewportWidth(): number {
  if (window.matchMedia?.('(max-width: 767px)').matches) return 767;
  return Math.max(768, window.innerWidth || 768);
}

function browserSaveData(): boolean {
  return Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
}

export function usePublicVideoPlayback(surface: PublicVideoPlaybackSurface) {
  const nextAttemptIdRef = useRef(1);
  const currentRef = useRef<PublicVideoPlaybackAttempt | null>(null);
  const measurementRef = useRef<ReturnType<typeof createPublicVideoPlaybackMeasurement> | null>(null);
  const measuredNodeRef = useRef<HTMLVideoElement | null>(null);
  const contextRef = useRef({ intended: false, visible: true });
  const terminalErrorRef = useRef(false);
  const lastFailedAttemptIdRef = useRef<number | null>(null);
  const [attempt, setAttempt] = useState<PublicVideoPlaybackAttempt | null>(null);
  const [terminalError, setTerminalError] = useState(false);

  const installAttempt = useCallback((next: PublicVideoPlaybackAttempt) => {
    measurementRef.current?.dispose();
    measuredNodeRef.current = null;
    currentRef.current = next;
    measurementRef.current = createPublicVideoPlaybackMeasurement({
      attempt: next,
      surface,
      emit: dispatchAnalyticsEvent,
    });
    measurementRef.current.setContext(contextRef.current);
    terminalErrorRef.current = false;
    setTerminalError(false);
    setAttempt(next);
  }, [surface]);

  const begin = useCallback((
    originalSrc: string,
    trigger: PublicVideoPlaybackTrigger,
    options: { force?: boolean } = {},
  ) => {
    const current = currentRef.current;
    if (!options.force && current?.rendition.originalSrc === originalSrc && !terminalErrorRef.current) return current;
    const startedAt = browserNow();
    const next: PublicVideoPlaybackAttempt = {
      id: nextAttemptIdRef.current++,
      rendition: selectPublicVideoPlaybackRendition(originalSrc, {
        viewportWidth: browserViewportWidth(),
        saveData: browserSaveData(),
        trigger,
      }),
      trigger,
      startedAt,
      usedOriginalFallback: false,
    };
    installAttempt(next);
    return next;
  }, [installAttempt]);

  const fail = useCallback((attemptId: number, errorCode?: number | null): FailureResult => {
    const current = currentRef.current;
    if (!current || current.id !== attemptId) return 'stale';
    if (lastFailedAttemptIdRef.current === attemptId) return 'stale';
    lastFailedAttemptIdRef.current = attemptId;
    measurementRef.current?.error(errorCode);
    if (current.rendition.profile !== 'original' && !current.usedOriginalFallback) {
      const fallback = createPublicVideoOriginalFallbackAttempt(current, nextAttemptIdRef.current++);
      installAttempt(fallback);
      return 'fallback';
    }
    terminalErrorRef.current = true;
    setTerminalError(true);
    return 'terminal';
  }, [installAttempt]);

  const setContext = useCallback((next: Partial<{ intended: boolean; visible: boolean }>) => {
    contextRef.current = { ...contextRef.current, ...next };
    measurementRef.current?.setContext(contextRef.current);
  }, []);

  const restartMeasurement = useCallback((trigger: PublicVideoPlaybackTrigger) => {
    const current = currentRef.current;
    if (!current) return;
    const measuredAttempt = { ...current, trigger, startedAt: browserNow() };
    currentRef.current = measuredAttempt;
    measurementRef.current?.dispose();
    measurementRef.current = createPublicVideoPlaybackMeasurement({
      attempt: measuredAttempt,
      surface,
      emit: dispatchAnalyticsEvent,
    });
    measurementRef.current.setContext(contextRef.current);
    if (measuredNodeRef.current) measurementRef.current.attach(measuredNodeRef.current);
  }, [surface]);

  const measureNode = useCallback((video: HTMLVideoElement) => {
    measuredNodeRef.current = video;
    measurementRef.current?.attach(video);
  }, []);
  const measurePlaying = useCallback((video: HTMLVideoElement) => {
    measuredNodeRef.current = video;
    measurementRef.current?.playing(video);
  }, []);
  const measureWaiting = useCallback(() => measurementRef.current?.waiting(), []);
  const measurePause = useCallback(() => measurementRef.current?.pause(), []);

  useEffect(() => () => measurementRef.current?.dispose(), []);

  return {
    attempt,
    terminalError,
    begin,
    fail,
    setContext,
    restartMeasurement,
    measureNode,
    measurePlaying,
    measureWaiting,
    measurePause,
  };
}
