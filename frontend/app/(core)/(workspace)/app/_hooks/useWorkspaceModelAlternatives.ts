'use client';

import { useMemo, useState } from 'react';
import { runPreflight } from '@/lib/api';
import type { EngineCaps } from '@/types/engines';
import { modelEstimateKey } from '@/lib/model-picker-estimates';
import { useModelPickerEstimates } from '@/components/ui/engine-select/useModelPickerEstimates';
import type { PickerEstimateRequest } from '@/components/ui/engine-select/model-picker-types';
import type { WorkspaceModelSetup } from '../_lib/workspace-model-candidate';
import {
  buildWorkspaceModelAlternatives,
  type WorkspaceModelAlternativeCandidate,
} from '../_lib/workspace-model-alternatives';

export type WorkspaceModelAlternative = WorkspaceModelAlternativeCandidate & {
  price: number | null;
  currency: string;
  isPricing: boolean;
  quoteError: boolean;
};

export function useWorkspaceModelAlternatives({
  enabled,
  current,
  engines,
  locale,
  memberTier,
  disabledEngineReasons,
  engineScores,
  accessToken, accountId = null,
}: {
  enabled: boolean;
  current: WorkspaceModelSetup | null;
  engines: EngineCaps[];
  locale: string;
  memberTier: 'Member' | 'Plus' | 'Pro';
  disabledEngineReasons?: Record<string, string>;
  engineScores?: Record<string, number | null | undefined>;
  accessToken: string | null;
  accountId?: string | null;
}) {
  const suggested = useMemo(
    () =>
      enabled ? buildWorkspaceModelAlternatives({
        current,
        engines,
        locale,
        memberTier,
        disabledEngineReasons,
        engineScores,
      }) : [],
    [enabled, current, engines, locale, memberTier, disabledEngineReasons, engineScores],
  );
  // Candidate preparation clones and validates every eligible model's draft.
  // Keep it off the composer input path while the comparison is closed.
  const available = useMemo(() => enabled ? buildWorkspaceModelAlternatives({ current, engines, locale, memberTier, disabledEngineReasons, engineScores, limit: engines.length, includeBlocked: true }) : [], [enabled, current, engines, locale, memberTier, disabledEngineReasons, engineScores]);
  const [selection, setSelection] = useState<{ account: string | null; ids: string[] } | null>(null);
  const selectedIds = selection?.account === accessToken ? selection.ids : suggested.map(item => item.engine.id);
  const alternatives = selectedIds.flatMap(id => { const match = available.find(item => item.engine.id === id); return match ? [match] : []; });
  const scope = enabled && accessToken ? `video:${accountId ?? 'guest'}:${accessToken}` : null;
  const requests: Record<string, PickerEstimateRequest> = {};
  for (const item of alternatives) {
    if (!item.request) continue;
    const request = item.request;
    const iterations = item.candidate.setup.form.iterations || 1;
    requests[item.engine.id] = { key: modelEstimateKey([request, iterations]), load: async () => {
      const response = await runPreflight(request, { accessToken, signal: AbortSignal.timeout(15_000) });
      if (!response.ok || typeof response.total !== 'number') throw new Error('Estimate unavailable');
      return { amount: response.total * iterations, currency: response.currency ?? 'USD' };
    } };
  }
  const quotes = useModelPickerEstimates(scope, requests);
  const priced: WorkspaceModelAlternative[] = alternatives.map((alternative) => {
    const quote = quotes.rows[alternative.engine.id];
    return {
      ...alternative,
      price: quote?.quote ? quote.quote.amount / 100 : null,
      currency: quote?.quote?.currency ?? 'USD',
      isPricing: Boolean(alternative.request && scope && !quote),
      quoteError: Boolean(quote?.error),
    };
  });
  return {
    alternatives: priced,
    availableIds: available.map(item => item.engine.id),
    add: (id: string) => { if (alternatives.length >= 6 || !available.some(item => item.engine.id === id)) return; setSelection({ account: accessToken, ids: [...new Set([...alternatives.map(item => item.engine.id), id])] }); },
    remove: (id: string) => setSelection({ account: accessToken, ids: alternatives.filter(item => item.engine.id !== id).map(item => item.engine.id) }),
    retry: quotes.retry,
  };
}
