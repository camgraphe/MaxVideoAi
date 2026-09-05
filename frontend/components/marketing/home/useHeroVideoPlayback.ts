'use client';

import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react';

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
  const [mediaAttempt, setMediaAttempt] = useState(0);
  const playerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const idleHandleRef = useRef<number | null>(null);
  const idleUsesRequestRef = useRef(false);
  const generationRef = useRef(0);
  const playAttemptRef = useRef(0);
  const userPausedRef = useRef(false);
  const pendingManualPlayRef = useRef(false);
  const selected = items[selectedIndex] ?? items[0];

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
  }, []);

  const pauseForEnvironment = useCallback(() => {
    playAttemptRef.current += 1;
    videoRef.current?.pause();
  }, []);

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
      setIsPlayerVisible(visible);
      if (!visible) pauseForEnvironment();
    }, { threshold: 0.01 });
    observer.observe(player);
    return () => observer.disconnect();
  }, [pauseForEnvironment]);

  useEffect(() => {
    const updateVisibility = () => {
      const visible = document.visibilityState !== 'hidden';
      setIsDocumentVisible(visible);
      if (!visible) pauseForEnvironment();
    };
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, [pauseForEnvironment]);

  useEffect(() => {
    cancelScheduledLoad();
    if (shouldLoadVideo || !selected?.videoSrc || !canAutoplay || !isPlayerVisible || !isDocumentVisible) return;
    const generation = generationRef.current;
    const loadPreview = () => {
      idleHandleRef.current = null;
      if (generationRef.current !== generation) return;
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
  }, [canAutoplay, cancelScheduledLoad, isDocumentVisible, isPlayerVisible, selected?.id, selected?.videoSrc, shouldLoadVideo]);

  useEffect(() => {
    if (!shouldLoadVideo || !selected?.videoSrc) return;
    if (pendingManualPlayRef.current) {
      pendingManualPlayRef.current = false;
      playCurrent();
      return;
    }
    if (!isPlayerVisible || !isDocumentVisible || userPausedRef.current) return;
    playCurrent();
  }, [isDocumentVisible, isPlayerVisible, manualPlayRequest, mediaAttempt, playCurrent, selected?.id, selected?.videoSrc, shouldLoadVideo]);

  useEffect(() => () => {
    generationRef.current += 1;
    playAttemptRef.current += 1;
    cancelScheduledLoad();
    videoRef.current?.pause();
  }, [cancelScheduledLoad]);

  function resetForSelection() {
    generationRef.current += 1;
    playAttemptRef.current += 1;
    cancelScheduledLoad();
    videoRef.current?.pause();
    userPausedRef.current = false;
    pendingManualPlayRef.current = true;
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
    resetForSelection();
    setSelectedIndex(index);
  }

  function handlePlayToggle() {
    if (!selected?.videoSrc) return;
    if (!shouldLoadVideo) {
      resetForSelection();
      return;
    }
    if (status === 'playing') {
      playAttemptRef.current += 1;
      userPausedRef.current = true;
      setHasUserPaused(true);
      setStatus('paused');
      videoRef.current?.pause();
      return;
    }
    userPausedRef.current = false;
    pendingManualPlayRef.current = true;
    setHasUserPaused(false);
    if (status === 'error') {
      setIsFrameReady(false);
      setStatus('loading');
      setMediaAttempt((value) => value + 1);
    }
    setManualPlayRequest((value) => value + 1);
  }

  function isCurrentVideo(event: SyntheticEvent<HTMLVideoElement>) {
    return videoRef.current === event.currentTarget;
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
    canAutoplay,
    isFrameReady,
    mediaAttempt,
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
        setIsFrameReady(true);
        setStatus('playing');
      },
      onWaiting(event: SyntheticEvent<HTMLVideoElement>) {
        if (!isCurrentVideo(event)) return;
        setStatus('loading');
      },
      onStalled(event: SyntheticEvent<HTMLVideoElement>) {
        if (!isCurrentVideo(event)) return;
        setStatus('loading');
      },
      onPause(event: SyntheticEvent<HTMLVideoElement>) {
        if (!isCurrentVideo(event)) return;
        setStatus(userPausedRef.current ? 'paused' : 'loading');
      },
      onError(event: SyntheticEvent<HTMLVideoElement>) {
        if (!isCurrentVideo(event)) return;
        playAttemptRef.current += 1;
        setIsFrameReady(false);
        setStatus('error');
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
  };
}
