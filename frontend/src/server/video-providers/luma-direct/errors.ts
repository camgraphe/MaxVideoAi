import type { NormalizedProviderError } from '../types';
import { LUMA_DIRECT_PROVIDER } from './model-map';
import { LumaDirectClientError } from './client';

export type LumaDirectErrorClass =
  | 'auth_error'
  | 'rate_limited'
  | 'invalid_request'
  | 'moderation'
  | 'provider_unavailable'
  | 'invalid_response'
  | 'unknown';

function rawErrorCode(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const code = record.code ?? record.error_code ?? record.failure_code;
  return typeof code === 'string' && code.trim().length ? code.trim() : null;
}

function classifyStatus(status: number | null, raw: unknown): LumaDirectErrorClass {
  const code = rawErrorCode(raw)?.toLowerCase() ?? '';
  if (status === 401 || status === 403) return 'auth_error';
  if (status === 429) return 'rate_limited';
  if (code.includes('moderation') || code.includes('safety')) return 'moderation';
  if (status === 400 || status === 422) return 'invalid_request';
  if (status != null && status >= 500) return 'provider_unavailable';
  return 'unknown';
}

export function classifyLumaDirectError(error: unknown): NormalizedProviderError {
  const status = error instanceof LumaDirectClientError ? error.status : null;
  const raw = error instanceof LumaDirectClientError ? error.raw : error;
  const errorClass = classifyStatus(status, raw);
  return {
    provider: LUMA_DIRECT_PROVIDER,
    message: error instanceof Error ? error.message : 'Luma direct request failed.',
    status,
    code: rawErrorCode(raw),
    errorClass,
    fallbackEligible: ['auth_error', 'rate_limited', 'provider_unavailable', 'unknown'].includes(errorClass),
    raw,
  };
}

export function shouldFallbackFromLumaDirectSubmit(params: {
  error: unknown;
  fallbackToFalEnabled: boolean;
}): boolean {
  if (!params.fallbackToFalEnabled) return false;
  return classifyLumaDirectError(params.error).fallbackEligible;
}
