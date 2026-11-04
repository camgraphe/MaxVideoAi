'use client';

import { useEffect, useState } from 'react';
import type { getRecastTiming } from '@/lib/character-studio-recast-timing';
import { RECAST_MIN_SECONDS } from '@/lib/character-studio-recast-timing';
import type { StudioCopy } from '../_lib/character-studio-copy';

type Price = { key: string; amount: string | null };

export function CharacterStudioRecastTiming({
  copy,
  timing,
  sourceSeconds,
  hasVideo,
  pendingHint,
  hasAudio,
  manual,
  mode,
  onManual,
  ready,
}: {
  copy: StudioCopy;
  timing: ReturnType<typeof getRecastTiming>;
  sourceSeconds: number | null;
  hasVideo: boolean;
  pendingHint: string | null;
  hasAudio: boolean;
  manual: number | null;
  mode: 'i2v' | 'v2v' | 'ref2v';
  onManual: (seconds: number | null) => void;
  ready: boolean;
}) {
  const [price, setPrice] = useState<Price | null>(null);
  const key =
    ready && timing.valid
      ? JSON.stringify({ mode, seconds: timing.seconds, sourceSeconds: sourceSeconds ?? 0, audio: hasAudio })
      : '';
  useEffect(() => {
    if (!key) return;
    const request = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/tools/character-studio/recast/estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: key,
          signal: request.signal,
        });
        const quote = await response.json();
        if (
          !response.ok ||
          quote.status !== 'estimated' ||
          !Number.isSafeInteger(quote.amountCents) ||
          quote.currency !== 'USD'
        )
          throw new Error();
        const amount = new Intl.NumberFormat(copy.recastLocale, {
          style: 'currency',
          currency: quote.currency,
        }).format(quote.amountCents / 100);
        if (!request.signal.aborted) setPrice({ key, amount });
      } catch {
        if (!request.signal.aborted) setPrice({ key, amount: null });
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      request.abort();
    };
  }, [key, copy.recastLocale]);
  const suggestion = hasVideo ? copy.sourceTiming : copy.autoTiming;
  return (
    <div className="space-y-2 rounded-xl border border-border bg-bg p-3">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-medium" htmlFor="recast-duration">
          {copy.clipDuration}
        </label>
        <select
          id="recast-duration"
          value={timing.valid ? timing.seconds : ''}
          onChange={(event) => onManual(Number(event.target.value))}
          className="rounded-md border border-border bg-surface px-2 py-1 text-sm"
        >
          {!timing.valid && (
            <option value="" disabled>
              {copy.chooseDuration}
            </option>
          )}
          {Array.from(
            { length: timing.maximum - RECAST_MIN_SECONDS + 1 },
            (_, i) => RECAST_MIN_SECONDS + i,
          ).map((n) => (
            <option key={n} value={n}>
              {n} s
            </option>
          ))}
        </select>
      </div>
      <div className="text-xs leading-relaxed text-text-secondary">
        <span>{pendingHint ?? suggestion.replace('{seconds}', String(timing.suggested))}</span>
        {manual !== null && (
          <button type="button" onClick={() => onManual(null)} className="ml-2 underline">
            {copy.restoreAuto}
          </button>
        )}
        {timing.words > 0 && (
          <p>
            {copy.voiceTiming
              .replace('{words}', String(timing.words))
              .replace('{seconds}', String(timing.speechSeconds))}
          </p>
        )}
        {!timing.valid && <p role="status">{copy.durationLimit.replace('{max}', String(timing.maximum))}</p>}
        {timing.speechTooLong && <p role="status">{copy.shortDuration}</p>}
      </div>
      <div className="flex justify-between gap-2 border-t border-border pt-2 text-sm" aria-live="polite">
        <span>{copy.recastPrice}</span>
        <strong>{!key ? '—' : price?.key === key ? (price.amount ?? copy.noPrice) : '…'}</strong>
      </div>
    </div>
  );
}
