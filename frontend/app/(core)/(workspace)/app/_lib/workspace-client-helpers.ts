import { dispatchAnalyticsEvent } from '@/lib/analytics-client';

export const DESKTOP_RAIL_MIN_WIDTH = 1088;
export const DEFAULT_PROMPT = 'A quiet cinematic shot of neon-lit Tokyo streets in the rain';
export const DEBOUNCE_MS = 200;
export const UNIFIED_VEO_FIRST_LAST_ENGINE_IDS = new Set(['veo-3-1', 'veo-3-1-fast', 'veo-3-1-lite']);

export type GenerateClientError = Error & {
  code?: string;
  originalMessage?: string | null;
  providerMessage?: string | null;
  field?: string;
  allowed?: Array<string | number>;
  value?: unknown;
  details?: {
    requiredCents?: number;
    balanceCents?: number;
    [key: string]: unknown;
  };
};

export function isInsufficientFundsError(
  error: unknown
): error is GenerateClientError & { code: 'INSUFFICIENT_WALLET_FUNDS' } {
  if (!(error instanceof Error)) return false;
  const code = (error as GenerateClientError).code;
  return code === 'INSUFFICIENT_WALLET_FUNDS' || code === 'INSUFFICIENT_FUNDS';
}

export function emitClientMetric(event: string, payload?: Record<string, unknown>) {
  dispatchAnalyticsEvent(event, payload);
}
