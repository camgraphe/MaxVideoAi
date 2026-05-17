import { createSign } from 'node:crypto';
import { GoogleVertexVeoError } from './errors';
import type { GoogleVertexVeoPredictRequest } from './payload';

type GoogleServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
  project_id?: string;
};

export type GoogleVertexVeoClientConfig = {
  projectId: string;
  location: string;
  serviceAccount: GoogleServiceAccount;
  apiBaseUrl: string;
};

export type GoogleVertexVeoOperation = {
  name?: string;
  done?: boolean;
  error?: unknown;
  response?: unknown;
  metadata?: unknown;
};

let cachedToken: { accessToken: string; expiresAtMs: number } | null = null;

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function parseServiceAccount(raw: string | undefined): GoogleServiceAccount {
  const value = (raw ?? '').trim();
  if (!value) {
    throw new GoogleVertexVeoError('GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON is missing.', {
      code: 'GOOGLE_VERTEX_SERVICE_ACCOUNT_MISSING',
      errorClass: 'auth_error',
    });
  }

  const json = value.startsWith('{') ? value : Buffer.from(value, 'base64').toString('utf8');
  const parsed = JSON.parse(json) as Partial<GoogleServiceAccount>;
  if (!parsed.client_email || !parsed.private_key) {
    throw new GoogleVertexVeoError('Google service account JSON is missing client_email or private_key.', {
      code: 'GOOGLE_VERTEX_SERVICE_ACCOUNT_INVALID',
      errorClass: 'auth_error',
    });
  }
  return {
    client_email: parsed.client_email,
    private_key: parsed.private_key.replace(/\\n/g, '\n'),
    token_uri: parsed.token_uri,
    project_id: parsed.project_id,
  };
}

function getConfig(): GoogleVertexVeoClientConfig {
  const projectId = (process.env.GOOGLE_VERTEX_PROJECT_ID ?? '').trim();
  const location = (process.env.GOOGLE_VERTEX_LOCATION ?? 'us-central1').trim();
  if (!projectId) {
    throw new GoogleVertexVeoError('GOOGLE_VERTEX_PROJECT_ID is missing.', {
      code: 'GOOGLE_VERTEX_PROJECT_ID_MISSING',
      errorClass: 'auth_error',
    });
  }
  return {
    projectId,
    location,
    serviceAccount: parseServiceAccount(process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON),
    apiBaseUrl:
      (process.env.GOOGLE_VERTEX_API_BASE_URL ?? '').trim() ||
      `https://${location}-aiplatform.googleapis.com`,
  };
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
  const assertion = buildJwt(serviceAccount);
  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    throw new GoogleVertexVeoError('Google OAuth token request failed.', {
      status: response.status,
      code: typeof json?.error === 'string' ? json.error : 'GOOGLE_VERTEX_TOKEN_FAILED',
      errorClass: 'auth_error',
      raw: json,
    });
  }
  const accessToken = typeof json?.access_token === 'string' ? json.access_token : null;
  const expiresIn = typeof json?.expires_in === 'number' ? json.expires_in : 3600;
  if (!accessToken) {
    throw new GoogleVertexVeoError('Google OAuth response did not include an access token.', {
      code: 'GOOGLE_VERTEX_TOKEN_INVALID',
      errorClass: 'auth_error',
      raw: json,
    });
  }
  cachedToken = { accessToken, expiresAtMs: Date.now() + expiresIn * 1000 };
  return accessToken;
}

