import type { NormalizedProviderError } from '../types';
import { LUMA_AGENTS_DIRECT_PROVIDER } from './model-map';

export type LumaAgentsErrorClass =
  | 'rate_limit'
  | 'concurrent_limit'
  | 'auth_error'
  | 'billing_or_access'
  | 'invalid_request'
  | 'moderation'
  | 'payload_too_large'
  | 'transient_provider_error'
  | 'timeout'
  | 'invalid_response'
  | 'provider_error'
  | 'unknown';

export class LumaAgentsError extends Error {
  status: number | null;
  code: string | null;
  errorClass: LumaAgentsErrorClass | null;
  body: unknown;
  headers: Record<string, string> | null;

  constructor(
    message: string,
    options: {
      status?: number | null;
      code?: string | null;
      errorClass?: LumaAgentsErrorClass | null;
      body?: unknown;
      headers?: Record<string, string> | null;
      cause?: unknown;
    } = {}
  ) {
    super(message);
    this.name = 'LumaAgentsError';
    this.status = options.status ?? null;
    this.code = options.code ?? null;
    this.errorClass = options.errorClass ?? null;
    this.body = options.body ?? null;
    this.headers = options.headers ?? null;
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function extractPayload(error: unknown): unknown {
  if (error instanceof LumaAgentsError) return error.body;
  const record = asRecord(error);
  return record?.body ?? record?.response ?? record?.data ?? record?.raw ?? null;
}

function extractStatus(error: unknown, payload: unknown): number | null {
  if (error instanceof LumaAgentsError) return error.status;
  const errorRecord = asRecord(error);
  const payloadRecord = asRecord(payload);
  const candidates = [errorRecord?.status, errorRecord?.statusCode, errorRecord?.httpStatusCode, payloadRecord?.status];
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
  }
  return null;
}

function extractDetailMessage(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const entry of value) {
      const message = extractDetailMessage(entry);
      if (message) return message;
    }
    return null;
  }
  const record = asRecord(value);
  if (!record) return null;
  return (
    extractDetailMessage(record.message) ??
    extractDetailMessage(record.msg) ??
    extractDetailMessage(record.reason) ??
    extractDetailMessage(record.detail)
  );
}

function extractCode(error: unknown, payload: unknown): string | null {
  if (error instanceof LumaAgentsError && error.code) return error.code;
  const payloadRecord = asRecord(payload);
  const nestedError = asRecord(payloadRecord?.error);
  const candidates = [
    nestedError?.code,
    payloadRecord?.code,
    payloadRecord?.error_code,
    payloadRecord?.failure_code,
    asRecord(error)?.code,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return null;
}

function extractMessage(error: unknown, payload: unknown): string {
  const payloadRecord = asRecord(payload);
  const nestedError = asRecord(payloadRecord?.error);
  const message =
    extractDetailMessage(payloadRecord?.detail) ??
    extractDetailMessage(nestedError?.message) ??
    extractDetailMessage(payloadRecord?.message) ??
    (error instanceof Error && error.message.trim() ? error.message.trim() : null);
  return message ?? 'Luma Agents request failed.';
}

function isNetworkOrTimeout(error: unknown, code: string | null, message: string): boolean {
  if ((error as { name?: string } | null | undefined)?.name === 'AbortError') return true;
  const normalized = `${code ?? ''} ${message}`.toLowerCase();
  return (
    normalized.includes('timeout') ||
    normalized.includes('timed out') ||
    normalized.includes('network') ||
    normalized.includes('fetch failed') ||
    normalized.includes('econnreset') ||
    normalized.includes('enotfound') ||
    normalized.includes('eai_again') ||
    normalized.includes('und_err_connect_timeout')
  );
}

function messageIndicatesModeration(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('moderation') ||
    normalized.includes('safety') ||
    normalized.includes('policy') ||
    normalized.includes('content')
  );
}

function classify(status: number | null, code: string | null, message: string, error: unknown): LumaAgentsErrorClass {
  if (error instanceof LumaAgentsError && error.errorClass) return error.errorClass;
  if (isNetworkOrTimeout(error, code, message)) {
    return message.toLowerCase().includes('timeout') || (error as { name?: string } | null | undefined)?.name === 'AbortError'
      ? 'timeout'
      : 'transient_provider_error';
  }
  if (messageIndicatesModeration(message)) return 'moderation';
  if (status === 429) {
    const normalized = message.toLowerCase();
    if (normalized.includes('too many concurrent jobs')) return 'concurrent_limit';
    return 'rate_limit';
  }
  if (status === 401 || status === 403) return 'auth_error';
  if (status === 402) return 'billing_or_access';
  if (status === 413) return 'payload_too_large';
  if (status === 400 || status === 422) return 'invalid_request';
  if (status === 502 || status === 503 || status === 504 || (status !== null && status >= 500)) {
    return 'transient_provider_error';
  }
  if (code === 'LUMA_AGENTS_INVALID_RESPONSE') return 'invalid_response';
  return status ? 'provider_error' : 'unknown';
}

function isLumaAgentsSubmitFallbackSafe(errorClass: string): boolean {
  return (
    errorClass === 'rate_limit' ||
    errorClass === 'concurrent_limit' ||
    errorClass === 'transient_provider_error' ||
    errorClass === 'timeout'
  );
}

export function classifyLumaAgentsError(error: unknown): NormalizedProviderError {
  const payload = extractPayload(error);
  const status = extractStatus(error, payload);
  const code = extractCode(error, payload);
  const message = extractMessage(error, payload);
  const errorClass = classify(status, code, message, error);
  return {
    provider: LUMA_AGENTS_DIRECT_PROVIDER,
    message,
    status,
    code,
    errorClass,
    fallbackEligible: isLumaAgentsSubmitFallbackSafe(errorClass),
    raw: payload ?? error,
  };
}

export function shouldFallbackFromLumaAgentsSubmit(params: {
  acceptedProviderJobId: string | null | undefined;
  error: unknown;
  fallbackToFalEnabled: boolean;
}): boolean {
  if (!params.fallbackToFalEnabled || params.acceptedProviderJobId) return false;
  const normalized = classifyLumaAgentsError(params.error);
  return isLumaAgentsSubmitFallbackSafe(normalized.errorClass);
}
