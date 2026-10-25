import { NANO21_MODEL_ID } from '@/lib/nano-banana-2-1';
import {
  getGoogleVertexAccessToken,
  parseGoogleVertexServiceAccount,
  type GoogleVertexServiceAccount,
} from '@/server/video-providers/google-vertex-auth';
import { GoogleVertexImageError } from './google-vertex-image-error';
import type { GoogleVertexImagePayload } from './google-vertex-image-payload';
import { extractGoogleVertexImages, isValidatedGoogleVertexImageResponse, summarizeGoogleVertexImageResponse } from './google-vertex-image-response';

export type GoogleVertexImageClientConfig = {
  projectId: string;
  location: string;
  apiBaseUrl: string;
  serviceAccount: GoogleVertexServiceAccount;
  fetchFn?: typeof fetch;
  getAccessTokenFn?: (serviceAccount: GoogleVertexServiceAccount) => Promise<string>;
  timeoutMs?: number;
  retryDelayMs?: number;
};

const GOOGLE_VERTEX_IMAGE_MAX_ATTEMPTS = 2;

function isRetryableGoogleVertexImageError(error: unknown): boolean {
  if (!(error instanceof GoogleVertexImageError)) return false;
  return (
    error.status === 429 ||
    Boolean(error.status && error.status >= 500) ||
    error.code === 'GOOGLE_VERTEX_IMAGE_TIMEOUT' ||
    error.code === 'GOOGLE_VERTEX_IMAGE_NETWORK_ERROR'
  );
}

async function waitForRetry(delayMs: number): Promise<void> {
  if (delayMs <= 0) return;
  await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}

export function isGoogleVertexImageConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(
    env.GOOGLE_VERTEX_PROJECT_ID?.trim() &&
      env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON?.trim() &&
      (env.GOOGLE_VERTEX_INPUT_GCS_URI?.trim() || env.GOOGLE_VERTEX_VEO_INPUT_GCS_URI?.trim())
  );
}

function defaultConfig(): GoogleVertexImageClientConfig {
  const projectId = (process.env.GOOGLE_VERTEX_PROJECT_ID ?? '').trim();
  if (!projectId) throw new GoogleVertexImageError('GOOGLE_VERTEX_PROJECT_ID is missing.', { code: 'GOOGLE_VERTEX_PROJECT_ID_MISSING' });
  return {
    projectId,
    location: (process.env.GOOGLE_VERTEX_LOCATION ?? 'global').trim() || 'global',
    apiBaseUrl: (process.env.GOOGLE_VERTEX_API_BASE_URL ?? 'https://aiplatform.googleapis.com').trim(),
    serviceAccount: parseGoogleVertexServiceAccount(process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON),
  };
}

export class GoogleVertexImageClient {
  constructor(private readonly config: GoogleVertexImageClientConfig = defaultConfig()) {}

  async accessToken(): Promise<string> {
    return this.config.getAccessTokenFn
      ? this.config.getAccessTokenFn(this.config.serviceAccount)
      : getGoogleVertexAccessToken({ serviceAccount: this.config.serviceAccount, fetchFn: this.config.fetchFn });
  }

  async generateContent(modelId: string, payload: GoogleVertexImagePayload): Promise<unknown> {
    // A new Nano21 quote covers one native POST. Never retry ambiguous output.
    const maxAttempts = modelId === NANO21_MODEL_ID ? 1 : GOOGLE_VERTEX_IMAGE_MAX_ATTEMPTS;
    let lastResponse: unknown = null;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const response = await this.generateContentOnce(modelId, payload);
        lastResponse = response;
        const hasImages = extractGoogleVertexImages(response).length > 0;
        const responseSummary = summarizeGoogleVertexImageResponse(response);
        const isLastAttempt = attempt === maxAttempts - 1;
        if (hasImages || responseSummary.blockedForSafety || isLastAttempt) {
          return response;
        }
      } catch (error) {
        const isLastAttempt = attempt === maxAttempts - 1;
        if (!isRetryableGoogleVertexImageError(error) || isLastAttempt) throw error;
      }
      await waitForRetry(this.config.retryDelayMs ?? 500);
    }
    return lastResponse;
  }

  private async generateContentOnce(modelId: string, payload: GoogleVertexImagePayload): Promise<unknown> {
    const nano21 = modelId === NANO21_MODEL_ID;
    let imagePostStarted = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 120_000);
    const base = modelId === NANO21_MODEL_ID ? 'https://aiplatform.googleapis.com' : this.config.apiBaseUrl.replace(/\/+$/, '');
    const url = `${base}/v1/projects/${encodeURIComponent(this.config.projectId)}/locations/${encodeURIComponent(
      modelId === NANO21_MODEL_ID ? 'global' : this.config.location
    )}/publishers/google/models/${encodeURIComponent(modelId)}:generateContent`;
    try {
      // Complete local/auth preparation before crossing the image POST boundary.
      const accessToken = await this.accessToken();
      const body = JSON.stringify(payload);
      const headerValues = { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' };
      const headers = nano21 ? new Headers(headerValues) : headerValues;
      if (nano21 && controller.signal.aborted) {
        throw new GoogleVertexImageError('Google Vertex image preparation timed out before submission.', {
          code: 'GOOGLE_VERTEX_IMAGE_TIMEOUT', submissionState: 'not_submitted',
        });
      }
      imagePostStarted = true;
      const response = await (this.config.fetchFn ?? fetch)(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });
      let json: unknown;
      try { json = await response.json(); }
      catch {
        if (nano21 && response.ok) {
          throw new GoogleVertexImageError('Google Vertex image response could not be read; the outcome is uncertain.', {
            status: 502, code: 'GOOGLE_VERTEX_IMAGE_PROTOCOL_ERROR', submissionState: 'uncertain',
          });
        }
        json = null;
      }
      if (!response.ok) {
        throw new GoogleVertexImageError(`Google Vertex image request failed (${response.status}).`, {
          status: response.status,
          code: 'GOOGLE_VERTEX_IMAGE_HTTP_ERROR',
          detail: json,
          ...(nano21 ? { submissionState: response.status >= 500 ? 'uncertain' as const : 'definitive' as const } : {}),
        });
      }
      if (nano21 && !isValidatedGoogleVertexImageResponse(json)) {
        throw new GoogleVertexImageError('Google Vertex image response was not a validated result; the outcome is uncertain.', {
          status: 502, code: 'GOOGLE_VERTEX_IMAGE_PROTOCOL_ERROR', submissionState: 'uncertain',
        });
      }
      return json;
    } catch (error) {
      if (error instanceof GoogleVertexImageError) {
        if (nano21 && error.submissionState === undefined) error.submissionState = imagePostStarted ? 'uncertain' : 'not_submitted';
        throw error;
      }
      const timedOut = error instanceof Error && error.name === 'AbortError';
      throw new GoogleVertexImageError(timedOut ? 'Google Vertex image request timed out.' : 'Google Vertex image network error.', {
        code: timedOut ? 'GOOGLE_VERTEX_IMAGE_TIMEOUT' : 'GOOGLE_VERTEX_IMAGE_NETWORK_ERROR',
        cause: error,
        ...(nano21 ? { submissionState: imagePostStarted ? 'uncertain' as const : 'not_submitted' as const } : {}),
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
