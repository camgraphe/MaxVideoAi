import { ENV } from '@/lib/env';
import type { NormalizedVideoProviderTask } from '../types';
import { LumaAgentsError } from './errors';
import {
  LUMA_AGENTS_API_VERSION_PATH,
  LUMA_AGENTS_DEFAULT_BASE_URL,
} from './constants';
import type { LumaAgentsVideoPayload } from './payload';
import { normalizeLumaAgentsGeneration, parseLumaAgentsJsonResponse } from './response';

const DEFAULT_SUBMIT_TIMEOUT_MS = 30_000;
const DEFAULT_POLL_TIMEOUT_MS = 30_000;

export type LumaAgentsClientConfig = {
  apiKey: string;
  baseUrl: string;
  submitTimeoutMs?: number;
  pollTimeoutMs?: number;
};

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function normalizeLumaAgentsBaseUrl(value: string | null | undefined): string {
  const base = trimTrailingSlash((value ?? LUMA_AGENTS_DEFAULT_BASE_URL).trim() || LUMA_AGENTS_DEFAULT_BASE_URL);
  return base.endsWith(LUMA_AGENTS_API_VERSION_PATH) ? base : `${base}${LUMA_AGENTS_API_VERSION_PATH}`;
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

export function getLumaAgentsConfig(): LumaAgentsClientConfig {
  if (!ENV.LUMA_AGENTS_API_KEY) {
    throw new LumaAgentsError('LUMA_AGENTS_API_KEY is missing.', {
      code: 'LUMA_AGENTS_CREDENTIALS_MISSING',
      errorClass: 'auth_error',
    });
  }
  return {
    apiKey: ENV.LUMA_AGENTS_API_KEY,
    baseUrl: normalizeLumaAgentsBaseUrl(ENV.LUMA_AGENTS_BASE_URL),
    submitTimeoutMs: positiveInt(ENV.LUMA_AGENTS_SUBMIT_TIMEOUT_MS, DEFAULT_SUBMIT_TIMEOUT_MS),
    pollTimeoutMs: positiveInt(ENV.LUMA_AGENTS_SUBMIT_TIMEOUT_MS, DEFAULT_POLL_TIMEOUT_MS),
  };
}

function timeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs).unref?.();
  return controller.signal;
}

function headersToRecord(headers: Headers): Record<string, string> {
  return Object.fromEntries(headers.entries());
}

export class LumaAgentsClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly submitTimeoutMs: number;
  private readonly pollTimeoutMs: number;

  constructor(config: LumaAgentsClientConfig = getLumaAgentsConfig()) {
    this.apiKey = config.apiKey;
    this.baseUrl = normalizeLumaAgentsBaseUrl(config.baseUrl);
    this.submitTimeoutMs = config.submitTimeoutMs ?? DEFAULT_SUBMIT_TIMEOUT_MS;
    this.pollTimeoutMs = config.pollTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
  }

  private async requestJson(params: {
    path: string;
    method: 'GET' | 'POST';
    body?: unknown;
    timeoutMs: number;
    requestId?: string;
    expectedStatus?: number;
  }): Promise<unknown> {
    try {
      const response = await fetch(`${this.baseUrl}${params.path}`, {
        method: params.method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...(params.requestId ? { 'X-Request-ID': params.requestId } : {}),
        },
        body: params.body === undefined ? undefined : JSON.stringify(params.body),
        cache: 'no-store',
        signal: timeoutSignal(params.timeoutMs),
      });
      const parsed = await parseLumaAgentsJsonResponse(response);
      if (!response.ok || (params.expectedStatus !== undefined && response.status !== params.expectedStatus)) {
        throw new LumaAgentsError('Luma Agents request failed.', {
          status: response.status,
          body: parsed,
          headers: headersToRecord(response.headers),
        });
      }
      return parsed;
    } catch (error) {
      if (error instanceof LumaAgentsError) throw error;
      const isAbort = error instanceof Error && error.name === 'AbortError';
      throw new LumaAgentsError(isAbort ? 'Luma Agents request timed out.' : 'Luma Agents network error.', {
        code: isAbort ? 'LUMA_AGENTS_TIMEOUT' : 'LUMA_AGENTS_NETWORK_ERROR',
        errorClass: isAbort ? 'timeout' : 'transient_provider_error',
        body: error,
        cause: error,
      });
    }
  }

  async createGeneration(
    payload: LumaAgentsVideoPayload,
    options?: { requestId?: string }
  ): Promise<NormalizedVideoProviderTask> {
    const raw = await this.requestJson({
      path: '/generations',
      method: 'POST',
      body: payload,
      timeoutMs: this.submitTimeoutMs,
      requestId: options?.requestId,
      expectedStatus: 201,
    });
    const task = normalizeLumaAgentsGeneration(raw);
    if (!task.providerJobId) {
      throw new LumaAgentsError('Luma Agents response did not include a generation id.', {
        code: 'LUMA_AGENTS_INVALID_RESPONSE',
        errorClass: 'invalid_response',
        body: raw,
      });
    }
    return task;
  }

  async getGeneration(id: string): Promise<NormalizedVideoProviderTask> {
    const raw = await this.requestJson({
      path: `/generations/${encodeURIComponent(id)}`,
      method: 'GET',
      timeoutMs: this.pollTimeoutMs,
    });
    const task = normalizeLumaAgentsGeneration(raw, id);
    return task.providerJobId ? task : { ...task, providerJobId: id };
  }
}

export function getLumaAgentsClient(): LumaAgentsClient {
  return new LumaAgentsClient();
}
