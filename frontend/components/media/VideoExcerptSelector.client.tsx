'use client';

import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAccessibleModal } from '@/components/ui/useAccessibleModal';
import { videoExcerptCopy } from '@/lib/video-excerpt-copy';
import {
  validateVideoExcerptRange,
  type VideoExcerptLimits,
  type VideoExcerptRange,
} from '@/lib/video-excerpt';

export type VideoExcerptSelectorProps = {
  previewUrl: string;
  durationSec: number;
  limits: VideoExcerptLimits;
  locale: string;
  initialRange?: VideoExcerptRange;
  onApply: (range: VideoExcerptRange) => Promise<void>;
  onCancel: () => void;
};

/** Range preview is local. Only the explicit apply action may prepare owned media. */
export function VideoExcerptSelector({
  previewUrl,
  durationSec,
  limits,
  locale,
  initialRange,
  onApply,
  onCancel,
}: VideoExcerptSelectorProps) {
  const copy = videoExcerptCopy(locale);
  const titleId = useId();
  const hintId = useId();
  const [start, setStart] = useState(String(initialRange?.startSec ?? 0));
  const [end, setEnd] = useState(String(initialRange?.endSec ?? durationSec));
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const { dialogRef, onDialogKeyDown } = useAccessibleModal({ onClose: onCancel });
  const range = { startSec: start.trim() ? Number(start) : NaN, endSec: end.trim() ? Number(end) : NaN };
  let valid = true;
  try {
    validateVideoExcerptRange(range, durationSec, limits);
  } catch {
    valid = false;
  }
  const change = (which: 'start' | 'end', value: string) => {
    video.current?.pause();
    setError(null);
    (which === 'start' ? setStart : setEnd)(value);
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
      setError(failure instanceof Error ? failure.message : copy.failed);
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
        <h2 id={titleId}>{copy.title}</h2>
        <video
          ref={video}
          src={previewUrl}
          controls
          playsInline
          preload="none"
          onPlay={(event) => {
            const node = event.currentTarget;
            if (!valid) {
              node.pause();
              return;
            }
            if (node.currentTime < range.startSec || node.currentTime >= range.endSec)
              node.currentTime = range.startSec;
          }}
          onEnded={(event) => {
            if (!valid || busy) return;
            event.currentTarget.currentTime = range.startSec;
            void event.currentTarget.play().catch(() => {});
          }}
          onTimeUpdate={(event) => {
            const node = event.currentTarget;
            if (
              !node.paused &&
              valid &&
              (node.currentTime >= range.endSec || node.currentTime < range.startSec)
            )
              node.currentTime = range.startSec;
          }}
        />
        {(['start', 'end'] as const).map((which) => (
          <div className="video-excerpt-control" key={which}>
            <label>
              {copy[which]}
              <input
                type="number"
                aria-label={copy[which]}
                min={0}
                max={durationSec}
                step="any"
                value={which === 'start' ? start : end}
                disabled={busy}
                onChange={(event) => change(which, event.target.value)}
              />
            </label>
            <input
              type="range"
              aria-label={`${copy[which]} · slider`}
              min={0}
              max={durationSec}
              step="any"
              value={
                Number.isFinite(range[which === 'start' ? 'startSec' : 'endSec'])
                  ? range[which === 'start' ? 'startSec' : 'endSec']
                  : 0
              }
              disabled={busy}
              onChange={(event) => change(which, event.target.value)}
            />
          </div>
        ))}
        <p aria-live="polite">
          {copy.length}:{' '}
          {Number.isFinite(range.endSec - range.startSec)
            ? Number((range.endSec - range.startSec).toFixed(6))
            : '—'}{' '}
          s · {copy.limits}: {limits.minDurationSec ?? 0}–{limits.maxDurationSec ?? '∞'} s
        </p>
        {!valid ? <p role="alert">{copy.invalid}</p> : null}
        {error ? <p role="alert">{error}</p> : null}
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
      <style>{`.video-excerpt-layer{z-index:120}.video-excerpt-dialog{width:min(100% - 24px,560px);display:grid;gap:12px;padding:20px;max-height:calc(100dvh - 24px);overflow:auto}.video-excerpt-dialog h2{font-size:18px;font-weight:600}.video-excerpt-dialog video{width:100%;height:230px;object-fit:contain;background:#101114;border-radius:10px}.video-excerpt-control{display:grid;gap:2px}.video-excerpt-control label{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:13px}.video-excerpt-control input[type=number]{width:130px;min-height:44px;padding:8px;border:1px solid var(--border-color,#999);border-radius:8px;background:transparent}.video-excerpt-control input[type=range]{width:100%;min-height:44px;accent-color:#d69e22}.video-excerpt-dialog p{font-size:12px}.video-excerpt-actions{display:flex;justify-content:flex-end;gap:10px}.video-excerpt-actions button{min-height:44px;padding:8px 16px;border:1px solid var(--border-color,#999);border-radius:8px}.video-excerpt-actions button:disabled{opacity:.45}.video-excerpt-dialog [role=alert]{color:var(--color-error,#b83d3d)}@media(max-width:600px){.video-excerpt-dialog video{height:190px}.video-excerpt-dialog{padding:16px}}`}</style>
    </div>,
    document.body
  );
}
