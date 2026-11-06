'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { StudioCopy } from '../_lib/character-studio-copy';
import type { RecastSetup, RecastQuote, UploadCache } from '../_lib/recast-submit';
import { getRecastReadinessCopy } from '../_lib/recast-readiness-copy';
import { getRecastSessionCopy } from '../_lib/recast-session-copy';

export function CharacterStudioRecastSubmit({
  copy,
  setup,
  cache,
  onLock,
  blockedReasonId,
  onReviewed,
}: {
  copy: StudioCopy;
  setup: RecastSetup | null;
  cache: UploadCache;
  onLock: (v: boolean) => void;
  blockedReasonId?: string;
  onReviewed?: (value: boolean) => void;
}) {
  const [quote, setQuote] = useState<RecastQuote | null>(null);
  const [job, setJob] = useState<{ jobId: string; status: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recovering, setRecovering] = useState(false);
  const [needsFunds, setNeedsFunds] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  useEffect(() => {
    onReviewed?.(Boolean(quote));
    return () => onReviewed?.(false);
  }, [quote, onReviewed]);
  const flight = useRef(false);
  const cancel = useRef<AbortController | null>(null);
  const sessionCopy = getRecastSessionCopy(copy.recastLocale);
  useEffect(() => () => cancel.current?.abort(), []);
  function cancelPreparation() {
    if (quote || !busy) return;
    cancel.current?.abort();
    cancel.current = null;
    flight.current = false;
    setBusy(false);
    setError('');
  }
  useEffect(() => {
    if (quote?.kind !== 'wallet' || job || busy || recovering) return;
    const timer = setTimeout(
      () => {
        setQuote(null);
        setError(copy.expiredQuote);
      },
      Math.max(0, Date.parse(quote.expiresAt) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [quote, job, busy, recovering, copy.expiredQuote]);
  const seconds = new Intl.NumberFormat(copy.recastLocale, {
    maximumFractionDigits: 3,
  });
  const amount = quote
    ? new Intl.NumberFormat(copy.recastLocale, {
        style: 'currency',
        currency: quote.currency,
      }).format(quote.amountCents / 100)
    : '';
  async function run() {
    if (!setup || flight.current || job || quote?.kind === 'rehearsal') return;
    flight.current = true;
    setBusy(true);
    setError('');
    const controller = new AbortController();
    cancel.current = controller;
    if (quote) onLock(true);
    let uncertain = recovering;
    try {
      const api = await import('../_lib/recast-submit');
      if (quote) {
        // Accepted quotes remain recoverable after expiry. Never replace an uncertain purchase.
        if (!recovering && Date.parse(quote.expiresAt) <= Date.now()) throw new Error('QUOTE_EXPIRED');
        uncertain = true;
        const accepted = await api.confirmRecastQuote(quote);
        uncertain = false;
        if (!controller.signal.aborted) setJob(accepted);
      } else {
        const prepared = await api.prepareRecastQuote(setup, cache, controller.signal);
        if (!controller.signal.aborted) {
          setQuote(prepared);
          setNeedsFunds(false);
        }
      }
    } catch (e) {
      if (controller.signal.aborted) return;
      const code = e instanceof Error ? e.message : '';
      if (code === 'QUOTE_EXPIRED' || code === 'PRICING_REFRESH_REQUIRED') {
        uncertain = false;
        setQuote(null);
        setError(copy.expiredQuote);
      } else {
        const messages: Record<string, string> = {
          AUTH_REQUIRED: copy.signInRecast,
          INSUFFICIENT_FUNDS: copy.topupQuote,
          REFERENCE_INVALID: copy.invalidPassage,
          REFERENCE_NOT_FOUND: copy.invalidPassage,
          PARAMETER_INVALID: getRecastReadinessCopy(copy.recastLocale).invalidSettings,
          PREPARATION_LIMIT: copy.invalidPassage,
          RECAST_STORAGE_UNAVAILABLE: copy.storageUnavailable,
          ENGINE_UNAVAILABLE: copy.engineUnavailable,
          RENDER_DEFERRED: copy.engineUnavailable,
          IMAGE_UPLOAD_INVALID: sessionCopy.unreadableImage,
          VIDEO_UPLOAD_INVALID: sessionCopy.unreadableVideo,
          AUDIO_UPLOAD_INVALID: sessionCopy.unreadableAudio,
        };
        // These structured rejections occur before acceptance; network/unknown errors do not.
        if (messages[code]) uncertain = recovering;
        if (code === 'INSUFFICIENT_FUNDS') setNeedsFunds(true);
        setError(messages[code] ?? (quote ? copy.confirmIssue : copy.prepareIssue));
      }
    } finally {
      // A cancelled preparation may finish after the user has already retried.
      if (cancel.current === controller) {
        flight.current = false;
        if (quote) onLock(uncertain);
        if (!controller.signal.aborted) {
          setRecovering(uncertain);
          setBusy(false);
        }
      }
    }
  }
  if (job)
    return (
      <a
        className="block rounded-xl border border-brand p-3 text-center text-sm font-semibold"
        href={'/app?job=' + encodeURIComponent(job.jobId)}
      >
        {job.status === 'failed' ? copy.failedJob : copy.openRecast}
      </a>
    );
  return (
    <div className="space-y-2">
      {quote && setup && (
        <div role="status" className="rounded-xl border border-brand p-3 text-xs">
          <p className="flex items-center justify-between text-sm font-semibold">
            <span>{quote.kind === 'rehearsal' ? copy.rehearsalPrice : copy.exactQuote}</span>
            <span>{amount}</span>
          </p>
          <button type="button" aria-expanded={detailsOpen} onClick={() => setDetailsOpen(value => !value)}
            className="min-h-8 underline underline-offset-4 lg:hidden">{getRecastSessionCopy(copy.recastLocale).quoteDetails}</button>
          <div className={detailsOpen ? 'block' : 'hidden lg:block'}>
          <p>
            {setup.resolution} · {setup.aspectRatio} · {setup.seconds} s
          </p>
          {quote.sourceSeconds > 0 && (
            <p>
              {copy.sourceVideo} · {seconds.format(quote.sourceSeconds)} s
            </p>
          )}
          {quote.audioSeconds > 0 && <p>Audio · {seconds.format(quote.audioSeconds)} s</p>}
          </div>
          {quote.kind === 'rehearsal' && <p>{copy.rehearsalHint}</p>}
          {quote.kind === 'wallet' && (quote.topupRequired || needsFunds) && (
            <Link href="/billing" target="_blank" rel="noopener noreferrer" className="underline">
              {copy.topupQuote}
            </Link>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-text-secondary">
          {error}
        </p>
      )}
      {busy && !quote && <p role="status" data-recast-preparation-status className="text-xs leading-relaxed text-text-secondary">
        {getRecastReadinessCopy(copy.recastLocale).preparing}
      </p>}
      {busy && !quote && <button type="button" data-recast-cancel-preparation onClick={cancelPreparation}
        className="min-h-9 text-xs font-medium underline underline-offset-4">{sessionCopy.cancelPreparation}</button>}
      {quote?.kind !== 'rehearsal' && (
        <button
          type="button"
          data-recast-submit
          onClick={run}
          disabled={!setup || busy}
          aria-describedby={!setup ? blockedReasonId : undefined}
          className="flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-2 text-sm font-medium text-on-brand disabled:opacity-50"
        >
          {busy
            ? quote
              ? copy.submittingRecast
              : copy.preparingQuote
            : recovering
              ? copy.recoverRecast
              : quote
                ? copy.confirmRecast.replace('{amount}', amount)
                : copy.reviewPrice}
        </button>
      )}
    </div>
  );
}
