'use client';
import { useEffect, useRef, useState } from 'react';
import { customerTariffRevision } from '@/lib/customer-tariff-revision';
import { runGenerate } from '@/lib/api-generation';
import type { PricingSnapshot } from '@maxvideoai/pricing';
import { useSeedanceWorkflowView } from '@/hooks/useSeedanceWorkflowView';
import type { SeedanceWorkflowAccount } from '@/hooks/useSeedanceWorkflowAccount';
import type { SeedanceDraftControls } from '@/lib/seedance-workflow-contract';
import { SEEDANCE_WORKFLOW_ASPECT_RATIOS } from '@/lib/seedance-workflow-contract';
import type { AspectRatio } from '@/types/engines';
import { useWorkspacePreflightQuote } from './useWorkspacePreflightQuote';
import type { FormState } from '../_lib/workspace-form-state';

type Options = { enabled: boolean; form: FormState | null; engineId?: string; mode: string; prompt: string;
  account: SeedanceWorkflowAccount | null; onResolutionChange: (value: string) => void; showNotice: (value: string) => void };
type Attempt = { userId: string; payload: Parameters<typeof runGenerate>[0]; pricing: PricingSnapshot };
const requestKey = (userId: string, jobId: string) => `seedance-draft-request:${userId}:${jobId}`;
function restoreAttempt(userId: string, jobId: string): Attempt | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(requestKey(userId, jobId)) ?? 'null') as Attempt | null;
    return value?.userId === userId && value.payload?.jobId === jobId && value.payload.engineId === 'seedance-2-5'
      && value.payload.seedanceWorkflow?.step === 'draft' && value.payload.resolution === '480p'
      && customerTariffRevision(value.pricing) !== null && value.pricing?.meta?.workflowStep === 'draft' ? value : null;
  } catch { return null; }
}
export function useSeedanceDraftWorkflow(options: Options) {
  const { enabled, form, engineId, mode, prompt, account } = options;
  const aspectRatio = form && SEEDANCE_WORKFLOW_ASPECT_RATIOS.includes(form.aspectRatio as AspectRatio) ? form.aspectRatio as AspectRatio : null;
  const available = Boolean(enabled && form && aspectRatio && engineId === 'seedance-2-5' && mode === 't2v' && form.iterations === 1);
  const [selected, setSelected] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guard = useRef(false), priorResolution = useRef<string | null>(null);
  const scope = JSON.stringify([account?.userId, account?.token, engineId, mode, prompt, form]);
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const resolutionChangeRef = useRef(options.onResolutionChange); resolutionChangeRef.current = options.onResolutionChange;
  const accountUserId = account?.userId ?? null;
  const storageKey = accountUserId ? `seedance-active-draft:${accountUserId}` : null;
  useEffect(() => {
    setDraftId(null); setAttempt(null); setSelected(false); setError(null);
    if (!enabled || !storageKey) return;
    try { const id = window.localStorage.getItem(storageKey); if (id && accountUserId) { setDraftId(id); setAttempt(restoreAttempt(accountUserId, id)); setSelected(true); resolutionChangeRef.current('480p'); } } catch { /* server history remains available */ }
  }, [enabled, storageKey, accountUserId]);
  const read = useSeedanceWorkflowView(draftId, account, enabled);
  useEffect(() => {
    if (read.data && draftId && accountUserId) {
      try { window.localStorage.removeItem(requestKey(accountUserId, draftId)); } catch { /* bounded local cleanup */ }
      setAttempt(null);
    }
  }, [read.data, draftId, accountUserId]);
  const quote = useWorkspacePreflightQuote({ request: available && selected && !draftId && form && account && aspectRatio ? {
    engine: 'seedance-2-5', mode: 't2v', durationSec: form.durationSec, resolution: '480p', fps: 24, aspectRatio,
    audio: form.audio, seedanceWorkflow: { step: 'draft' },
  } : null, iterations: 1, accessToken: account?.token ?? null, authChecked: Boolean(account), locale: 'fr' });
  function toggle() {
    if (!available || !form || guard.current || draftId) return;
    if (!selected) { priorResolution.current = form.resolution; options.onResolutionChange('480p'); }
    else if (priorResolution.current) options.onResolutionChange(priorResolution.current);
    setSelected(value => !value); setError(null);
  }
  async function generate() {
    if (!available || !selected || !form || draftId || guard.current) return;
    if (!account) { options.showNotice('Connectez-vous pour générer un Draft.'); return; }
    const pricing = quote.preflight?.pricing;
    if (!pricing || customerTariffRevision(pricing) === null || pricing.meta?.workflowStep !== 'draft' || form.resolution !== '480p' || !prompt.trim()) return;
    const id = `job_${crypto.randomUUID()}`;
    const saved: Attempt = { userId: account.userId, payload: { jobId: id, engineId: 'seedance-2-5', mode: 't2v', prompt, durationSec: form.durationSec,
      resolution: '480p', aspectRatio: form.aspectRatio, audio: form.audio, iterationCount: 1,
      seedanceWorkflow: { step: 'draft' }, payment: { mode: 'wallet' } }, pricing };
    await dispatch(saved, true);
  }
  async function dispatch(saved: Attempt, persist: boolean) {
    if (!account || saved.userId !== account.userId || !storageKey || guard.current) return;
    const started = scopeRef.current, id = saved.payload.jobId!;
    guard.current = true; setSubmitting(true); setError(null);
    try {
      // Store only request facts and quote, never a session token. Recovery reuses this exact ID.
      if (persist) {
        window.localStorage.setItem(requestKey(account.userId, id), JSON.stringify(saved));
        window.localStorage.setItem(storageKey, id);
        setAttempt(saved); setDraftId(id);
      }
      await runGenerate(saved.payload, { token: account.token, pricingSnapshot: saved.pricing });
      if (scopeRef.current === started) void read.mutate();
    } catch (failure) {
      if (scopeRef.current !== started) return;
      const details = failure as Error & { status?: number; jobId?: string };
      setError(details.message);
      if (details.status && details.status >= 400 && details.status < 500 && !details.jobId) {
        window.localStorage.removeItem(storageKey); window.localStorage.removeItem(requestKey(account.userId, id));
        setDraftId(null); setAttempt(null); quote.retry();
      }
    } finally { guard.current = false; setSubmitting(false); }
  }
  const canResume = Boolean(enabled && account && attempt?.userId === account.userId && draftId && attempt?.payload.jobId === draftId && read.data === null && !read.error && !read.isValidating && !submitting);
  async function resume() {
    // An explicit retry after an owned 404 can only resend the original attempt, never create another.
    if (canResume && attempt) await dispatch(attempt, false);
  }
  function restart() {
    if (guard.current || (draftId && (!read.data || ['pending', 'finalizing', 'unavailable'].includes(read.data.eligibility)))) return;
    if (storageKey) window.localStorage.removeItem(storageKey);
    if (draftId && account) window.localStorage.removeItem(requestKey(account.userId, draftId));
    setDraftId(null); setAttempt(null); setError(null); options.onResolutionChange('480p'); quote.retry();
  }
  const phase: SeedanceDraftControls['phase'] = draftId ? 'draft' : 'setup';
  return { available, selected: available && selected, phase, live: true as const, pending: submitting,
    toggle, generate, restart, resume, canResume, draftId, view: read.data, error: error ?? quote.preflightError ?? read.error?.message,
    price: draftId ? read.data?.draft.amountCents !== null && read.data?.draft.amountCents !== undefined ? read.data.draft.amountCents / 100 : null : quote.price,
    currency: quote.currency, isPricing: quote.isPricing, preflight: quote.preflight };
}
