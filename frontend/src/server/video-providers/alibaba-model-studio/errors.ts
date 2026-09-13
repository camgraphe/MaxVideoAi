import type { NormalizedProviderError } from '../types';
import { ALIBABA_MODEL_STUDIO_PROVIDER } from './model-map';

export type AlibabaModelStudioErrorClass =
  | 'rate_limit'
  | 'auth_error'
  | 'billing_or_access'
  | 'region_mismatch'
  | 'invalid_request'
  | 'moderation'
  | 'payload_too_large'
  | 'transient_provider_error'
  | 'timeout'
  | 'invalid_response'
  | 'provider_error'
  | 'unknown';

export class AlibabaModelStudioError extends Error {
  status: number | null;
  code: string | null;
  errorClass: AlibabaModelStudioErrorClass | null;
  body: unknown;

  constructor(
    message: string,
    options: {
      status?: number | null;
      code?: string | null;
      errorClass?: AlibabaModelStudioErrorClass | null;
      body?: unknown;
      cause?: unknown;
    } = {}
  ) {
    super(message);
    this.name = 'AlibabaModelStudioError';
    this.status = options.status ?? null;
    this.code = options.code ?? null;
    this.errorClass = options.errorClass ?? null;
    this.body = options.body ?? null;
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function extractPayload(error: unknown): unknown {
  if (error instanceof AlibabaModelStudioError) return error.body;
  const record = asRecord(error);
  return record?.body ?? record?.response ?? record?.data ?? record?.raw ?? null;
}

function extractStatus(error: unknown, payload: unknown): number | null {
  if (error instanceof AlibabaModelStudioError) return error.status;
  const errorRecord = asRecord(error);
  const payloadRecord = asRecord(payload);
  for (const candidate of [errorRecord?.status, errorRecord?.statusCode, payloadRecord?.status]) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
  }
  return null;
}

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function extractCode(error: unknown, payload: unknown): string | null {
  if (error instanceof AlibabaModelStudioError && error.code) return error.code;
  const payloadRecord = asRecord(payload);
  const nestedError = asRecord(payloadRecord?.error);
  return cleanString(nestedError?.code) ?? cleanString(payloadRecord?.code) ?? cleanString(asRecord(error)?.code);
}

function extractMessage(error: unknown, payload: unknown): string {
  const payloadRecord = asRecord(payload);
  const nestedError = asRecord(payloadRecord?.error);
  return cleanString(nestedError?.message)
    ?? cleanString(payloadRecord?.message)
    ?? (error instanceof Error ? cleanString(error.message) : null)
    ?? 'Alibaba Model Studio request failed.';
}

function classify(params: {
  error: unknown;
  status: number | null;
  code: string | null;
  message: string;
}): AlibabaModelStudioErrorClass {
  if (params.error instanceof AlibabaModelStudioError && params.error.errorClass) {
    return params.error.errorClass;
  }
  const normalized = `${params.code ?? ''} ${params.message}`.toLowerCase();
  const name = (params.error as { name?: string } | null | undefined)?.name;
  if (name === 'AbortError' || normalized.includes('timeout') || normalized.includes('timed out')) return 'timeout';
  if (
    normalized.includes('network')
    || normalized.includes('fetch failed')
    || normalized.includes('econnreset')
    || normalized.includes('enotfound')
    || normalized.includes('eai_again')
  ) return 'transient_provider_error';
  if (
    normalized.includes('datainspection')
    || normalized.includes('content policy')
    || normalized.includes('moderation')
    || normalized.includes('inappropriate')
    || normalized.includes('sensitive')
  ) return 'moderation';
  if (normalized.includes('region') && (normalized.includes('mismatch') || normalized.includes('not available'))) {
    return 'region_mismatch';
  }
  if (params.status === 429) return 'rate_limit';
  if (params.status === 401 || params.status === 403) return 'auth_error';
  if (params.status === 402 || normalized.includes('insufficient balance') || normalized.includes('quota exhausted')) {
    return 'billing_or_access';
  }
  if (params.status === 413) return 'payload_too_large';
  if (params.status === 400 || params.status === 404 || params.status === 422) return 'invalid_request';
  if (params.status !== null && params.status >= 500) return 'transient_provider_error';
  if (params.code === 'ALIBABA_MODEL_STUDIO_INVALID_RESPONSE') return 'invalid_response';
  return params.status === null ? 'unknown' : 'provider_error';
}

function fallbackSafe(errorClass: string): boolean {
  return errorClass === 'rate_limit'
    || errorClass === 'transient_provider_error'
    || errorClass === 'timeout'
    || errorClass === 'invalid_response';
}

export function classifyAlibabaModelStudioError(error: unknown): NormalizedProviderError {
  const payload = extractPayload(error);
  const status = extractStatus(error, payload);
  const code = extractCode(error, payload);
  const message = extractMessage(error, payload);
  const errorClass = classify({ error, status, code, message });
  return {
    provider: ALIBABA_MODEL_STUDIO_PROVIDER,
    message,
    status,
    code,
    errorClass,
    fallbackEligible: fallbackSafe(errorClass),
    raw: payload ?? null,
  };
}

export function shouldFallbackFromAlibabaSubmit(params: {
  acceptedProviderJobId: string | null | undefined;
  error: unknown;
  fallbackToFalEnabled: boolean;
}): boolean {
  if (!params.fallbackToFalEnabled || params.acceptedProviderJobId) return false;
  return classifyAlibabaModelStudioError(params.error).fallbackEligible;
}
