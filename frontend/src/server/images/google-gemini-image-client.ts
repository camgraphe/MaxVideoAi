import { GoogleGeminiImageError } from './google-gemini-image-error';
import type { GoogleGeminiImagePayload } from './google-gemini-image-payload';

export type GoogleGeminiImageClientConfig = {
  apiKey: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
};

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_TIMEOUT_MS = 120_000;

function timeoutSignal(timeoutMs: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function providerMessage(payload: unknown): string | null {
  const root = asRecord(payload);
  const error = asRecord(root?.error);
  const message = error?.message ?? root?.message;
  return typeof message === 'string' && message.trim().length ? message.trim() : null;
}

export async function callGoogleGeminiImage(
  config: GoogleGeminiImageClientConfig,
  payload: GoogleGeminiImagePayload
): Promise<unknown> {
  const apiKey = config.apiKey.trim();
  if (!apiKey) {
    throw new GoogleGeminiImageError('Google Gemini image API key is not configured.', {
      code: 'GOOGLE_GEMINI_IMAGE_API_KEY_MISSING',
      status: 503,
    });
  }

  const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const timeout = timeoutSignal(config.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const fetchFn = config.fetchFn ?? fetch;
  let response: Response;
  try {
    response = await fetchFn(`${baseUrl}/interactions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(payload),
      signal: timeout.signal,
    });
  } catch (error) {
    const isAbort = error instanceof Error && error.name === 'AbortError';
    throw new GoogleGeminiImageError(
      isAbort ? 'Google Gemini image request timed out.' : 'Google Gemini image request failed.',
      {
        code: isAbort ? 'GOOGLE_GEMINI_IMAGE_TIMEOUT' : 'GOOGLE_GEMINI_IMAGE_NETWORK_ERROR',
        status: 502,
        detail: error,
        cause: error,
      }
    );
  } finally {
    timeout.clear();
  }

  const json = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const suffix = providerMessage(json);
    throw new GoogleGeminiImageError(
      `Google Gemini image generation failed (${response.status})${suffix ? `: ${suffix}` : '.'}`,
      {
        code: 'GOOGLE_GEMINI_IMAGE_HTTP_ERROR',
        status: response.status,
        detail: json,
      }
    );
  }
  return json;
}
