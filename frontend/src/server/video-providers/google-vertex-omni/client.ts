import { createSign } from 'node:crypto';
import { GoogleVertexOmniError } from './errors';

type GoogleServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
  project_id?: string;
};

export type GoogleVertexOmniInteractionRequest = {
  model: string;
  input: unknown[];
  generation_config?: Record<string, unknown>;
  response_format?: {
    type?: string;
    aspect_ratio?: string;
    delivery?: string;
  };
  background?: boolean;
  store?: boolean;
  previous_interaction_id?: string;
};

export type GoogleVertexOmniInteraction = {
  id?: string;
  name?: string;
  status?: string;
  error?: unknown;
  output?: unknown;
  outputs?: unknown;
  response?: unknown;
  model?: string;
  metadata?: unknown;
};

export type GoogleVertexOmniClientConfig = {
  projectId: string;
  location: string;
  serviceAccount: GoogleServiceAccount;
  apiBaseUrl: string;
  fetchFn?: typeof fetch;
  getAccessTokenFn?: (serviceAccount: GoogleServiceAccount) => Promise<string>;
  submitTimeoutMs?: number;
  pollTimeoutMs?: number;
  downloadTimeoutMs?: number;
};

type GoogleVertexOmniEnv = Partial<Record<
  | 'GOOGLE_VERTEX_OMNI_PROJECT_ID'
  | 'GOOGLE_VERTEX_OMNI_LOCATION'
  | 'GOOGLE_VERTEX_OMNI_API_BASE_URL'
  | 'GOOGLE_VERTEX_OMNI_SERVICE_ACCOUNT_JSON'
  | 'GOOGLE_VERTEX_OMNI_SUBMIT_TIMEOUT_MS'
  | 'GOOGLE_VERTEX_OMNI_POLL_TIMEOUT_MS'
  | 'GOOGLE_VERTEX_OMNI_DOWNLOAD_TIMEOUT_MS'
  | 'GOOGLE_VERTEX_PROJECT_ID'
  | 'GOOGLE_VERTEX_LOCATION'
  | 'GOOGLE_VERTEX_API_BASE_URL'
  | 'GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON',
  string | undefined
>>;

let cachedToken: { accessToken: string; expiresAtMs: number } | null = null;

const DEFAULT_SUBMIT_TIMEOUT_MS = 90_000;
const DEFAULT_POLL_TIMEOUT_MS = 45_000;
const DEFAULT_DOWNLOAD_TIMEOUT_MS = 90_000;
const GOOGLE_OAUTH_TIMEOUT_MS = 30_000;

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function parseServiceAccount(raw: string | undefined): GoogleServiceAccount {
  const value = (raw ?? '').trim();
  if (!value) {
    throw new Error('GOOGLE_VERTEX_OMNI_SERVICE_ACCOUNT_JSON or GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON is missing.');
  }

  const json = value.startsWith('{') ? value : Buffer.from(value, 'base64').toString('utf8');
  const parsed = JSON.parse(json) as Partial<GoogleServiceAccount>;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('Google service account JSON is missing client_email or private_key.');
  }
  return {
    client_email: parsed.client_email,
    private_key: parsed.private_key.replace(/\\n/g, '\n'),
    token_uri: parsed.token_uri,
    project_id: parsed.project_id,
  };
}

function readEnv(env: GoogleVertexOmniEnv, primary: keyof GoogleVertexOmniEnv, fallback: keyof GoogleVertexOmniEnv) {
  return (env[primary] ?? env[fallback] ?? '').trim();
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

function getConfig(env: GoogleVertexOmniEnv = process.env as GoogleVertexOmniEnv): GoogleVertexOmniClientConfig {
  const projectId = readEnv(env, 'GOOGLE_VERTEX_OMNI_PROJECT_ID', 'GOOGLE_VERTEX_PROJECT_ID');
  if (!projectId) {
    throw new Error('GOOGLE_VERTEX_OMNI_PROJECT_ID or GOOGLE_VERTEX_PROJECT_ID is missing.');
  }

  return {
    projectId,
    location: readEnv(env, 'GOOGLE_VERTEX_OMNI_LOCATION', 'GOOGLE_VERTEX_LOCATION') || 'global',
    apiBaseUrl:
      readEnv(env, 'GOOGLE_VERTEX_OMNI_API_BASE_URL', 'GOOGLE_VERTEX_API_BASE_URL') ||
      'https://aiplatform.googleapis.com',
    serviceAccount: parseServiceAccount(
      env.GOOGLE_VERTEX_OMNI_SERVICE_ACCOUNT_JSON ?? env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON
    ),
    submitTimeoutMs: positiveInt(env.GOOGLE_VERTEX_OMNI_SUBMIT_TIMEOUT_MS, DEFAULT_SUBMIT_TIMEOUT_MS),
    pollTimeoutMs: positiveInt(env.GOOGLE_VERTEX_OMNI_POLL_TIMEOUT_MS, DEFAULT_POLL_TIMEOUT_MS),
    downloadTimeoutMs: positiveInt(env.GOOGLE_VERTEX_OMNI_DOWNLOAD_TIMEOUT_MS, DEFAULT_DOWNLOAD_TIMEOUT_MS),
  };
}

function timeoutSignal(timeoutMs: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

function buildJwt(serviceAccount: GoogleServiceAccount): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const tokenUri = serviceAccount.token_uri || 'https://oauth2.googleapis.com/token';
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: tokenUri,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  };
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(serviceAccount.private_key);
  return `${signingInput}.${base64Url(signature)}`;
}

