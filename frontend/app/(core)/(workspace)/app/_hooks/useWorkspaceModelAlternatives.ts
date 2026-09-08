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
}): WorkspaceModelAlternative[] {
  const alternatives = useMemo(
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
  const scope =
    enabled && accessToken && alternatives.length
      ? JSON.stringify([accessToken, quoteScope(alternatives)])
      : null;
  const [quotes, setQuotes] = useState<{ scope: string; values: Record<string, Quote> } | null>(null);
  const alternativesRef = useRef(alternatives);
  alternativesRef.current = alternatives;

  useEffect(() => {
    if (!scope || !accessToken) return;
    let canceled = false;
    const activeAlternatives = alternativesRef.current;
    setQuotes({ scope, values: {} });
    const timer = window.setTimeout(() => {
      for (const alternative of activeAlternatives) {
        runPreflight(alternative.request, { accessToken })
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
  }, [scope, accessToken]);

  const values = quotes?.scope === scope ? quotes.values : {};
  return alternatives.map((alternative) => {
    const quote = values[alternative.engine.id];
    return {
      ...alternative,
      price: quote && 'price' in quote ? quote.price : null,
      currency: quote && 'price' in quote ? quote.currency : 'USD',
      isPricing: Boolean(scope && !quote),
      quoteError: Boolean(quote && 'error' in quote),
    };
  });
}
