'use client';

import { useEffect, useRef, useState } from 'react';
import { traceModelPicker } from '@/lib/model-picker-diagnostics';
import { CUSTOMER_PRICING_REFRESH_EVENT } from '@/lib/customer-tariff-revision';
import { createModelEstimateQueue, type ModelEstimate, type ModelEstimateQueue } from '@/lib/model-picker-estimates';
import type { PickerEstimateRequest } from './model-picker-types';

const queues = new Map<string, ModelEstimateQueue>();
const refreshed = new WeakSet<Event>();
const watchedWindows = new WeakSet<Window>();
function refreshQueues(event: Event) {
  if (refreshed.has(event)) return;
  refreshed.add(event);
  for (const queue of queues.values()) queue.clear();
}
function queueFor(scope: string) {
  // The cache outlives the dialog, so its invalidation listener must also outlive it.
  if (!watchedWindows.has(window)) {
    watchedWindows.add(window);
    window.addEventListener(CUSTOMER_PRICING_REFRESH_EVENT, refreshQueues);
  }
  let queue = queues.get(scope);
  if (!queue) {
    if (queues.size >= 4) {
      const oldest = queues.keys().next().value!;
      queues.get(oldest)?.clear();
      queues.delete(oldest);
    }
    queue = createModelEstimateQueue();
    queues.set(scope, queue);
  }
  return queue;
}

export type PickerQuoteState = { quote?: ModelEstimate; error?: boolean; elapsedMs?: number };
export function useModelPickerEstimates(scope: string | null, requests: Record<string, PickerEstimateRequest>, visibleIds?: string[]) {
  const [revision, setRevision] = useState(0);
  const visible = visibleIds ? new Set(visibleIds) : null;
  const key = JSON.stringify([scope, revision, Object.entries(requests).filter(([id]) => !visible || visible.has(id)).map(([id, request]) => [id, request.key]).sort()]);
  const latest = useRef({ scope, revision, requests });
  latest.current = { scope, revision, requests };
  const [observed, setObserved] = useState<{ scope: string; revision: number; rows: Record<string, { requestKey: string; value: PickerQuoteState }> } | null>(null);
  useEffect(() => {
    const refresh = (event: Event) => {
      refreshQueues(event);
      setRevision(value => value + 1);
    };
    window.addEventListener(CUSTOMER_PRICING_REFRESH_EVENT, refresh);
    return () => window.removeEventListener(CUSTOMER_PRICING_REFRESH_EVENT, refresh);
  }, []);
  useEffect(() => {
    if (!scope) return;
    let canceled = false;
    const leases: Array<{ release: () => void }> = [];
    // Capture the committed request identities. A later render must not put another
    // account's loader into the queue owned by this effect.
    const scheduled = (JSON.parse(key)[2] as Array<[string, string]>).flatMap(([id, requestKey]) => {
      const request = latest.current.requests[id];
      return request?.key === requestKey ? [{ id, request }] : [];
    });
    const timer = window.setTimeout(() => {
      if (latest.current.scope !== scope || latest.current.revision !== revision) return;
      const queue = queueFor(scope);
      for (const { id, request } of scheduled) {
        if (latest.current.requests[id]?.key !== request.key) continue;
        const start = performance.now();
        const lease = queue.acquire(request.key, request.load);
        leases.push(lease);
        traceModelPicker('acquire', { id, ...queue.stats() });
        const publish = (value: PickerQuoteState) => {
          if (canceled || latest.current.scope !== scope || latest.current.revision !== revision || latest.current.requests[id]?.key !== request.key) return;
          traceModelPicker('settled', { id, elapsedMs: Math.round(performance.now() - start), ok: Boolean(value.quote), ...queue.stats() });
          setObserved(previous => ({ scope, revision, rows: {
            ...(previous?.scope === scope && previous.revision === revision ? previous.rows : {}),
            [id]: { requestKey: request.key, value },
          } }));
        };
        lease.promise.then(quote => publish({ quote, elapsedMs: performance.now() - start }))
          .catch(error => { if (error?.name !== 'AbortError') publish({ error: true }); });
      }
    }, 200);
    return () => { canceled = true; window.clearTimeout(timer); leases.forEach(lease => lease.release()); };
  }, [scope, key, revision]);
  const rows: Record<string, PickerQuoteState> = {};
  if (scope) for (const [id, request] of Object.entries(requests)) {
    const previous = observed?.scope === scope && observed.revision === revision ? observed.rows[id] : undefined;
    const value = previous?.requestKey === request.key ? previous.value : undefined;
    const cached = queues.get(scope)?.peek(request.key);
    // Visibility controls scheduling, never the identity of a resolved result.
    // An expired quote is refreshed on re-entry; errors replace that prior value.
    if (cached) rows[id] = { ...value, quote: cached, error: undefined };
    else if (value) rows[id] = value;
  }
  return {
    rows,
    retry: () => setRevision(value => value + 1),
    stats: () => scope ? queueFor(scope).stats() : null,
  };
}
