/** Opt-in preview diagnostics. Never log credentials, prompts, reference URLs or request keys. */
export function traceModelPicker(event: string, details: Record<string, unknown> = {}) {
  if (typeof window === 'undefined' || process.env.NEXT_PUBLIC_VERCEL_ENV === 'production') return;
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_VERCEL_ENV !== 'preview') return;
  if (new URLSearchParams(window.location.search).get('pickerDebug') !== '1') return;
  console.info('[model-picker]', JSON.stringify({ event, at: Math.round(performance.now()), ...details }));
}
