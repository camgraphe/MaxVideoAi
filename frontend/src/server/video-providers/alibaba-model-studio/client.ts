import { ENV } from '@/lib/env';
import type { NormalizedVideoProviderTask } from '../types';
import { AlibabaModelStudioError } from './errors';
import { normalizeAlibabaTask, parseAlibabaJsonResponse } from './response';
import type { AlibabaVideoPayload } from './types';

const DEFAULT_BASE_URL = 'https://dashscope-intl.ap-southeast-1.aliyuncs.com';
const DEFAULT_TIMEOUT_MS = 30_000;
const CREATE_VIDEO_PATH = '/api/v1/services/aigc/video-generation/video-synthesis';

export type AlibabaModelStudioClientConfig = {
  apiKey: string;
  baseUrl: string;
  submitTimeoutMs?: number;
  pollTimeoutMs?: number;
  fetchFn?: typeof fetch;
};

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

export function normalizeAlibabaBaseUrl(value: string | null | undefined): string {
  const configured = value?.trim() || DEFAULT_BASE_URL;
  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new AlibabaModelStudioError('Alibaba Model Studio base URL is invalid.', {
      code: 'ALIBABA_MODEL_STUDIO_BASE_URL_INVALID',
      errorClass: 'invalid_request',
    });
  }
  if (parsed.protocol !== 'https:') {
    throw new AlibabaModelStudioError('Alibaba Model Studio base URL must use HTTPS.', {
      code: 'ALIBABA_MODEL_STUDIO_BASE_URL_INSECURE',
      errorClass: 'invalid_request',
    });
  }
  const isSingaporeDashScope = parsed.hostname === 'dashscope-intl.ap-southeast-1.aliyuncs.com';
  const isSingaporeWorkspace = parsed.hostname.endsWith('.ap-southeast-1.maas.aliyuncs.com');
  if (!isSingaporeDashScope && !isSingaporeWorkspace) {
    throw new AlibabaModelStudioError('Alibaba Model Studio base URL must use the Singapore endpoint.', {
      code: 'ALIBABA_MODEL_STUDIO_REGION_MISMATCH',
      errorClass: 'region_mismatch',
    });
  }
  if (parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) {
    throw new AlibabaModelStudioError('Alibaba Model Studio base URL must be a workspace host without a path.', {
      code: 'ALIBABA_MODEL_STUDIO_BASE_URL_PATH_INVALID',
      errorClass: 'invalid_request',
    });
  }
  return parsed.origin;
}

export function getAlibabaModelStudioConfig(): AlibabaModelStudioClientConfig {
  if (!ENV.ALIBABA_MODEL_STUDIO_API_KEY) {
    throw new AlibabaModelStudioError('ALIBABA_MODEL_STUDIO_API_KEY is missing.', {
      code: 'ALIBABA_MODEL_STUDIO_CREDENTIALS_MISSING',
      errorClass: 'auth_error',
    });
  }
  if (ENV.ALIBABA_MODEL_STUDIO_REGION !== 'ap-southeast-1') {
    throw new AlibabaModelStudioError('Alibaba Model Studio must use the Singapore region.', {
      code: 'ALIBABA_MODEL_STUDIO_REGION_MISMATCH',
      errorClass: 'region_mismatch',
    });
  }
  return {
    apiKey: ENV.ALIBABA_MODEL_STUDIO_API_KEY,
    baseUrl: normalizeAlibabaBaseUrl(ENV.ALIBABA_MODEL_STUDIO_BASE_URL),
    submitTimeoutMs: positiveInt(ENV.ALIBABA_MODEL_STUDIO_SUBMIT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    pollTimeoutMs: positiveInt(ENV.ALIBABA_MODEL_STUDIO_POLL_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
  };
}

function createTimeoutSignal(timeoutMs: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

export class AlibabaModelStudioClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly submitTimeoutMs: number;
  private readonly pollTimeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(config: AlibabaModelStudioClientConfig = getAlibabaModelStudioConfig()) {
    this.apiKey = config.apiKey;
    this.baseUrl = normalizeAlibabaBaseUrl(config.baseUrl);
    this.submitTimeoutMs = config.submitTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.pollTimeoutMs = config.pollTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchFn = config.fetchFn ?? globalThis.fetch;
  }

  private async requestJson(params: {
    path: string;
    method: 'GET' | 'POST';
    body?: unknown;
    timeoutMs: number;
  }): Promise<unknown> {
    const timeout = createTimeoutSignal(params.timeoutMs);
    try {
      const response = await this.fetchFn(`${this.baseUrl}${params.path}`, {
        method: params.method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'X-DashScope-Async': 'enable',
        },
        body: params.body === undefined ? undefined : JSON.stringify(params.body),
        cache: 'no-store',
        redirect: 'error',
        signal: timeout.signal,
      });
      const parsed = await parseAlibabaJsonResponse(response);
      if (!response.ok) {
        throw new AlibabaModelStudioError('Alibaba Model Studio request failed.', {
          status: response.status,
          body: parsed,
        });
      }
      return parsed;
    } catch (error) {
      if (error instanceof AlibabaModelStudioError) throw error;
      const isAbort = error instanceof Error && error.name === 'AbortError';
      throw new AlibabaModelStudioError(
        isAbort ? 'Alibaba Model Studio request timed out.' : 'Alibaba Model Studio network error.',
        {
          code: isAbort ? 'ALIBABA_MODEL_STUDIO_TIMEOUT' : 'ALIBABA_MODEL_STUDIO_NETWORK_ERROR',
          errorClass: isAbort ? 'timeout' : 'transient_provider_error',
          cause: error,
        }
      );
    } finally {
      timeout.clear();
    }
  }

  async createVideo(payload: AlibabaVideoPayload): Promise<NormalizedVideoProviderTask> {
    const raw = await this.requestJson({
      path: CREATE_VIDEO_PATH,
      method: 'POST',
      body: payload,
      timeoutMs: this.submitTimeoutMs,
    });
    return normalizeAlibabaTask(raw);
  }

  async getTask(providerJobId: string): Promise<NormalizedVideoProviderTask> {
    const raw = await this.requestJson({
      path: `/api/v1/tasks/${encodeURIComponent(providerJobId)}`,
      method: 'GET',
      timeoutMs: this.pollTimeoutMs,
    });
    return normalizeAlibabaTask(raw, providerJobId);
  }
}

export function getAlibabaModelStudioClient(): AlibabaModelStudioClient {
  return new AlibabaModelStudioClient();
}