async function getAccessToken(serviceAccount: GoogleServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expiresAtMs - Date.now() > 60_000) {
    return cachedToken.accessToken;
  }

  const tokenUri = serviceAccount.token_uri || 'https://oauth2.googleapis.com/token';
  const timeout = timeoutSignal(GOOGLE_OAUTH_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(tokenUri, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: buildJwt(serviceAccount),
      }),
      signal: timeout.signal,
    });
  } catch (error) {
    const isAbort = error instanceof Error && error.name === 'AbortError';
    throw new GoogleVertexOmniError(
      isAbort ? 'Google OAuth token request timed out.' : 'Google OAuth token request failed.',
      {
        code: isAbort ? 'GOOGLE_VERTEX_OMNI_TOKEN_TIMEOUT' : 'GOOGLE_VERTEX_OMNI_TOKEN_NETWORK_ERROR',
        errorClass: isAbort ? 'timeout' : 'provider_unavailable',
        raw: error,
        cause: error,
      }
    );
  } finally {
    timeout.clear();
  }
  const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const code = typeof json?.error === 'string' ? json.error : response.statusText;
    throw new Error(`Google OAuth token request failed (${response.status}): ${code}`);
  }
  const accessToken = typeof json?.access_token === 'string' ? json.access_token : null;
  const expiresIn = typeof json?.expires_in === 'number' ? json.expires_in : 3600;
  if (!accessToken) {
    throw new Error('Google OAuth response did not include an access token.');
  }
  cachedToken = { accessToken, expiresAtMs: Date.now() + expiresIn * 1000 };
  return accessToken;
}

function interactionId(value: string): string {
  return value.replace(/^\/+/, '').replace(/^interactions\//, '');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function httpErrorMessage(action: string, status: number, payload: unknown): string {
  const record = asRecord(payload);
  const nestedError = asRecord(record?.error);
  const providerMessage = nestedError?.message ?? record?.message;
  const suffix = typeof providerMessage === 'string' && providerMessage.trim() ? `: ${providerMessage.trim()}` : '.';
  return `Google Vertex Omni ${action} failed (${status})${suffix}`;
}

function throwHttpError(action: string, response: Response, payload: unknown): never {
  throw new GoogleVertexOmniError(httpErrorMessage(action, response.status, payload), {
    status: response.status,
    raw: payload,
  });
}

async function requestJson(params: {
  fetchFn: typeof fetch;
  url: string;
  method: 'GET' | 'POST';
  token: string;
  action: string;
  body?: unknown;
  timeoutMs: number;
}): Promise<unknown> {
  const timeout = timeoutSignal(params.timeoutMs);
  try {
    const response = await params.fetchFn(params.url, {
      method: params.method,
      headers: {
        authorization: `Bearer ${params.token}`,
        'content-type': 'application/json',
      },
      body: params.body === undefined ? undefined : JSON.stringify(params.body),
      signal: timeout.signal,
    });
    const json = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      throwHttpError(params.action, response, json);
    }
    return json;
  } catch (error) {
    if (error instanceof GoogleVertexOmniError) throw error;
    const isAbort = error instanceof Error && error.name === 'AbortError';
    throw new GoogleVertexOmniError(
      isAbort ? `Google Vertex Omni ${params.action} timed out.` : `Google Vertex Omni ${params.action} network error.`,
      {
        code: isAbort ? 'GOOGLE_VERTEX_OMNI_TIMEOUT' : 'GOOGLE_VERTEX_OMNI_NETWORK_ERROR',
        errorClass: isAbort ? 'timeout' : 'provider_unavailable',
        raw: error,
        cause: error,
      }
    );
  } finally {
    timeout.clear();
  }
}

