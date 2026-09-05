'use client';

import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react';

import { usePublicVideoPlayback } from '@/components/media/usePublicVideoPlayback';

type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

type PlaybackItem = {
  id: string;
  videoSrc?: string | null;
};

export function useHeroVideoPlayback<T extends PlaybackItem>(items: T[]) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [status, setStatus] = useState<PlaybackStatus>('idle');
  const [hasUserPaused, setHasUserPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [progress, setProgress] = useState(0);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);
  const [canAutoplay, setCanAutoplay] = useState(false);
  const [isPlayerVisible, setIsPlayerVisible] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(true);
  const [isFrameReady, setIsFrameReady] = useState(false);
  const [manualPlayRequest, setManualPlayRequest] = useState(0);
  const playerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const idleHandleRef = useRef<number | null>(null);
  const idleUsesRequestRef = useRef(false);
  const generationRef = useRef(0);
  const playAttemptRef = useRef(0);
  const userPausedRef = useRef(false);
  const pendingManualPlayRef = useRef(false);
  const playerVisibleRef = useRef(false);
  const documentVisibleRef = useRef(true);
  const selected = items[selectedIndex] ?? items[0];
  const {
    attempt, begin, fail, setContext,
    measureNode, measurePlaying, measureWaiting, measurePause,
  } = usePublicVideoPlayback('home');
  const playbackAttempt = attempt?.rendition.originalSrc === selected?.videoSrc
    ? attempt
    : null;

  const cancelScheduledLoad = useCallback(() => {
    const handle = idleHandleRef.current;
    if (handle === null) return;
    if (idleUsesRequestRef.current && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(handle);
    } else {
      window.clearTimeout(handle);
    }
    idleHandleRef.current = null;
  }, []);

  const playCurrent = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setContext({ intended: true });
    measureNode(video);
    const generation = generationRef.current;
    const playAttempt = ++playAttemptRef.current;
    setStatus('loading');
    void video.play().catch((error: unknown) => {
      if (
        generationRef.current === generation &&
        playAttemptRef.current === playAttempt &&
        videoRef.current === video &&
        !(error instanceof DOMException && error.name === 'AbortError')
      ) {
        setStatus('error');
        setIsFrameReady(false);
      }
    });
  }, [measureNode, setContext]);

  const pauseForEnvironment = useCallback(() => {
    playAttemptRef.current += 1;
    measurePause();
    videoRef.current?.pause();
  }, [measurePause]);

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const desktopQuery = window.matchMedia('(min-width: 768px)');
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const updatePolicy = () => {
      setCanAutoplay(desktopQuery.matches && !motionQuery.matches && !connection?.saveData);
    };
    updatePolicy();
    desktopQuery.addEventListener('change', updatePolicy);
    motionQuery.addEventListener('change', updatePolicy);
    return () => {
      desktopQuery.removeEventListener('change', updatePolicy);
      motionQuery.removeEventListener('change', updatePolicy);
    };
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const observer = new IntersectionObserver(([entry]) => {
      const visible = Boolean(entry?.isIntersecting);
      playerVisibleRef.current = visible;
      setIsPlayerVisible(visible);
      setContext({ visible: visible && documentVisibleRef.current });
      if (!visible) pauseForEnvironment();
    }, { threshold: 0.01 });
    observer.observe(player);
    return () => observer.disconnect();
  }, [pauseForEnvironment, setContext]);

  useEffect(() => {
    const updateVisibility = () => {
      const visible = document.visibilityState !== 'hidden';
      documentVisibleRef.current = visible;
      setIsDocumentVisible(visible);
      setContext({ visible: visible && playerVisibleRef.current });
      if (!visible) pauseForEnvironment();
    };
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, [pauseForEnvironment, setContext]);

  useEffect(() => {
    cancelScheduledLoad();
    if (shouldLoadVideo || !selected?.videoSrc || !canAutoplay || !isPlayerVisible || !isDocumentVisible) return;
    const generation = generationRef.current;
    const loadPreview = () => {
      idleHandleRef.current = null;
      if (generationRef.current !== generation) return;
      begin(selected.videoSrc!, 'automatic');
      setContext({ intended: true });
      setShouldLoadVideo(true);
      setStatus('loading');
    };
    if (typeof window.requestIdleCallback === 'function') {
      idleUsesRequestRef.current = true;
      idleHandleRef.current = window.requestIdleCallback(loadPreview, { timeout: 1800 });
    } else {
      idleUsesRequestRef.current = false;
      idleHandleRef.current = window.setTimeout(loadPreview, 1200);
    }
    return cancelScheduledLoad;
  }, [begin, canAutoplay, cancelScheduledLoad, isDocumentVisible, isPlayerVisible, selected?.id, selected?.videoSrc, setContext, shouldLoadVideo]);

  useEffect(() => {
    if (!shouldLoadVideo || !selected?.videoSrc) return;
    if (!isDocumentVisible || document.visibilityState === 'hidden') return;
    if (pendingManualPlayRef.current) {
      pendingManualPlayRef.current = false;
      playCurrent();
      return;
    }
    if (!isPlayerVisible || userPausedRef.current) return;
    playCurrent();
  }, [isDocumentVisible, isPlayerVisible, manualPlayRequest, playbackAttempt?.id, playCurrent, selected?.id, selected?.videoSrc, shouldLoadVideo]);

  useEffect(() => () => {
    generationRef.current += 1;
    playAttemptRef.current += 1;
    cancelScheduledLoad();
    videoRef.current?.pause();
  }, [cancelScheduledLoad]);

  function resetForSelection(videoSrc: string) {
    generationRef.current += 1;
    playAttemptRef.current += 1;
    cancelScheduledLoad();
    videoRef.current?.pause();
    userPausedRef.current = false;
    pendingManualPlayRef.current = true;
    begin(videoSrc, 'user', { force: true });
    setContext({ intended: true });
    setHasUserPaused(false);
    setIsMuted(true);
    setStatus('loading');
    setProgress(0);
    setCurrentTime(0);
    setIsFrameReady(false);
    setShouldLoadVideo(true);
    setManualPlayRequest((value) => value + 1);
  }

  function selectAndPlay(index: number) {
    const next = items[index] ?? items[0];
    if (!next?.videoSrc) return;
    resetForSelection(next.videoSrc);
    setSelectedIndex(index);
  }

  function handlePlayToggle() {
    if (!selected?.videoSrc) return;
    if (!shouldLoadVideo) {
      resetForSelection(selected.videoSrc);
      return;
    }
    if (status === 'playing') {
      playAttemptRef.current += 1;
      userPausedRef.current = true;
      setContext({ intended: false });
      measurePause();
      setHasUserPaused(true);
      setStatus('paused');
      videoRef.current?.pause();
      return;
    }
    userPausedRef.current = false;
    setContext({ intended: true });
    pendingManualPlayRef.current = true;
    setHasUserPaused(false);
    if (status === 'error') {
      begin(selected.videoSrc, 'user', { force: true });
      setIsFrameReady(false);
      setStatus('loading');
    }
    setManualPlayRequest((value) => value + 1);
  }

  function isCurrentVideo(event: SyntheticEvent<HTMLVideoElement>) {
    return videoRef.current === event.currentTarget;
  }

  function handlePlaybackError(video: HTMLVideoElement, attemptId: number) {
    if (videoRef.current !== video) return;
    playAttemptRef.current += 1;
    setIsFrameReady(false);
    const failure = fail(attemptId, video.error?.code);
    if (failure === 'fallback') setStatus('loading');
    if (failure === 'terminal') setStatus('error');
  }

  return {
    selectedIndex,
    selected,
    status,
    isPlaying: status === 'playing',
    hasUserPaused,
    isMuted,
    currentTime,
    progress,
    shouldLoadVideo,
    playbackAttempt,
    canAutoplay,
    isFrameReady,
    playerRef,
    videoRef,
    selectAndPlay,
    handlePlayToggle,
    handleMuteToggle: () => setIsMuted((value) => !value),
    mediaHandlers: {
      onLoadedData(event: SyntheticEvent<HTMLVideoElement>) {
        if (!isCurrentVideo(event)) return;
        setIsFrameReady(true);
      },
      onPlaying(event: SyntheticEvent<HTMLVideoElement>) {
        if (!isCurrentVideo(event)) return;
        measurePlaying(event.currentTarget);
        setIsFrameReady(true);
        setStatus('playing');
      },
      onWaiting(event: SyntheticEvent<HTMLVideoElement>) {
        if (!isCurrentVideo(event)) return;
        measureWaiting();
        setStatus('loading');
      },
      onPause(event: SyntheticEvent<HTMLVideoElement>) {
        if (!isCurrentVideo(event)) return;
        measurePause();
        setStatus(userPausedRef.current ? 'paused' : 'loading');
      },
      onError(event: SyntheticEvent<HTMLVideoElement>) {
        if (!playbackAttempt) return;
        handlePlaybackError(event.currentTarget, playbackAttempt.id);
      },
      onTimeUpdate(event: SyntheticEvent<HTMLVideoElement>) {
        if (!isCurrentVideo(event)) return;
        const video = event.currentTarget;
        setCurrentTime(video.currentTime);
        if (video.duration && Number.isFinite(video.duration)) {
          setProgress(Math.min(100, (video.currentTime / video.duration) * 100));
        }
      },
    },
    onSourceError(event: SyntheticEvent<HTMLSourceElement>) {
      const video = event.currentTarget.parentElement as HTMLVideoElement | null;
      if (!video || !playbackAttempt) return;
      handlePlaybackError(video, playbackAttempt.id);
    },
  };
}
