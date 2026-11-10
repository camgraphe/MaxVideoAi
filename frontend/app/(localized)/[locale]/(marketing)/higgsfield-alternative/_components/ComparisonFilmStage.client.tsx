'use client';

import Image from 'next/image';
import { ArrowUpRight, Maximize, Minimize, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { HomeLcpPoster } from '@/components/marketing/home/HomeLcpPoster';
import { HERO_ENGINE_MEDIA } from '@/components/marketing/home/home-redesign-visuals';
import { usePublicVideoControls } from '@/components/media/usePublicVideoControls';
import type { AppLocale } from '@/i18n/locales';
import styles from './film-stage.module.css';

const uncrownedSource = HERO_ENGINE_MEDIA['flux-3-max']?.videoSrc;
if (!uncrownedSource) throw new Error('The Uncrowned is missing its public film source.');

const films = [
  {
    id: 'uncrowned',
    title: 'The Uncrowned',
    model: 'FLUX 3 Max',
    duration: 18,
    src: uncrownedSource,
    href: '/video/flux-3-max-the-uncrowned-dark-fantasy',
  },
  {
    id: 'vesper',
    title: 'Vesper Recast',
    model: 'MaxVideoAI Recast',
    duration: 14,
    src: 'https://media.maxvideoai.com/marketing-media/f45bb7e5-46e7-4e29-878f-49c84ec036f2/14fc9e43709951a0c5c2aad8f6eda7d78807bc463de525ce7e04d8e8c97e4114.mp4',
    href: '/video/b95c603e-2339-440e-b50e-7b7b2757da3c',
  },
] as const;

const labels = {
  en: {
    selection: 'Choose a film', play: 'Play', pause: 'Pause', retry: 'Retry',
    loading: 'Loading film…', unavailable: 'Film unavailable.', timeline: 'Playback position',
    mute: 'Mute', unmute: 'Unmute', fullscreen: 'Enter fullscreen', exitFullscreen: 'Exit fullscreen',
    fullscreenError: 'Fullscreen unavailable.', details: 'Film details',
    uncrownedAlt: 'An armoured queen walks through a sunlit stone hall.',
    vesperAlt: 'Vesper, a mantis in a pink jacket, stands beside a cyan sports car.',
  },
  fr: {
    selection: 'Choisir un film', play: 'Lire', pause: 'Mettre en pause', retry: 'Réessayer',
    loading: 'Chargement du film…', unavailable: 'Film indisponible.', timeline: 'Position de lecture',
    mute: 'Couper le son', unmute: 'Rétablir le son', fullscreen: 'Passer en plein écran', exitFullscreen: 'Quitter le plein écran',
    fullscreenError: 'Plein écran indisponible.', details: 'Détails du film',
    uncrownedAlt: 'Une reine en armure traverse une salle de pierre éclairée par le soleil.',
    vesperAlt: 'Vesper, une mante en veste rose, se tient près d’une voiture de sport cyan.',
  },
  es: {
    selection: 'Elegir un corto', play: 'Reproducir', pause: 'Pausar', retry: 'Reintentar',
    loading: 'Cargando el corto…', unavailable: 'Corto no disponible.', timeline: 'Posición de reproducción',
    mute: 'Silenciar', unmute: 'Activar el sonido', fullscreen: 'Activar pantalla completa', exitFullscreen: 'Salir de pantalla completa',
    fullscreenError: 'Pantalla completa no disponible.', details: 'Detalles del corto',
    uncrownedAlt: 'Una reina con armadura cruza un salón de piedra iluminado por el sol.',
    vesperAlt: 'Vesper, una mantis con chaqueta rosa, está junto a un coche deportivo cian.',
  },
} satisfies Record<AppLocale, Record<string, string>>;

type WebKitVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
};

function formatTime(time: number) {
  const seconds = Math.floor(Math.max(0, time));
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
}

