'use client';
import { useEffect, useRef, useState } from 'react';
import { customerTariffRevision } from '@/lib/customer-tariff-revision';
import { runGenerate } from '@/lib/api';
import { useSeedanceWorkflowView } from '@/hooks/useSeedanceWorkflowView';
import type { SeedanceWorkflowAccount } from '@/hooks/useSeedanceWorkflowAccount';
import type { SeedanceDraftControls } from '@/lib/seedance-workflow-contract';
import { SEEDANCE_WORKFLOW_ASPECT_RATIOS } from '@/lib/seedance-workflow-contract';
import type { AspectRatio } from '@/types/engines';
import { useWorkspacePreflightQuote } from './useWorkspacePreflightQuote';
import type { FormState } from '../_lib/workspace-form-state';

type Options = { enabled: boolean; form: FormState | null; engineId?: string; mode: string; prompt: string;
  account: SeedanceWorkflowAccount | null; onResolutionChange: (value: string) => void; showNotice: (value: string) => void };
export function useSeedanceDraftWorkflow(options: Options) {
  const { enabled, form, engineId, mode, prompt, account } = options;
  const aspectRatio = form && SEEDANCE_WORKFLOW_ASPECT_RATIOS.includes(form.aspectRatio as AspectRatio) ? form.aspectRatio as AspectRatio : null;
  const available = Boolean(enabled && form && aspectRatio && engineId === 'seedance-2-5' && mode === 't2v' && form.iterations === 1);
  const [selected, setSelected] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guard = useRef(false), priorResolution = useRef<string | null>(null);
  const scope = JSON.stringify([account?.userId, account?.token, engineId, mode, prompt, form]);
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const resolutionChangeRef = useRef(options.onResolutionChange); resolutionChangeRef.current = options.onResolutionChange;
  const storageKey = account ? `seedance-active-draft:${account.userId}` : null;
  useEffect(() => {
    setDraftId(null); setSelected(false); setError(null);
    if (!enabled || !storageKey) return;
    try { const id = window.localStorage.getItem(storageKey); if (id) { setDraftId(id); setSelected(true); resolutionChangeRef.current('480p'); } } catch { /* server history remains available */ }
  }, [enabled, storageKey]);
  const read = useSeedanceWorkflowView(draftId, account, enabled);
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
    const started = scopeRef.current, id = `job_${crypto.randomUUID()}`;
    guard.current = true; setSubmitting(true); setError(null);
    try {
      // Persist before dispatch: a lost acknowledgement or refresh cannot start a new paid Draft.
      if (!storageKey) return;
      window.localStorage.setItem(storageKey, id);
      setDraftId(id);
      await runGenerate({ jobId: id, engineId: 'seedance-2-5', mode: 't2v', prompt, durationSec: form.durationSec,
        resolution: '480p', aspectRatio: form.aspectRatio, audio: form.audio, iterationCount: 1,
        seedanceWorkflow: { step: 'draft' }, payment: { mode: 'wallet' } }, { token: account.token, pricingSnapshot: pricing });
      if (scopeRef.current === started) void read.mutate();
    } catch (failure) {
      if (scopeRef.current !== started) return;
      const details = failure as Error & { status?: number; jobId?: string };
      setError(details.message);
      if (details.status && details.status >= 400 && details.status < 500 && !details.jobId) {
        window.localStorage.removeItem(storageKey!); setDraftId(null); quote.retry();
      }
    } finally { guard.current = false; setSubmitting(false); }
  }
  function restart() {
    if (guard.current || (draftId && (!read.data || ['pending', 'finalizing', 'unavailable'].includes(read.data.eligibility)))) return;
    if (storageKey) window.localStorage.removeItem(storageKey);
    setDraftId(null); setError(null); options.onResolutionChange('480p'); quote.retry();
  }
  const phase: SeedanceDraftControls['phase'] = draftId ? 'draft' : 'setup';
  return { available, selected: available && selected, phase, live: true as const, pending: submitting,
    toggle, generate, restart, draftId, view: read.data, error: error ?? quote.preflightError ?? read.error?.message,
    price: draftId ? read.data?.draft.amountCents !== null && read.data?.draft.amountCents !== undefined ? read.data.draft.amountCents / 100 : null : quote.price,
    currency: quote.currency, isPricing: quote.isPricing, preflight: quote.preflight };
}
