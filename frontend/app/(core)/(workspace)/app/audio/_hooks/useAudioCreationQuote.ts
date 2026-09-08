'use client';
import { useEffect, useRef, useState } from 'react';
import type { PricingSnapshot } from '@maxvideoai/pricing';
import { authFetch } from '@/lib/authFetch';
import type { AudioGenerateRequestBody } from '@/lib/audio-generation';
export type AudioCreationQuote = { inputKey: string; pricing: PricingSnapshot; expiresAt: number };
export function useAudioCreationQuote(body: AudioGenerateRequestBody, userId: string | null, enabled: boolean) {
  const key = JSON.stringify({ body, userId });
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string; quote?: AudioCreationQuote; error?: string } | null>(null);
  const currentKey = useRef(key); currentKey.current = key;
  useEffect(() => {
    if (!enabled || !userId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    timer = setTimeout(async () => {
      setState({ key });
      try {
        const response = await authFetch('/api/audio/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
        const data = await response.json();
        if (controller.signal.aborted || currentKey.current !== key) return;
        if (!response.ok || !data.ok || typeof data.inputKey !== 'string' || typeof data.pricing?.currency !== 'string' || !Number.isFinite(data.pricing?.totalCents) || data.pricing.totalCents < 0 || !Number.isFinite(data.expiresAt) || data.expiresAt <= Date.now()) throw new Error(data.error ?? 'audio_quote_failed');
        setState({ key, quote: data });
        timer = setTimeout(() => { setState(null); setAttempt(value => value + 1); }, Math.max(1, data.expiresAt - Date.now()));
      } catch (error) {
        if (!controller.signal.aborted && currentKey.current === key) setState({ key, error: error instanceof Error ? error.message : 'audio_quote_failed' });
      }
    }, 350);
    return () => { controller.abort(); clearTimeout(timer); };
    // body is represented completely by key; preserve request identity across unrelated renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, userId, attempt]);
  const quote = enabled && userId && state?.key === key && state.quote && state.quote.expiresAt > Date.now() ? state.quote : null;
  return { quote, loading: enabled && Boolean(userId) && !quote && !(state?.key === key && state.error), error: state?.key === key ? state.error : undefined,
    retry: () => { setState(null); setAttempt(value => value + 1); } };
}