async function requestBuffer(params: {
  fetchFn: typeof fetch;
  url: string;
  token: string;
  action: string;
  timeoutMs: number;
}): Promise<{ data: Buffer; mime: string }> {
  const timeout = timeoutSignal(params.timeoutMs);
  try {
    const response = await params.fetchFn(params.url, {
      headers: { authorization: `Bearer ${params.token}` },
      signal: timeout.signal,
    });
    if (!response.ok) {
      throw new GoogleVertexOmniError(`Google Vertex Omni ${params.action} failed (${response.status}).`, {
        status: response.status,
        errorClass: response.status >= 500 ? 'provider_unavailable' : 'provider_error',
      });
    }
    return {
      data: Buffer.from(await response.arrayBuffer()),
      mime: response.headers.get('content-type') || 'video/mp4',
    };
  } catch (error) {
    if (error instanceof GoogleVertexOmniError) throw error;
    const isAbort = error instanceof Error && error.name === 'AbortError';
    throw new GoogleVertexOmniError(
      isAbort ? `Google Vertex Omni ${params.action} timed out.` : `Google Vertex Omni ${params.action} network error.`,
      {
        code: isAbort ? 'GOOGLE_VERTEX_OMNI_TIMEOUT' : 'GOOGLE_VERTEX_OMNI_NETWORK_ERROR',
        errorClass: isAbort ? 'timeout' : 'provider_unavailable',
        raw: error,
        cause: error,
      }
    );
  } finally {
    timeout.clear();
  }
}

export class GoogleVertexOmniClient {
  private config: GoogleVertexOmniClientConfig;
  private submitTimeoutMs: number;
  private pollTimeoutMs: number;
  private downloadTimeoutMs: number;

  constructor(config: GoogleVertexOmniClientConfig = getConfig()) {
    this.config = config;
    this.submitTimeoutMs = config.submitTimeoutMs ?? DEFAULT_SUBMIT_TIMEOUT_MS;
    this.pollTimeoutMs = config.pollTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
    this.downloadTimeoutMs = config.downloadTimeoutMs ?? DEFAULT_DOWNLOAD_TIMEOUT_MS;
  }

  private fetchFn(): typeof fetch {
    return this.config.fetchFn ?? fetch;
  }

  private async token(): Promise<string> {
    return (this.config.getAccessTokenFn ?? getAccessToken)(this.config.serviceAccount);
  }

  private baseUrl(): string {
    return `${this.config.apiBaseUrl.replace(/\/+$/, '')}/v1beta1/projects/${encodeURIComponent(
      this.config.projectId
    )}/locations/${encodeURIComponent(this.config.location)}`;
  }

  private interactionsUrl(): string {
    return `${this.baseUrl()}/interactions`;
  }

  async createInteraction(request: GoogleVertexOmniInteractionRequest): Promise<GoogleVertexOmniInteraction> {
    const json = await requestJson({
      fetchFn: this.fetchFn(),
      url: this.interactionsUrl(),
      method: 'POST',
      token: await this.token(),
      body: request,
      action: 'interaction request',
      timeoutMs: this.submitTimeoutMs,
    });
    return json as GoogleVertexOmniInteraction;
  }

  async fetchInteraction(nameOrId: string): Promise<GoogleVertexOmniInteraction> {
    const json = await requestJson({
      fetchFn: this.fetchFn(),
      url: `${this.interactionsUrl()}/${encodeURIComponent(interactionId(nameOrId))}`,
      method: 'GET',
      token: await this.token(),
      action: 'interaction fetch',
      timeoutMs: this.pollTimeoutMs,
    });
    return json as GoogleVertexOmniInteraction;
  }

  async downloadOutputUri(uri: string): Promise<{ data: Buffer; mime: string }> {
    if (uri.startsWith('gs://')) {
      const match = uri.match(/^gs:\/\/([^/]+)\/(.+)$/);
      if (!match) throw new Error('Google Vertex Omni output is not a valid GCS URI.');
      const [, bucket, objectName] = match;
      const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(
        objectName
      )}?alt=media`;
      return requestBuffer({
        fetchFn: this.fetchFn(),
        url,
        token: await this.token(),
        action: 'GCS output download',
        timeoutMs: this.downloadTimeoutMs,
      });
    }

    return requestBuffer({
      fetchFn: this.fetchFn(),
      url: uri,
      token: await this.token(),
      action: 'output download',
      timeoutMs: this.downloadTimeoutMs,
    });
  }
}

export function getGoogleVertexOmniClient(): GoogleVertexOmniClient {
  return new GoogleVertexOmniClient();
}
