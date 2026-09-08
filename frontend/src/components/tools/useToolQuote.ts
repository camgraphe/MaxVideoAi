'use client';
import { useCallback, useEffect, useState } from 'react';
import { authFetch } from '@/lib/authFetch';
import type { AcceptedToolQuote } from '@/lib/toolbox/quote';

type QuoteState = { key: string | null; quote?: AcceptedToolQuote & { released?: boolean; generative?: boolean }; error?: string };
/** Invalidate during render, including account/source round trips; never submit an old quote. */
export function useToolQuote(request: Record<string, unknown> | null, userId: string | null | undefined) {
  const [attempt, setAttempt] = useState(0);
  const key = request && userId ? JSON.stringify([userId, request, attempt]) : null;
  const [state, setState] = useState<QuoteState>({ key });
  if (state.key !== key) setState({ key });
  const refresh = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const deadline = setTimeout(() => {
      controller.abort();
      setState(current => current.key === key ? { key, error: 'Price unavailable' } : current);
    }, 60_000);
    const timer = setTimeout(async () => {
      try {
        const [, payload] = JSON.parse(key);
        const response = await authFetch('/api/tools/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
        const data = await response.json();
        if (!response.ok || !data?.ok || !Number.isSafeInteger(data.quote?.totalCents) || data.quote.totalCents < 0 || !/^[A-Z]{3}$/.test(data.quote?.currency ?? '')) throw new Error('Price unavailable');
        if (!controller.signal.aborted) setState(current => current.key === key ? { key, quote: data.quote } : current);
      } catch {
        if (!controller.signal.aborted) setState(current => current.key === key ? { key, error: 'Price unavailable' } : current);
      } finally { clearTimeout(deadline); }
    }, 250);
    return () => { clearTimeout(timer); clearTimeout(deadline); controller.abort(); };
  }, [key]);
  const current = state.key === key ? state : null;
  return { quote: current?.quote ?? null, error: current?.error ?? null, loading: Boolean(key && !current?.quote && !current?.error), ready: Boolean(key && current?.quote), refresh };
}