export function ComparisonFilmStage({ locale }: { locale: AppLocale }) {
  const [selected, setSelected] = useState(0);
  const film = films[selected] ?? films[0];
  const copy = labels[locale];
  const frameRef = useRef<HTMLElement>(null);
  const playRef = useRef<HTMLButtonElement>(null);
  const [frameShownFor, setFrameShownFor] = useState<string | null>(null);
  const [fullscreenAvailable, setFullscreenAvailable] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState(false);
  const showFrame = useCallback(() => setFrameShownFor(film.id), [film.id]);
  const playback = usePublicVideoControls(film.src, 'comparison', 'auto', frameRef, showFrame);
  const covered = frameShownFor !== film.id || playback.terminalError;
  const playbackLabel = playback.terminalError ? copy.retry : playback.isPlaying ? copy.pause : copy.play;
  const status = playback.terminalError ? copy.unavailable : playback.isLoading ? copy.loading : fullscreenError ? copy.fullscreenError : '';

  useEffect(() => {
    const frame = frameRef.current;
    const video = playback.videoRef.current as WebKitVideo | null;
    const sync = () => setFullscreen(document.fullscreenElement === frame || Boolean(video?.webkitDisplayingFullscreen));
    setFullscreenAvailable(Boolean(
      (document.fullscreenEnabled && frame?.requestFullscreen) || video?.webkitEnterFullscreen
    ));
    sync();
    document.addEventListener('fullscreenchange', sync);
    video?.addEventListener('webkitbeginfullscreen', sync);
    video?.addEventListener('webkitendfullscreen', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      video?.removeEventListener('webkitbeginfullscreen', sync);
      video?.removeEventListener('webkitendfullscreen', sync);
    };
  }, [film.id, playback.videoRef]);

  function selectFilm(index: number) {
    if (index === selected) return;
    playback.pause();
    setFrameShownFor(null);
    setFullscreenError(false);
    setSelected(index);
  }

  async function toggleFullscreen() {
    const frame = frameRef.current;
    const video = playback.videoRef.current as WebKitVideo | null;
    setFullscreenError(false);
    try {
      if (document.fullscreenElement === frame && frame) {
        await document.exitFullscreen();
      } else if (video?.webkitDisplayingFullscreen) {
        video.webkitExitFullscreen?.();
      } else if (document.fullscreenEnabled && frame?.requestFullscreen) {
        await frame.requestFullscreen();
      } else {
        video?.webkitEnterFullscreen?.();
      }
    } catch {
      setFullscreenError(true);
    }
  }

  return (
    <figure className={styles.stage} ref={frameRef} data-film={film.id}>
      <video
        key={film.id}
        className={styles.video}
        ref={playback.videoRef}
        src={film.src}
        preload="none"
        playsInline
        aria-label={film.title}
        {...playback.events}
      />
      {covered ? (
        <div className={styles.poster} key={film.id + '-poster'}>
          {film.id === 'uncrowned' ? (
            <HomeLcpPoster alt={copy.uncrownedAlt} />
          ) : (
            <Image
              src="/assets/tools/character-studio/marketing/vesper-recast.webp"
              alt={copy.vesperAlt}
              fill
              sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1320px) 52vw, 680px"
            />
          )}
        </div>
      ) : null}
      {covered && !playback.isPlaying ? (
        <button
          type="button"
          className={styles.centerPlay}
          aria-label={playbackLabel + ' · ' + film.title}
          onClick={() => {
            playRef.current?.focus({ preventScroll: true });
            playback.togglePlayback();
          }}
        >
          {playback.terminalError ? <RotateCcw aria-hidden="true" /> : <Play fill="currentColor" aria-hidden="true" />}
        </button>
      ) : null}
      <div className={styles.status} role="status">{status}</div>

      <figcaption className={styles.controls}>
        <div className={styles.caption}>
          <span>{film.model} <span aria-hidden="true">/</span> {formatTime(film.duration)}</span>
          <a href={film.href}>{copy.details}<ArrowUpRight size={14} aria-hidden="true" /></a>
        </div>
        <div className={styles.transport}>
          <button
            ref={playRef}
            type="button"
            aria-label={playbackLabel}
            onClick={playback.togglePlayback}
          >
            {playback.terminalError ? <RotateCcw aria-hidden="true" /> : playback.isPlaying ? (
              <Pause fill="currentColor" aria-hidden="true" />
            ) : (
              <Play fill="currentColor" aria-hidden="true" />
            )}
          </button>
          <input
            className={styles.scrubber}
            type="range"
            min={0}
            max={playback.duration || film.duration}
            step={0.1}
            disabled={!playback.duration}
            value={Math.min(playback.currentTime, playback.duration || film.duration)}
            aria-label={copy.timeline}
            aria-valuetext={formatTime(playback.currentTime) + ' / ' + formatTime(playback.duration || film.duration)}
            onChange={(event) => playback.seek(event.currentTarget.value)}
          />
          <span className={styles.time} aria-hidden="true">{formatTime(playback.currentTime)} / {formatTime(playback.duration || film.duration)}</span>
          <button type="button" aria-label={playback.isMuted ? copy.unmute : copy.mute} onClick={playback.toggleMuted}>
            {playback.isMuted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
          </button>
          <button
            type="button"
            disabled={!fullscreenAvailable}
            aria-label={fullscreen ? copy.exitFullscreen : copy.fullscreen}
            onClick={() => void toggleFullscreen()}
          >
            {fullscreen ? <Minimize aria-hidden="true" /> : <Maximize aria-hidden="true" />}
          </button>
        </div>
        <div className={styles.selectors} role="group" aria-label={copy.selection}>
          {films.map((item, index) => (
            <button key={item.id} type="button" aria-pressed={selected === index} onClick={() => selectFilm(index)}>
              <span aria-hidden="true">{index === 0 ? '01' : '02'}</span>
              {item.title}
            </button>
          ))}
        </div>
      </figcaption>
    </figure>
  );
}
