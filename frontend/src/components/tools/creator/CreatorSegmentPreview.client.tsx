'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Pause, ScanLine } from 'lucide-react';
import type { CreatorSource } from './creator-source-selection';
import { creatorWorkspaceCopy } from './creator-workspace-copy';
import styles from './creator-workspace.module.css';

const labels = {
  en: { preview: 'Reference player', start: 'Set start here', end: 'Set end here', play: 'Play passage', pause: 'Pause passage', hint: 'Play or scrub the reference, then set your start and end points.', invalid: 'Choose an end after the start, within the reference duration.' },
  fr: { preview: 'Lecteur de la référence', start: 'Début ici', end: 'Fin ici', play: 'Lire le passage', pause: 'Mettre en pause', hint: 'Parcourez la référence, puis posez les points de début et de fin.', invalid: 'La fin doit suivre le début et rester dans la durée de la référence.' },
  es: { preview: 'Reproductor de referencia', start: 'Inicio aquí', end: 'Fin aquí', play: 'Reproducir fragmento', pause: 'Pausar fragmento', hint: 'Reproduce o recorre la referencia y marca el inicio y el final.', invalid: 'El final debe estar después del inicio y dentro de la duración de la referencia.' },
};

/** Selected private references retain their exact URL and load only on playback intent. */
export function CreatorSegmentPreview({ locale, source, start, end, disabled, onMark }: {
  locale: string; source: CreatorSource; start: string; end: string; disabled: boolean;
  onMark(boundary: 'start' | 'end', seconds: string): void;
}) {
  const copy = labels[locale as keyof typeof labels] ?? labels.en, workspaceCopy = creatorWorkspaceCopy(locale);
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const selection = useRef<{ start: number; end: number } | null>(null);
  const frame = useRef<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null), [playingPassage, setPlayingPassage] = useState(false), [failed, setFailed] = useState(false);
  const startSec = Number(start), endSec = Number(end), limit = duration ?? source.durationSec;
  const valid = start.trim() !== '' && end.trim() !== '' && Number.isFinite(startSec) && Number.isFinite(endSec)
    && startSec >= 0 && endSec > startSec && (limit == null || endSec <= limit + 0.001);

  function clearFrame() { if (frame.current != null) cancelAnimationFrame(frame.current); frame.current = null; }
  function stopPassage() { selection.current = null; clearFrame(); setPlayingPassage(false); }
  function checkBoundary() {
    const media = mediaRef.current, passage = selection.current;
    if (media && passage && (media.currentTime >= passage.end || media.currentTime < passage.start - 0.05)) {
      media.pause(); media.currentTime = media.currentTime >= passage.end ? passage.end : passage.start; stopPassage();
    }
  }
  function trackBoundary() {
    checkBoundary();
    if (selection.current && mediaRef.current && !mediaRef.current.paused) frame.current = requestAnimationFrame(trackBoundary);
  }
  useEffect(() => {
    // An edit cancels only passage playback; ordinary reference scrubbing remains available.
    if (selection.current) { selection.current = null; mediaRef.current?.pause(); clearFrame(); setPlayingPassage(false); }
  }, [start, end]);
  useEffect(() => {
    const media = mediaRef.current;
    return () => { selection.current = null; clearFrame(); if (media && !media.paused) media.pause(); };
  }, []);

  async function playPassage() {
    const media = mediaRef.current;
    if (!media || !valid) return;
    if (playingPassage) { media.pause(); stopPassage(); return; }
    selection.current = { start: startSec, end: endSec }; setFailed(false);
    media.currentTime = startSec;
    try { await media.play(); } catch (error) {
      if (mediaRef.current !== media || !selection.current) return;
      stopPassage();
      if (!(error instanceof DOMException && error.name === 'AbortError')) setFailed(true);
    }
  }
  function mark(boundary: 'start' | 'end') {
    if (mediaRef.current && duration != null) onMark(boundary, String(Number(mediaRef.current.currentTime.toFixed(3))));
  }
  const mediaProps = {
    src: source.url, controls: true, preload: 'none', 'aria-label': `${copy.preview} — ${source.name}`, 'data-creator-segment': true,
    onLoadedMetadata: () => {
      const media = mediaRef.current;
      if (!media) return;
      setDuration(Number.isFinite(media.duration) ? media.duration : null);
      if (selection.current) media.currentTime = selection.current.start;
    },
    onPlay: () => { setFailed(false); setPlayingPassage(Boolean(selection.current)); clearFrame(); trackBoundary(); },
    onPause: stopPassage, onEnded: stopPassage, onTimeUpdate: checkBoundary,
    onError: () => { stopPassage(); setFailed(true); },
  };
  return <div className={styles.segmentPreview}>
    {source.ref.kind === 'audio'
      ? <audio {...mediaProps} ref={node => { mediaRef.current = node; }} />
      : <video {...mediaProps} ref={node => { mediaRef.current = node; }} poster={source.thumbnailUrl ?? undefined} playsInline />}
    <small>{copy.hint}</small>
    <div className={styles.segmentMarks}>
      <button type="button" disabled={disabled || duration == null} onClick={() => mark('start')}><ScanLine size={14} aria-hidden="true" />{copy.start}</button>
      <button type="button" disabled={disabled || duration == null} onClick={() => mark('end')}><ScanLine size={14} aria-hidden="true" />{copy.end}</button>
    </div>
    <button type="button" className={styles.segmentPlay} disabled={!valid} onClick={playPassage}>{playingPassage ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}{playingPassage ? copy.pause : copy.play}</button>
    {!valid ? <small role="status">{copy.invalid}</small> : null}
    {failed ? <p className={styles.error} role="alert">{workspaceCopy.previewError}</p> : null}
  </div>;
}