async function requestJson(params: {
  url: string;
  method: 'GET' | 'POST';
  token: string;
  body?: unknown;
  timeoutMs?: number;
}): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs ?? 60_000);
  try {
    const response = await fetch(params.url, {
      method: params.method,
      headers: {
        authorization: `Bearer ${params.token}`,
        'content-type': 'application/json',
      },
      body: params.body === undefined ? undefined : JSON.stringify(params.body),
      signal: controller.signal,
    });
    const json = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      throw new GoogleVertexVeoError('Google Vertex Veo request failed.', {
        status: response.status,
        raw: json,
      });
    }
    return json;
  } catch (error) {
    if (error instanceof GoogleVertexVeoError) throw error;
    const isAbort = error instanceof Error && error.name === 'AbortError';
    throw new GoogleVertexVeoError(isAbort ? 'Google Vertex Veo request timed out.' : 'Google Vertex Veo network error.', {
      code: isAbort ? 'GOOGLE_VERTEX_VEO_TIMEOUT' : 'GOOGLE_VERTEX_VEO_NETWORK_ERROR',
      errorClass: isAbort ? 'timeout' : 'provider_unavailable',
      raw: error,
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export class GoogleVertexVeoClient {
  private config: GoogleVertexVeoClientConfig;

  constructor(config: GoogleVertexVeoClientConfig = getConfig()) {
    this.config = config;
  }

  private async token(): Promise<string> {
    return getAccessToken(this.config.serviceAccount);
  }

  private modelUrl(providerModel: string, method: 'predictLongRunning' | 'fetchPredictOperation'): string {
    const base = this.config.apiBaseUrl.replace(/\/+$/, '');
    return `${base}/v1/projects/${encodeURIComponent(this.config.projectId)}/locations/${encodeURIComponent(
      this.config.location
    )}/publishers/google/models/${encodeURIComponent(providerModel)}:${method}`;
  }

  async createTask(request: GoogleVertexVeoPredictRequest): Promise<GoogleVertexVeoOperation> {
    const raw = await requestJson({
      url: this.modelUrl(request.providerModel, 'predictLongRunning'),
      method: 'POST',
      token: await this.token(),
      body: request.body,
      timeoutMs: 90_000,
    });
    return raw as GoogleVertexVeoOperation;
  }

  async fetchOperation(params: { providerModel: string; operationName: string }): Promise<GoogleVertexVeoOperation> {
    const raw = await requestJson({
      url: this.modelUrl(params.providerModel, 'fetchPredictOperation'),
      method: 'POST',
      token: await this.token(),
      body: { operationName: params.operationName },
      timeoutMs: 45_000,
    });
    return raw as GoogleVertexVeoOperation;
  }

  async downloadGcsUri(gcsUri: string): Promise<{ data: Buffer; mime: string }> {
    const match = gcsUri.match(/^gs:\/\/([^/]+)\/(.+)$/);
    if (!match) {
      throw new GoogleVertexVeoError('Google output is not a valid GCS URI.', {
        code: 'GOOGLE_VERTEX_VEO_INVALID_GCS_URI',
        errorClass: 'invalid_response',
        raw: { gcsUri },
      });
    }
    const [, bucket, objectName] = match;
    const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(
      objectName
    )}?alt=media`;
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${await this.token()}` },
    });
    if (!response.ok) {
      throw new GoogleVertexVeoError('Google GCS output download failed.', {
        status: response.status,
        errorClass: response.status >= 500 ? 'provider_unavailable' : 'provider_error',
        raw: { gcsUri },
      });
    }
    return {
      data: Buffer.from(await response.arrayBuffer()),
      mime: response.headers.get('content-type') || 'video/mp4',
    };
  }

  async uploadGcsObject(params: { gcsUri: string; data: Buffer; mime: string }): Promise<string> {
    const match = params.gcsUri.match(/^gs:\/\/([^/]+)\/(.+)$/);
    if (!match) {
      throw new GoogleVertexVeoError('Google input staging URI is not a valid GCS URI.', {
        code: 'GOOGLE_VERTEX_VEO_INVALID_GCS_URI',
        errorClass: 'invalid_request',
        raw: { gcsUri: params.gcsUri },
      });
    }
    const [, bucket, objectName] = match;
    const url = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(
      bucket
    )}/o?uploadType=media&name=${encodeURIComponent(objectName)}`;
    const uploadBody = new Uint8Array(params.data).buffer;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${await this.token()}`,
        'content-type': params.mime,
      },
      body: uploadBody,
    });
    const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok) {
      throw new GoogleVertexVeoError('Google GCS input upload failed.', {
        status: response.status,
        code: 'GOOGLE_VERTEX_VEO_INPUT_GCS_UPLOAD_FAILED',
        errorClass: response.status >= 500 ? 'provider_unavailable' : 'invalid_request',
        raw: json,
      });
    }
    return params.gcsUri;
  }
}

export function getGoogleVertexVeoClient(): GoogleVertexVeoClient {
  return new GoogleVertexVeoClient();
}
