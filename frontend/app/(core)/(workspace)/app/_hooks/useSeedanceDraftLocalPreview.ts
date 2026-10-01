'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormState } from '../_lib/workspace-form-state';
import type { PublicModelQuote, PublicModelQuoteInput } from '@/lib/pricing-public-model-contract';

type Options = {
  enabled: boolean;
  form: FormState | null;
  engineId?: string;
  mode: string;
  prompt: string;
  onResolutionChange: (value: string) => void;
  showNotice: (value: string) => void;
};

export function useSeedanceDraftLocalPreview(options: Options) {
  const { enabled, form, engineId, mode, prompt, onResolutionChange, showNotice } = options;
  const available = Boolean(enabled && form && engineId === 'seedance-2-5' && mode === 't2v' && form.iterations === 1);
  const contextKey = JSON.stringify([
    enabled, engineId, mode, prompt, form?.durationSec, form?.aspectRatio, form?.audio, form?.iterations,
  ]);
  const [selected, setSelected] = useState(false);
  const [phase, setPhase] = useState<'setup' | 'draft' | 'confirm' | 'final'>('setup');
  const [snapshot, setSnapshot] = useState<PublicModelQuoteInput | null>(null);
  const [finalQuote, setFinalQuote] = useState<PublicModelQuote | null>(null);
  const [trialQuote, setTrialQuote] = useState<PublicModelQuote | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  const priorResolution = useRef<string | null>(null);

  useEffect(() => {
    sequence.current += 1;
    setPhase('setup');
    setSnapshot(null);
    setFinalQuote(null);
    setTrialQuote(null);
    setPending(false);
    setError(null);
    return () => { sequence.current += 1; };
  }, [contextKey]);

  useEffect(() => {
    if (!available) setSelected(false);
  }, [available]);

  function toggle() {
    if (!available || !form) return;
    sequence.current += 1;
    if (!selected) {
      priorResolution.current = form.resolution;
      onResolutionChange('480p');
    } else if (priorResolution.current) {
      onResolutionChange(priorResolution.current);
    }
    setSelected(!selected);
    setPhase('setup');
    setSnapshot(null);
    setFinalQuote(null);
    setTrialQuote(null);
    setPending(false);
    setError(null);
  }

  function generate() {
    // This hook deliberately has no generation-runner or billing callback.
    if (!available || !selected || !form) {
      showNotice('Maquette locale : aucune génération ni facturation. Choisissez « Essayer d’abord » pour parcourir les étapes.');
      return;
    }
    sequence.current += 1;
    setSnapshot({
      modelId: 'seedance-2-5', mode: 't2v', durationSec: form.durationSec,
      aspectRatio: form.aspectRatio, audio: form.audio, resolution: '1080p',
    });
    setPhase('draft');
    setFinalQuote(null);
    setTrialQuote(null);
    setPending(false);
    setError(null);
  }

  async function requestFinal() {
    if (!available || !selected || phase !== 'draft' || !snapshot) return;
    const request = ++sequence.current;
    setPhase('confirm');
    setPending(true);
    setFinalQuote(null);
    setTrialQuote(null);
    setError(null);
    try {
      const readReference = async (resolution: string) => {
        const response = await fetch('/api/pricing/quote', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...snapshot, resolution }), cache: 'no-store',
        });
        const quote = await response.json() as PublicModelQuote;
        if (!response.ok || quote.status !== 'exact' || !Number.isSafeInteger(quote.amountCents)
          || quote.amountCents < 0 || typeof quote.currency !== 'string') {
          throw new Error('Quote unavailable');
        }
        return quote;
      };
      const [trial, final] = await Promise.all([readReference('480p'), readReference('1080p')]);
      if (request !== sequence.current) return;
      if (trial.currency !== final.currency || !Number.isSafeInteger(trial.amountCents + final.amountCents)) {
        throw new Error('Incompatible references');
      }
      setTrialQuote(trial);
      setFinalQuote(final);
    } catch {
      if (request === sequence.current) setError('Les prix de référence sont indisponibles. Aucun rendu final ne peut être confirmé.');
    } finally {
      if (request === sequence.current) setPending(false);
    }
  }

  function cancel() {
    sequence.current += 1;
    setPhase(snapshot ? 'draft' : 'setup');
    setFinalQuote(null);
    setTrialQuote(null);
    setPending(false);
    setError(null);
  }

  function confirmSimulation() {
    if (available && selected && phase === 'confirm' && !pending && finalQuote?.status === 'exact' && trialQuote?.status === 'exact') {
      setPhase('final');
    }
  }

  return {
    available, selected: available && selected, phase, snapshot, finalQuote, trialQuote, pending, error,
    combinedReferenceCents: trialQuote?.status === 'exact' && finalQuote?.status === 'exact'
      ? trialQuote.amountCents + finalQuote.amountCents : null,
    toggle, generate, requestFinal, confirmSimulation, cancel,
  };
}
