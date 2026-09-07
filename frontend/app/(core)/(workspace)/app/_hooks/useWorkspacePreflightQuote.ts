import { useEffect, useState } from 'react';
import { runPreflight } from '@/lib/api';
import type { PreflightRequest, PreflightResponse } from '@/types/engines';
import { DEBOUNCE_MS } from '../_lib/workspace-client-helpers';

export type WorkspacePreflightQuoteOptions = {
  request: PreflightRequest | null;
  iterations: number;
  accessToken: string | null;
  authChecked: boolean;
};
type Scope = { requestKey: string | null; accessToken: string | null; authChecked: boolean };
type Observation = { scope: Scope; response: PreflightResponse | null; error?: string };

// Canonicalize object property order only. Array order and every wire value stay significant.
function requestKey(payload: PreflightRequest): string {
  return JSON.stringify(payload, (_key, value) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
      : value
  );
}

function getPreflightErrorMessage(response: PreflightResponse): string {
  return (
    (typeof response.error?.message === 'string' && response.error.message.trim().length
      ? response.error.message.trim() : undefined) ??
    response.messages?.find((entry) => typeof entry === 'string' && entry.trim().length)?.trim() ??
    'Unable to compute pricing'
  );
}

export function useWorkspacePreflightQuote(options: WorkspacePreflightQuoteOptions) {
  const { request, iterations, accessToken, authChecked } = options;
  const key = request ? requestKey(request) : null;
  const [scope, setScope] = useState<Scope>({ requestKey: key, accessToken, authChecked });
  const [observation, setObservation] = useState<Observation | null>(null);
  const [composerError, setPreflightError] = useState<string | undefined>();
  const matches = scope.requestKey === key && scope.accessToken === accessToken && scope.authChecked === authChecked;
  // Reset the request generation during render, so even A → B → A cannot revive A's quote.
  // The token is transient equality state, never part of a serialized key or persisted cache.
  if (!matches) setScope({ requestKey: key, accessToken, authChecked });
  const eligible = Boolean(key && accessToken && authChecked);
  const current = eligible && matches && observation?.scope === scope ? observation : null;

  useEffect(() => {
    if (!scope.requestKey || !scope.authChecked || !scope.accessToken) return;
    let canceled = false;
    const payload = JSON.parse(scope.requestKey) as PreflightRequest;
    const accessToken = scope.accessToken;
    const timeout = setTimeout(() => {
      Promise.resolve().then(() => runPreflight(payload, { accessToken })).then((response) => {
        if (canceled) return;
        const valid = response.ok && typeof response.total === 'number' && Number.isFinite(response.total) && response.total >= 0;
        setObservation({ scope, response: valid ? response : null, error: valid ? undefined : getPreflightErrorMessage(response) });
      }).catch((error: unknown) => {
        if (!canceled) setObservation({ scope, response: null, error: error instanceof Error ? error.message : 'Preflight failed' });
      });
    }, DEBOUNCE_MS);
    return () => { canceled = true; clearTimeout(timeout); };
  }, [scope]);

  const preflight = current?.response ?? null;
  const singlePrice = preflight ? preflight.total! / 100 : null;
  return {
    preflight,
    preflightError: composerError ?? current?.error,
    setPreflightError,
    isPricing: eligible && !current,
    price: singlePrice === null ? null : singlePrice * (iterations || 1),
    currency: preflight?.currency ?? 'USD',
  };
}
