import { ENV } from '@/lib/env';
import type { LumaAgentsImagePayload } from './luma-agents-payload';
import { LumaAgentsImageError } from './luma-agents-error';
import {
  normalizeLumaAgentsImageGeneration,
  parseLumaAgentsImageJsonResponse,
  type NormalizedLumaAgentsImageGeneration,
} from './luma-agents-response';

const LUMA_AGENTS_DEFAULT_BASE_URL = 'https://agents.lumalabs.ai';
const LUMA_AGENTS_API_VERSION_PATH = '/v1';
const DEFAULT_SUBMIT_TIMEOUT_MS = 30_000;
const DEFAULT_POLL_TIMEOUT_MS = 30_000;

export type LumaAgentsImageClientConfig = {
  apiKey: string;
  baseUrl: string;
  submitTimeoutMs?: number;
  pollTimeoutMs?: number;
};

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function normalizeLumaAgentsImageBaseUrl(value: string | null | undefined): string {
  const base = trimTrailingSlash((value ?? LUMA_AGENTS_DEFAULT_BASE_URL).trim() || LUMA_AGENTS_DEFAULT_BASE_URL);
  return base.endsWith(LUMA_AGENTS_API_VERSION_PATH) ? base : `${base}${LUMA_AGENTS_API_VERSION_PATH}`;
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

export function getLumaAgentsImageConfig(): LumaAgentsImageClientConfig {
  if (!ENV.LUMA_AGENTS_API_KEY) {
    throw new LumaAgentsImageError('LUMA_AGENTS_API_KEY is missing.', {
      code: 'LUMA_AGENTS_IMAGE_CREDENTIALS_MISSING',
      errorClass: 'auth_error',
    });
  }
  return {
    apiKey: ENV.LUMA_AGENTS_API_KEY,
    baseUrl: normalizeLumaAgentsImageBaseUrl(ENV.LUMA_AGENTS_BASE_URL),
    submitTimeoutMs: positiveInt(ENV.LUMA_AGENTS_SUBMIT_TIMEOUT_MS, DEFAULT_SUBMIT_TIMEOUT_MS),
    pollTimeoutMs: positiveInt(ENV.LUMA_AGENTS_POLL_TIMEOUT_MS, DEFAULT_POLL_TIMEOUT_MS),
  };
}

function timeoutSignal(timeoutMs: number): AbortSignal {
  const signalWithTimeout = (AbortSignal as typeof AbortSignal & { timeout?: (ms: number) => AbortSignal }).timeout;
  if (typeof signalWithTimeout === 'function') {
    return signalWithTimeout(timeoutMs);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs).unref?.();
  return controller.signal;
}

function headersToRecord(headers: Headers): Record<string, string> {
  return Object.fromEntries(headers.entries());
}

export class LumaAgentsImageClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly submitTimeoutMs: number;
  private readonly pollTimeoutMs: number;

  constructor(config: LumaAgentsImageClientConfig = getLumaAgentsImageConfig()) {
    this.apiKey = config.apiKey;
    this.baseUrl = normalizeLumaAgentsImageBaseUrl(config.baseUrl);
    this.submitTimeoutMs = config.submitTimeoutMs ?? DEFAULT_SUBMIT_TIMEOUT_MS;
    this.pollTimeoutMs = config.pollTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
  }

  private async requestJson(params: {
    path: string;
    method: 'GET' | 'POST';
    body?: unknown;
    timeoutMs: number;
    requestId?: string;
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
      const parsed = await parseLumaAgentsImageJsonResponse(response);
      if (!response.ok) {
        throw new LumaAgentsImageError('Luma Agents image request failed.', {
          status: response.status,
          body: parsed,
          headers: headersToRecord(response.headers),
        });
      }
      return parsed;
    } catch (error) {
      if (error instanceof LumaAgentsImageError) throw error;
      const isAbort = error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
      throw new LumaAgentsImageError(
        isAbort ? 'Luma Agents image request timed out.' : 'Luma Agents image network error.',
        {
          code: isAbort ? 'LUMA_AGENTS_IMAGE_TIMEOUT' : 'LUMA_AGENTS_IMAGE_NETWORK_ERROR',
          errorClass: isAbort ? 'timeout' : 'transient_provider_error',
          body: error,
          cause: error,
        }
      );
    }
  }

  async createGeneration(
    payload: LumaAgentsImagePayload,
    options?: { requestId?: string }
  ): Promise<NormalizedLumaAgentsImageGeneration> {
    const raw = await this.requestJson({
      path: '/generations',
      method: 'POST',
      body: payload,
      timeoutMs: this.submitTimeoutMs,
      requestId: options?.requestId,
    });
    const task = normalizeLumaAgentsImageGeneration(raw);
    if (!task.providerJobId) {
      throw new LumaAgentsImageError('Luma Agents image response did not include a generation id.', {
        code: 'LUMA_AGENTS_IMAGE_INVALID_RESPONSE',
        errorClass: 'invalid_response',
        body: raw,
      });
    }
    return task;
  }

  async getGeneration(id: string): Promise<NormalizedLumaAgentsImageGeneration> {
    const raw = await this.requestJson({
      path: `/generations/${encodeURIComponent(id)}`,
      method: 'GET',
      timeoutMs: this.pollTimeoutMs,
    });
    const task = normalizeLumaAgentsImageGeneration(raw, id);
    return task.providerJobId ? task : { ...task, providerJobId: id };
  }
}

export function getLumaAgentsImageClient(): LumaAgentsImageClient {
  return new LumaAgentsImageClient();
}
