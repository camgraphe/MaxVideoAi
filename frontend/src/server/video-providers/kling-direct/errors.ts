import type { NormalizedProviderError } from '../types';

export class KlingDirectError extends Error {
  status: number | null;
  code: string | null;
  providerMessage: string | null;
  body: unknown;

  constructor(
    message: string,
    options: {
      status?: number | null;
      code?: string | null;
      providerMessage?: string | null;
      body?: unknown;
      cause?: unknown;
    } = {}
  ) {
    super(message);
    this.name = 'KlingDirectError';
    this.status = options.status ?? null;
    this.code = options.code ?? null;
    this.providerMessage = options.providerMessage ?? null;
    this.body = options.body ?? null;
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

function errorCode(error: unknown): string | null {
  if (error instanceof KlingDirectError) return error.code;
  const candidate = (error as { code?: unknown } | null | undefined)?.code;
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
}

function errorStatus(error: unknown): number | null {
  if (error instanceof KlingDirectError) return error.status;
  const candidate = (error as { status?: unknown } | null | undefined)?.status;
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : null;
}

function errorMessage(error: unknown): string {
  if (error instanceof KlingDirectError && error.providerMessage) return error.providerMessage;
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : 'Kling direct request failed.';
}

function isNetworkOrTimeout(error: unknown, code: string | null, message: string): boolean {
  if ((error as { name?: string } | null | undefined)?.name === 'AbortError') return true;
  const normalized = `${code ?? ''} ${message}`.toLowerCase();
  return (
    normalized.includes('timeout') ||
    normalized.includes('network') ||
    normalized.includes('fetch failed') ||
    normalized.includes('econnreset') ||
    normalized.includes('enotfound') ||
    normalized.includes('eai_again') ||
    normalized.includes('und_err_connect_timeout')
  );
}

export function classifyKlingDirectError(error: unknown): NormalizedProviderError {
  const status = errorStatus(error);
  const code = errorCode(error);
  const message = errorMessage(error);
  const serviceCode = code ? Number.parseInt(code, 10) : null;
  let errorClass = 'provider_error';
  let fallbackEligible = false;

  if (isNetworkOrTimeout(error, code, message)) {
    errorClass = 'network_or_timeout';
    fallbackEligible = true;
  } else if (code === 'KLING_TASK_ID_MISSING' || code === 'KLING_INVALID_RESPONSE') {
    errorClass = 'invalid_provider_response';
    fallbackEligible = true;
  } else if (status === 401 || (serviceCode !== null && serviceCode >= 1000 && serviceCode <= 1004)) {
    errorClass = 'auth_error';
  } else if (serviceCode === 1101 || serviceCode === 1102) {
    errorClass = 'insufficient_provider_credits';
  } else if (serviceCode === 1103) {
    errorClass = 'provider_access_denied';
  } else if (serviceCode !== null && serviceCode >= 1200 && serviceCode <= 1203) {
    errorClass = 'invalid_request';
  } else if (serviceCode === 1300 || serviceCode === 1301) {
    errorClass = 'moderation';
  } else if (status === 429 && (code === null || serviceCode === 1302 || serviceCode === 1303)) {
    errorClass = 'rate_limited';
    fallbackEligible = true;
  } else if ((serviceCode !== null && serviceCode >= 5000 && serviceCode <= 5002) || (status !== null && status >= 500)) {
    errorClass = 'provider_unavailable';
    fallbackEligible = true;
  } else if (status === 429) {
    errorClass = 'provider_quota_or_rate_limit';
  }

  return {
    provider: 'kling_direct',
    message,
    status,
    code,
    errorClass,
    fallbackEligible,
    raw: error instanceof KlingDirectError ? error.body ?? error : error,
  };
}

export function shouldFallbackFromKlingDirectSubmit(params: {
  acceptedProviderJobId: string | null | undefined;
  error: unknown;
  fallbackToFalEnabled: boolean;
}): boolean {
  if (!params.fallbackToFalEnabled) return false;
  if (params.acceptedProviderJobId) return false;
  return classifyKlingDirectError(params.error).fallbackEligible;
}
