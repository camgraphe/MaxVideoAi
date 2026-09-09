'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { runPreflight } from '@/lib/api';
import type { EngineCaps } from '@/types/engines';
import { DEBOUNCE_MS } from '../_lib/workspace-client-helpers';
import type { WorkspaceModelSetup } from '../_lib/workspace-model-candidate';
import {
  buildWorkspaceModelAlternatives,
  type WorkspaceModelAlternativeCandidate,
} from '../_lib/workspace-model-alternatives';

type Quote = { price: number; currency: string } | { error: true };

export type WorkspaceModelAlternative = WorkspaceModelAlternativeCandidate & {
  price: number | null;
  currency: string;
  isPricing: boolean;
  quoteError: boolean;
};

function quoteScope(alternatives: WorkspaceModelAlternativeCandidate[]) {
  return JSON.stringify(alternatives.map(({ engine, request }) => [engine.id, request]));
}

export function useWorkspaceModelAlternatives({
  enabled,
  current,
  engines,
  locale,
  memberTier,
  disabledEngineReasons,
  engineScores,
  accessToken,
}: {
  enabled: boolean;
  current: WorkspaceModelSetup | null;
  engines: EngineCaps[];
  locale: string;
  memberTier: 'Member' | 'Plus' | 'Pro';
  disabledEngineReasons?: Record<string, string>;
  engineScores?: Record<string, number | null | undefined>;
  accessToken: string | null;
}) {
  const suggested = useMemo(
    () =>
      buildWorkspaceModelAlternatives({
        current,
        engines,
        locale,
        memberTier,
        disabledEngineReasons,
        engineScores,
      }),
    [current, engines, locale, memberTier, disabledEngineReasons, engineScores],
  );
  const available = useMemo(() => buildWorkspaceModelAlternatives({ current, engines, locale, memberTier, disabledEngineReasons, engineScores, limit: engines.length, includeBlocked: true }), [current, engines, locale, memberTier, disabledEngineReasons, engineScores]);
  const [selection, setSelection] = useState<{ account: string | null; ids: string[] } | null>(null);
  const selectedIds = selection?.account === accessToken ? selection.ids : suggested.map(item => item.engine.id);
  const alternatives = selectedIds.flatMap(id => { const match = available.find(item => item.engine.id === id); return match ? [match] : []; });
  const [revision, setRevision] = useState(0);
  const cache = useRef(new Map<string, { quote: Quote; at: number }>());
  const cacheAccount = useRef(accessToken);
  if (cacheAccount.current !== accessToken) { cacheAccount.current = accessToken; cache.current.clear(); }
  const keyFor = (item: WorkspaceModelAlternativeCandidate) => JSON.stringify([accessToken, item.engine.id, item.request, item.candidate.setup.form.iterations]);
  const scope =
    enabled && accessToken && alternatives.length
      ? JSON.stringify([accessToken, quoteScope(alternatives.filter(item => item.request))])
      : null;
  const [quotes, setQuotes] = useState<{ scope: string; values: Record<string, Quote> } | null>(null);
  const alternativesRef = useRef(alternatives);
  alternativesRef.current = alternatives;

  useEffect(() => {
    if (!scope || !accessToken) return;
    let canceled = false;
    const activeAlternatives = alternativesRef.current.filter(item => item.request);
    const cached = Object.fromEntries(activeAlternatives.flatMap(item => { const value = cache.current.get(keyFor(item)); return value && Date.now() - value.at < 60_000 ? [[item.engine.id, value.quote]] : []; }));
    setQuotes({ scope, values: cached });
    const timer = window.setTimeout(() => {
      for (const alternative of activeAlternatives) {
        if (cached[alternative.engine.id]) continue;
        const key = keyFor(alternative);
        runPreflight(alternative.request!, { accessToken })
        .then((response) => {
          if (canceled) return;
          const total = response.ok && typeof response.total === 'number' ? response.total : null;
          const quote: Quote =
            total !== null && Number.isFinite(total) && total >= 0
              ? {
                  price: (total / 100) * (alternative.candidate.setup.form.iterations || 1),
                  currency: response.currency ?? 'USD',
                }
              : { error: true };
          if (cache.current.size >= 48) cache.current.delete(cache.current.keys().next().value!);
          cache.current.set(key, { quote, at: Date.now() });
          setQuotes((currentQuotes) =>
            currentQuotes?.scope === scope
              ? {
                  scope,
                  values: { ...currentQuotes.values, [alternative.engine.id]: quote },
                }
              : currentQuotes,
          );
        })
        .catch(() => {
          if (canceled) return;
          setQuotes((currentQuotes) =>
            currentQuotes?.scope === scope
              ? {
                  scope,
                  values: { ...currentQuotes.values, [alternative.engine.id]: { error: true } },
                }
              : currentQuotes,
          );
        });
      }
    }, DEBOUNCE_MS);
    return () => {
      canceled = true;
      window.clearTimeout(timer);
    };
  // Scope contains each selected request, including all pricing inputs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, accessToken, revision]);

  const values = quotes?.scope === scope ? quotes.values : {};
  const priced: WorkspaceModelAlternative[] = alternatives.map((alternative) => {
    const quote = values[alternative.engine.id];
    return {
      ...alternative,
      price: quote && 'price' in quote ? quote.price : null,
      currency: quote && 'price' in quote ? quote.currency : 'USD',
      isPricing: Boolean(alternative.request && scope && !quote),
      quoteError: Boolean(quote && 'error' in quote),
    };
  });
  return {
    alternatives: priced,
    availableIds: available.map(item => item.engine.id),
    add: (id: string) => { if (alternatives.length >= 6 || !available.some(item => item.engine.id === id)) return; setSelection({ account: accessToken, ids: [...new Set([...alternatives.map(item => item.engine.id), id])] }); },
    remove: (id: string) => setSelection({ account: accessToken, ids: alternatives.filter(item => item.engine.id !== id).map(item => item.engine.id) }),
    retry: () => { for (const item of alternatives) { const key = keyFor(item); if (cache.current.get(key) && 'error' in cache.current.get(key)!.quote) cache.current.delete(key); } setRevision(value => value + 1); },
  };
}
