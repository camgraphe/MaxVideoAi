'use client';

import { useEffect, useState } from 'react';
import type { getRecastTiming } from '@/lib/character-studio-recast-timing';
import { RECAST_MIN_SECONDS } from '@/lib/character-studio-recast-timing';
import type { StudioCopy } from '../_lib/character-studio-copy';
import { getRecastReadinessCopy } from '../_lib/recast-readiness-copy';

type Price = { key: string; attempt: number; amount: string | null };

export function CharacterStudioRecastTiming({
  copy,
  timing,
  resolution,
  aspectRatio,
  sourceSeconds,
  hasVideo,
  pendingHint,
  hasAudio,
  manual,
  mode,
  onManual,
  ready,
  settingsVisible = true,
  showPrice = true,
}: {
  copy: StudioCopy;
  timing: ReturnType<typeof getRecastTiming>;
  resolution: string;
  aspectRatio: string;
  sourceSeconds: number | null;
  hasVideo: boolean;
  pendingHint: string | null;
  hasAudio: boolean;
  manual: number | null;
  mode: 'i2v' | 'v2v' | 'ref2v';
  onManual: (seconds: number | null) => void;
  ready: boolean;
  settingsVisible?: boolean;
  showPrice?: boolean;
}) {
  const [price, setPrice] = useState<Price | null>(null);
  const [attempt, setAttempt] = useState(0);
  const readiness = getRecastReadinessCopy(copy.recastLocale);
  const key =
    ready && timing.valid
      ? JSON.stringify({
          mode,
          resolution,
          aspectRatio,
          seconds: timing.seconds,
          sourceSeconds: sourceSeconds ?? 0,
          audio: hasAudio,
        })
      : '';
  useEffect(() => {
    if (!key) return;
    const request = new AbortController();
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(async () => {
      deadline = setTimeout(() => {
        if (request.signal.aborted) return;
        setPrice({ key, attempt, amount: null });
        request.abort();
      }, 15000);
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
          quote.amountCents <= 0 ||
          quote.currency !== 'USD'
        )
          throw new Error();
        const amount = new Intl.NumberFormat(copy.recastLocale, {
          style: 'currency',
          currency: quote.currency,
        }).format(quote.amountCents / 100);
        if (!request.signal.aborted) setPrice({ key, attempt, amount });
      } catch {
        if (!request.signal.aborted) setPrice({ key, attempt, amount: null });
      } finally {
        clearTimeout(deadline);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      clearTimeout(deadline);
      request.abort();
    };
  }, [key, attempt, copy.recastLocale]);
  const current = key && price?.key === key && price.attempt === attempt ? price : null;
  const loading = Boolean(key && !current);
  const failed = Boolean(current && current.amount === null);
  const suggestion = hasVideo ? copy.sourceTiming : copy.autoTiming;
  return (
    <div className="space-y-2">
      <div className={`${settingsVisible ? 'block' : 'hidden'} space-y-2 rounded-xl border border-border bg-bg p-3 lg:block`}>
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
      </div>
      </div>
      {timing.speechTooLong && <p role="status" className="text-xs text-text-secondary">{copy.shortDuration}</p>}
      {showPrice && <>
      <div className="flex justify-between gap-2 border-t border-border pt-2 text-sm" aria-live="polite" aria-busy={loading}>
        <span>{copy.recastPrice.replace('{resolution}', resolution)}</span>
        <strong className="text-right">{!key ? '—' : loading ? readiness.estimating : current?.amount ?? copy.noPrice}</strong>
      </div>
      {!key && <p className="text-xs text-text-secondary">{pendingHint ?? (!timing.valid ? readiness.duration : readiness.completeInputs)}</p>}
      {failed && <div data-recast-estimate-error className="space-y-1 text-xs">
        <p role="alert" className="text-text-secondary">{readiness.estimateFailed}</p>
        <button type="button" data-recast-retry-estimate onClick={() => setAttempt(value => value + 1)} className="min-h-9 font-medium underline underline-offset-4">
          {readiness.retryEstimate}
        </button>
      </div>}
      </>}
    </div>
  );
}
