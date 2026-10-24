'use client';

import type { VideoOperation } from '@/lib/video-operation';
import { planH3RelightCopy } from '@/lib/h3-source-operations';
import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pause, Play, Scissors, Music2, X } from 'lucide-react';
import { VideoExcerptTimeline, excerptTime } from './VideoExcerptTimeline.client';
import { useVideoExcerptFilmstrip } from './useVideoExcerptFilmstrip';
import { videoExcerptStyles } from './video-excerpt-styles';
import { useAccessibleModal } from '@/components/ui/useAccessibleModal';
import { videoExcerptCopy, videoExcerptFailureMessage } from '@/lib/video-excerpt-copy';
import {
  validateVideoExcerptRange,
  type VideoExcerptLimits,
  type VideoExcerptRange,
} from '@/lib/video-excerpt';

export type VideoExcerptSelectorProps = {
  operation?: VideoOperation;
  mediaKind?: 'video' | 'audio';
  previewUrl: string;
  previewPending?: boolean;
  previewError?: unknown;
  durationSec: number;
  limits: VideoExcerptLimits;
  locale: string;
  initialRange?: VideoExcerptRange;
  onApply: (range: VideoExcerptRange) => Promise<void>;
  onCancel: () => void;
};

/** Range preview is local. Only the explicit apply action may prepare owned media. */
export function VideoExcerptSelector({
  operation,
  mediaKind = 'video',
  previewUrl,
  previewPending = false,
  previewError,
  durationSec,
  limits,
  locale,
  initialRange,
  onApply,
  onCancel,
}: VideoExcerptSelectorProps) {
  const copy = videoExcerptCopy(locale, mediaKind);
  const Media = mediaKind === 'audio' ? 'audio' : 'video';
  const titleId = useId();
  const hintId = useId();
  const [start, setStart] = useState(String(initialRange?.startSec ?? 0));
  const [end, setEnd] = useState(String(initialRange?.endSec ?? durationSec));
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const video = useRef<HTMLMediaElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [previewIntent, setPreviewIntent] = useState(false);
  const pendingSeek = useRef<number | null>(null);
  const previewRequested = useRef(false);
  const frames = useVideoExcerptFilmstrip(previewUrl, durationSec, previewIntent && mediaKind === 'video');
  const { dialogRef, onDialogKeyDown } = useAccessibleModal({ onClose: onCancel });
  const range = { startSec: start.trim() ? Number(start) : NaN, endSec: end.trim() ? Number(end) : NaN };
  // Playback may inspect a source before its selected length meets the model policy.
  const previewRange =
    Number.isFinite(durationSec) &&
    durationSec > 0 &&
    Number.isFinite(range.startSec) &&
    Number.isFinite(range.endSec) &&
    range.startSec >= 0 &&
    range.endSec > range.startSec &&
    range.endSec <= durationSec
      ? range
      : null;
  let copyPlan: ReturnType<typeof planH3RelightCopy> | undefined;
  if (operation === 'h3-relight') {
    try { copyPlan = planH3RelightCopy(range.endSec-range.startSec); } catch { /* range validation below */ }
  }
  const number = (value: number) => new Intl.NumberFormat(locale, {maximumFractionDigits: 6}).format(value);
  const copyNotice = copyPlan ? (locale.startsWith('fr')
    ? `Copie à 24 images/s : sélection ${number(range.endSec-range.startSec)} s, durée réelle ${number(copyPlan.durationSec)} s (${copyPlan.frameCount} images). ${number(copyPlan.removedEndSec)} s retirée(s) à la fin. Original, cadrage et audio conservés.`
    : locale.startsWith('es') ? `Copia a 24 fps: selección ${number(range.endSec-range.startSec)} s, duración real ${number(copyPlan.durationSec)} s (${copyPlan.frameCount} fotogramas). Se eliminan ${number(copyPlan.removedEndSec)} s del final. Se conservan el original, el encuadre y el audio.`
    : `24 fps copy: selected ${number(range.endSec-range.startSec)} s, actual ${number(copyPlan.durationSec)} s (${copyPlan.frameCount} frames). Removes ${number(copyPlan.removedEndSec)} s from the end. Original, framing and audio are retained.`)
    : operation === 'flux-fast-edit' ? (locale.startsWith('fr') ? 'Préparer une copie MP4 compatible, même pour la vidéo entière. L’original, le cadrage et l’audio sont conservés.'
      : locale.startsWith('es') ? 'Preparar una copia MP4 compatible, incluso del vídeo completo. Se conservan el original, el encuadre y el audio.'
      : 'Prepare a compatible MP4 copy, including when the whole video is selected. Original, framing and audio are retained.') : null;
  let valid = !previewPending && !previewError && (operation !== 'h3-relight' || Boolean(copyPlan))
    && (operation !== 'flux-fast-edit' || range.endSec - range.startSec < 15);
  try {
    validateVideoExcerptRange(range, durationSec, limits);
  } catch {
    valid = false;
  }
  const seek = (seconds: number) => {
    if (!previewUrl || busy || !Number.isFinite(seconds)) return;
    const next = Math.max(0, Math.min(durationSec, seconds));
    setPreviewIntent(true);
    setPlaying(false);
    setCurrentTime(next);
    const node = video.current;
    if (!node) return;
    node.pause();
    pendingSeek.current = next;
    node.currentTime = next;
    if (node.readyState === 0) {
      if (!previewRequested.current) { previewRequested.current = true; node.load(); }
    } else pendingSeek.current = null;
  };
  const change = (which: 'start' | 'end', value: string) => {
    video.current?.pause();
    setError(null);
    (which === 'start' ? setStart : setEnd)(value);
    if (value.trim() && Number.isFinite(Number(value))) seek(Number(value));
  };
  const apply = async () => {
    if (!valid || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    video.current?.pause();
    try {
      await onApply(range);
    } catch (failure) {
      setError(videoExcerptFailureMessage(failure, locale, mediaKind));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return createPortal(
    <div
      className="app-experience app-reference-modal-layer video-excerpt-layer"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={hintId}
        tabIndex={-1}
        className="app-reference-popup video-excerpt-dialog"
        onKeyDown={onDialogKeyDown}
        aria-busy={busy}
      >
        <header className="video-excerpt-heading">
          <div><span className="video-excerpt-eyebrow"><Scissors size={13} aria-hidden="true" />{copy.timeline}</span><h2 id={titleId}>{copy.title}</h2></div>
          <button type="button" className="video-excerpt-close" aria-label={copy.close} onClick={onCancel}><X size={19} aria-hidden="true" /></button>
        </header>
        <div className="video-excerpt-stage" style={mediaKind === 'audio' ? { aspectRatio: 'auto', height: 80, minHeight: 80 } : undefined}>
        {mediaKind === 'audio' ? <span className="video-excerpt-stage-mark" aria-hidden="true"><Music2 size={26} /></span> : null}
        {previewUrl ? <Media
          ref={(node) => { video.current = node; }}
          src={previewUrl}
          playsInline
          preload="none"
          onLoadedMetadata={(event) => {
            if (pendingSeek.current !== null) { event.currentTarget.currentTime = pendingSeek.current; pendingSeek.current = null; }
          }}
          onPlay={(event) => {
            const node = event.currentTarget;
            if (busy) { node.pause(); return; }
            setPreviewIntent(true);
            previewRequested.current = true;
            setPlaying(true);
            if (previewRange && (node.currentTime < previewRange.startSec || node.currentTime >= previewRange.endSec)) node.currentTime = previewRange.startSec;
          }}
          onPause={() => setPlaying(false)}
          onEnded={(event) => {
            if (!previewRange || busy) return;
            event.currentTarget.currentTime = previewRange.startSec;
            void event.currentTarget.play().catch(() => setPlaying(false));
          }}
          onTimeUpdate={(event) => {
            const node = event.currentTarget;
            if (!node.paused && previewRange && (node.currentTime >= previewRange.endSec || node.currentTime < previewRange.startSec)) node.currentTime = previewRange.startSec;
            setCurrentTime(node.currentTime);
          }}
          onSeeked={(event) => setCurrentTime(event.currentTarget.currentTime)}
        /> : null}
        {mediaKind === 'video' && !previewIntent && !previewPending ? <span className="video-excerpt-stage-mark" aria-hidden="true"><Play size={27} strokeWidth={1.5}/></span> : null}
        </div>
        <div className="video-excerpt-transport">
          <button type="button" className="video-excerpt-play" aria-label={playing ? copy.pause : copy.play} disabled={busy || !previewUrl || previewPending || Boolean(previewError)} onClick={()=>{
            const node=video.current;
            if (!node) return;
            setPreviewIntent(true);
            if (playing) node.pause();
            else void node.play().catch(()=>setPlaying(false));
          }}>{playing ? <Pause size={16} fill="currentColor" aria-hidden="true"/> : <Play size={16} fill="currentColor" aria-hidden="true"/>}<span>{playing ? copy.pause : copy.play}</span></button>
          <div className="video-excerpt-time"><strong>{excerptTime(currentTime)}</strong><span>/ {excerptTime(durationSec)}</span></div>
        </div>
        {previewPending ? <p role="status">{copy.loadingPreview}</p> : null}
        {previewError ? <p role="alert">{videoExcerptFailureMessage(previewError, locale, mediaKind)}</p> : null}
        <VideoExcerptTimeline durationSec={durationSec} range={range} currentTime={currentTime} disabled={busy || !previewUrl || previewPending || Boolean(previewError)} copy={copy} frames={frames} onSeek={seek} onRangeChange={(next, time)=>{
          setError(null);setStart(String(next.startSec));setEnd(String(next.endSec));seek(time);
        }}/>
        <div className="video-excerpt-precision">
          {(['start', 'end'] as const).map((which) => <label key={which}>
            <span>{which === 'start' ? copy.inPoint : copy.outPoint}</span>
            <span className="video-excerpt-number"><input type="number" aria-label={copy[which]} min={0} max={durationSec} step="any" value={which === 'start' ? start : end} disabled={busy} onChange={event=>change(which,event.target.value)}/><span aria-hidden="true">s</span></span>
          </label>)}
          <div className="video-excerpt-duration" aria-live="polite"><span>{copy.length}</span><strong>{Number.isFinite(range.endSec-range.startSec) ? new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(range.endSec-range.startSec) : '—'} <small>s</small></strong></div>
        </div>
        <p className="video-excerpt-limits">{copy.limits}: {limits.minDurationSec ?? 0}–{limits.maxDurationSec ?? '∞'} s</p>
        {!valid ? <p role="alert">{copy.invalid}</p> : null}
        {error ? <p role="alert">{error}</p> : null}
        {copyNotice ? <p data-testid="video-compatible-copy-disclosure" role="status">{copyNotice}</p> : null}
        <p id={hintId}>{copy.quote}</p>
        <div className="video-excerpt-actions">
          <button type="button" data-modal-initial-focus="true" onClick={onCancel}>
            {copy.cancel}
          </button>
          <button type="button" disabled={!valid || busy} onClick={() => void apply()}>
            {busy ? copy.busy : copy.apply}
          </button>
        </div>
      </div>
      <style>{videoExcerptStyles}</style>
    </div>,
    document.body
  );
}
