'use client';
import { useEffect, useRef, useState } from 'react';
import { customerTariffRevision } from '@/lib/customer-tariff-revision';
import { runGenerate, runPreflight } from '@/lib/api-generation';
import type { PreflightResponse } from '@/types/engines';
import type { SeedanceWorkflowView } from '@/lib/seedance-workflow-contract';
import type { SeedanceWorkflowAccount } from './useSeedanceWorkflowAccount';

export function useSeedanceFinalization(options: { view: SeedanceWorkflowView | null; account: SeedanceWorkflowAccount | null;
  onAccepted: (jobId: string) => void }, deps = { runGenerate, runPreflight }) {
  const [quote, setQuote] = useState<PreflightResponse | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = JSON.stringify([options.view?.draft.jobId, options.view?.eligibility, options.account?.userId, options.account?.token]);
  const scope = useRef(current); scope.current = current;
  const guard = useRef(false);
  useEffect(() => { setQuote(null); setConfirming(false); setPending(false); setError(null); setUncertain(false); }, [current]);
  function cancel() { if (guard.current) return; setQuote(null); setConfirming(false); setError(null); }
  async function requestFinal() {
    const { view, account } = options;
    if (!view || view.eligibility !== 'ready' || !account || guard.current || uncertain) return;
    const started = scope.current;
    guard.current = true;
    setConfirming(true); setPending(true); setQuote(null); setError(null);
    try {
      const result = await deps.runPreflight({ engine: 'seedance-2-5', mode: 't2v', durationSec: view.settings.durationSec,
        resolution: '1080p', fps: 24, aspectRatio: view.settings.aspectRatio, audio: view.settings.audio,
        seedanceWorkflow: { step: 'final', draftJobId: view.draft.jobId } }, { accessToken: account.token });
      if (scope.current !== started) return;
      if (!result.ok || !result.pricing || customerTariffRevision(result.pricing) === null || result.pricing.meta?.workflowStep !== 'final'
        || !Number.isSafeInteger(result.pricing.totalCents) || result.pricing.totalCents <= 0 || result.pricing.currency !== 'USD') {
        throw new Error('Final quote unavailable.');
      }
      setQuote(result);
    } catch (failure) { if (scope.current === started) setError(failure instanceof Error ? failure.message : 'Final quote unavailable.'); }
    finally { guard.current = false; if (scope.current === started) setPending(false); }
  }
  async function confirm() {
    const { view, account } = options;
    if (!view || view.eligibility !== 'ready' || !account || !quote?.pricing || !confirming || pending || guard.current || uncertain) return;
    const started = scope.current;
    guard.current = true; setPending(true); setError(null);
    try {
      const result = await deps.runGenerate({ jobId: `job_${crypto.randomUUID()}`, engineId: 'seedance-2-5', mode: 't2v', prompt: '',
        seedanceWorkflow: { step: 'final', draftJobId: view.draft.jobId }, payment: { mode: 'wallet' }, iterationCount: 1 },
        { token: account.token, pricingSnapshot: quote.pricing });
      if (scope.current !== started) return;
      setConfirming(false); setQuote(null); options.onAccepted(result.jobId);
    } catch (failure) {
      if (scope.current !== started) return;
      const details = failure as Error & { status?: number; jobId?: string; paymentStatus?: string; refundedAmountCents?: number; currency?: string };
      setError(details.message);
      // A lost acknowledgement never authorizes a second paid attempt.
      const confirmedRefund = Boolean(details.jobId && details.paymentStatus === 'refunded_wallet'
        && details.refundedAmountCents === quote.pricing.totalCents && details.currency === quote.pricing.currency);
      if ((!details.status || details.status >= 500) && !confirmedRefund) setUncertain(true);
      setQuote(null); setConfirming(false);
      if (details.jobId) options.onAccepted(details.jobId);
    } finally { guard.current = false; if (scope.current === started) setPending(false); }
  }
  return { quote, confirming, pending, uncertain, error, requestFinal, confirm, cancel };
}
