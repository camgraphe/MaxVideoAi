'use client';

import { useEffect, useRef, useState } from 'react';
import { traceModelPicker } from '@/lib/model-picker-diagnostics';
import { CUSTOMER_PRICING_REFRESH_EVENT } from '@/lib/customer-tariff-revision';
import { createModelEstimateQueue, type ModelEstimate, type ModelEstimateQueue } from '@/lib/model-picker-estimates';
import type { PickerEstimateRequest } from './model-picker-types';

const queues = new Map<string, ModelEstimateQueue>();
const refreshed = new WeakSet<Event>();
function queueFor(scope: string) {
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
export function useModelPickerEstimates(scope: string | null, requests: Record<string, PickerEstimateRequest>) {
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify([scope, revision, Object.entries(requests).map(([id, request]) => [id, request.key]).sort()]);
  const latest = useRef(requests);
  latest.current = requests;
  const [observed, setObserved] = useState<{ key: string; rows: Record<string, PickerQuoteState> } | null>(null);
  useEffect(() => {
    const refresh = (event: Event) => {
      if (!refreshed.has(event)) {
        refreshed.add(event);
        for (const queue of queues.values()) queue.clear();
      }
      setRevision(value => value + 1);
    };
    window.addEventListener(CUSTOMER_PRICING_REFRESH_EVENT, refresh);
    return () => window.removeEventListener(CUSTOMER_PRICING_REFRESH_EVENT, refresh);
  }, []);
  useEffect(() => {
    if (!scope) return;
    let canceled = false;
    const leases: Array<{ release: () => void }> = [];
    const timer = window.setTimeout(() => {
      const queue = queueFor(scope);
      for (const [id, request] of Object.entries(latest.current)) {
        const start = performance.now();
        const lease = queue.acquire(request.key, request.load);
        leases.push(lease);
        traceModelPicker('acquire', { id, ...queue.stats() });
        const publish = (value: PickerQuoteState) => {
          if (canceled) return;
          traceModelPicker('settled', { id, elapsedMs: Math.round(performance.now() - start), ok: Boolean(value.quote), ...queue.stats() });
          setObserved(previous => ({ key, rows: { ...(previous?.key === key ? previous.rows : {}), [id]: value } }));
        };
        lease.promise.then(quote => publish({ quote, elapsedMs: performance.now() - start }))
          .catch(error => { if (error?.name !== 'AbortError') publish({ error: true }); });
      }
    }, 200);
    return () => { canceled = true; window.clearTimeout(timer); leases.forEach(lease => lease.release()); };
  }, [scope, key]);
  return {
    rows: observed?.key === key ? observed.rows : {},
    retry: () => setRevision(value => value + 1),
    stats: () => scope ? queueFor(scope).stats() : null,
  };
}
