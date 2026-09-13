'use client';
import { useEffect, useState } from 'react';
import { useAudioCreationScope } from './useAudioCreationScope';
import type { PricingSnapshot } from '@maxvideoai/pricing';
import { authFetch } from '@/lib/authFetch';
import type { AudioGenerateRequestBody } from '@/lib/audio-generation';
export type AudioCreationQuote = { inputKey: string; pricing: PricingSnapshot; expiresAt: number };
export type AudioCreationQuoteError = { code: string; message: string; status: number };
class QuoteRequestError extends Error {
  detail: AudioCreationQuoteError;
  constructor(detail: AudioCreationQuoteError) { super(detail.message); this.detail = detail; }
}
export function useAudioCreationQuote(body: AudioGenerateRequestBody, userId: string | null, enabled: boolean) {
  const key = JSON.stringify({ body, userId });
  const [attempt, setAttempt] = useState(0);
  const scope = useAudioCreationScope(JSON.stringify({ key, enabled, attempt }));
  const [state, setState] = useState<{ scope: typeof scope; quote?: AudioCreationQuote; error?: AudioCreationQuoteError } | null>(null);
  useEffect(() => {
    if (!enabled || !userId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    timer = setTimeout(async () => {
      if (!scope.isCurrent()) return;
      setState({ scope });
      try {
        const response = await authFetch('/api/audio/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
        const data = await response.json().catch(() => null);
        if (controller.signal.aborted || !scope.isCurrent()) return;
        if (!response.ok || !data?.ok || typeof data.inputKey !== 'string' || typeof data.pricing?.currency !== 'string' || !Number.isFinite(data.pricing?.totalCents) || data.pricing.totalCents < 0 || !Number.isFinite(data.expiresAt) || data.expiresAt <= Date.now()) {
          const code = typeof data?.error === 'string' && data.error.trim() ? data.error : 'audio_quote_failed';
          const message = typeof data?.message === 'string' && data.message.trim() ? data.message : code;
          throw new QuoteRequestError({ code, message, status: response.status });
        }
        setState({ scope, quote: data });
        timer = setTimeout(() => { if (scope.isCurrent()) { setState(null); setAttempt(value => value + 1); } }, Math.max(1, data.expiresAt - Date.now()));
      } catch (error) {
        if (!controller.signal.aborted && scope.isCurrent()) setState({ scope, error: error instanceof QuoteRequestError ? error.detail : {
          code: 'audio_quote_failed', message: error instanceof Error ? error.message : 'audio_quote_failed', status: 0,
        } });
      }
    }, 350);
    return () => { controller.abort(); clearTimeout(timer); };
    // body is represented completely by key; preserve request identity across unrelated renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, userId, attempt, scope]);
  const quote = enabled && userId && state?.scope === scope && state.quote && state.quote.expiresAt > Date.now() ? state.quote : null;
  return { quote, isCurrent: scope.isCurrent, loading: enabled && Boolean(userId) && !quote && !(state?.scope === scope && state.error), error: state?.scope === scope ? state.error : undefined,
    retry: () => { if (scope.isCurrent()) { setState(null); setAttempt(value => value + 1); } } };
}
