import type { NormalizedProviderError } from '../types';
import { GOOGLE_VERTEX_VEO_PROVIDER } from './model-map';

export type GoogleVertexVeoErrorClass =
  | 'timeout'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'invalid_response'
  | 'moderation'
  | 'invalid_request'
  | 'auth_error'
  | 'billing_or_access'
  | 'unsupported_params'
  | 'provider_error'
  | 'unknown';

export class GoogleVertexVeoError extends Error {
  status: number | null;
  code: string | null;
  errorClass: GoogleVertexVeoErrorClass;
  raw: unknown;

  constructor(
    message: string,
    options: {
      status?: number | null;
      code?: string | null;
      errorClass?: GoogleVertexVeoErrorClass;
      raw?: unknown;
      cause?: unknown;
    } = {}
  ) {
    super(message);
    this.name = 'GoogleVertexVeoError';
    this.status = options.status ?? null;
    this.code = options.code ?? null;
    this.errorClass = options.errorClass ?? 'unknown';
    this.raw = options.raw ?? null;
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function extractGoogleErrorPayload(error: unknown): unknown {
  const record = asRecord(error);
  return record?.body ?? record?.response ?? record?.data ?? record?.raw ?? null;
}

function extractStatus(error: unknown, payload: unknown): number | null {
  const errorRecord = asRecord(error);
  const payloadRecord = asRecord(payload);
  const nestedError = asRecord(payloadRecord?.error);
  const candidates = [
    errorRecord?.status,
    errorRecord?.statusCode,
    errorRecord?.httpStatusCode,
    nestedError?.code,
    payloadRecord?.code,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return null;
}

function extractCode(payload: unknown): string | null {
  const payloadRecord = asRecord(payload);
  const nestedError = asRecord(payloadRecord?.error);
  const candidates = [nestedError?.status, nestedError?.code, payloadRecord?.status, payloadRecord?.code];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

function extractMessage(error: unknown, payload: unknown): string {
  const payloadRecord = asRecord(payload);
  const nestedError = asRecord(payloadRecord?.error);
  const candidates = [
    nestedError?.message,
    payloadRecord?.message,
    error instanceof Error ? error.message : null,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return 'Google Vertex Veo request failed.';
}

function classifyByMessage(message: string): GoogleVertexVeoErrorClass | null {
  const normalized = message.toLowerCase();
  if (normalized.includes('abort') || normalized.includes('timeout') || normalized.includes('timed out')) {
    return 'timeout';
  }
  if (normalized.includes('safety') || normalized.includes('policy') || normalized.includes('rai')) {
    return 'moderation';
  }
  if (normalized.includes('billing') || normalized.includes('quota project') || normalized.includes('not enabled')) {
    return 'billing_or_access';
  }
  if (normalized.includes('permission') || normalized.includes('unauthenticated') || normalized.includes('forbidden')) {
    return 'auth_error';
  }
  if (normalized.includes('unsupported')) {
    return 'unsupported_params';
  }
  return null;
}

function classify(status: number | null, code: string | null, message: string): GoogleVertexVeoErrorClass {
  if (code === 'GOOGLE_VERTEX_VEO_NO_OPERATION') return 'invalid_response';
  if (code === 'GOOGLE_VERTEX_VEO_UNSUPPORTED_PARAMS') return 'unsupported_params';
  const byMessage = classifyByMessage(message);
  if (byMessage) return byMessage;
  if (status === 429) return 'rate_limited';
  if (status === 401 || status === 403) return 'auth_error';
  if (status === 400 || status === 422) return 'invalid_request';
  if (status && status >= 500) return 'provider_unavailable';
  return status ? 'provider_error' : 'unknown';
}

export function classifyGoogleVertexVeoError(error: unknown): NormalizedProviderError {
  if (error instanceof GoogleVertexVeoError) {
    const rawCode = extractCode(error.raw);
    const code = error.code ?? rawCode;
    const message = extractMessage(error, error.raw);
    const errorClass = error.errorClass === 'unknown' ? classify(error.status, code, message) : error.errorClass;
    return {
      provider: GOOGLE_VERTEX_VEO_PROVIDER,
      message,
      status: error.status,
      code,
      errorClass,
      fallbackEligible: isGoogleVertexVeoSubmitFallbackSafe(errorClass, error.status),
      raw: error.raw,
    };
  }

  const payload = extractGoogleErrorPayload(error);
  const status = extractStatus(error, payload);
  const code = extractCode(payload);
  const message = extractMessage(error, payload);
  const errorClass = classify(status, code, message);
  return {
    provider: GOOGLE_VERTEX_VEO_PROVIDER,
    message,
    status,
    code,
    errorClass,
    fallbackEligible: isGoogleVertexVeoSubmitFallbackSafe(errorClass, status),
    raw: payload ?? error,
  };
}

export function isGoogleVertexVeoSubmitFallbackSafe(errorClass: string, status: number | null): boolean {
  return (
    errorClass === 'timeout' ||
    errorClass === 'rate_limited' ||
    errorClass === 'provider_unavailable' ||
    errorClass === 'invalid_response' ||
    status === 429 ||
    Boolean(status && status >= 500)
  );
}

export function shouldFallbackFromGoogleVertexVeoSubmit(params: {
  acceptedProviderJobId: string | null;
  error: unknown;
  fallbackToFalEnabled: boolean;
}): boolean {
  if (!params.fallbackToFalEnabled || params.acceptedProviderJobId) return false;
  const normalized = classifyGoogleVertexVeoError(params.error);
  return isGoogleVertexVeoSubmitFallbackSafe(normalized.errorClass, normalized.status);
}
