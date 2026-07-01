import { createSign } from 'node:crypto';

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
  response_format?: Record<string, unknown>;
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
};

type GoogleVertexOmniEnv = Partial<Record<
  | 'GOOGLE_VERTEX_OMNI_PROJECT_ID'
  | 'GOOGLE_VERTEX_OMNI_LOCATION'
  | 'GOOGLE_VERTEX_OMNI_API_BASE_URL'
  | 'GOOGLE_VERTEX_OMNI_SERVICE_ACCOUNT_JSON'
  | 'GOOGLE_VERTEX_PROJECT_ID'
  | 'GOOGLE_VERTEX_LOCATION'
  | 'GOOGLE_VERTEX_API_BASE_URL'
  | 'GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON',
  string | undefined
>>;

let cachedToken: { accessToken: string; expiresAtMs: number } | null = null;

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

function getConfig(env: GoogleVertexOmniEnv = process.env): GoogleVertexOmniClientConfig {
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
  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: buildJwt(serviceAccount),
    }),
  });
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

export class GoogleVertexOmniClient {
  private config: GoogleVertexOmniClientConfig;

  constructor(config: GoogleVertexOmniClientConfig = getConfig()) {
    this.config = config;
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
    const response = await this.fetchFn()(this.interactionsUrl(), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${await this.token()}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    const json = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      throw new Error(`Google Vertex Omni interaction request failed (${response.status}).`);
    }
    return json as GoogleVertexOmniInteraction;
  }

  async fetchInteraction(nameOrId: string): Promise<GoogleVertexOmniInteraction> {
    const response = await this.fetchFn()(`${this.interactionsUrl()}/${encodeURIComponent(interactionId(nameOrId))}`, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${await this.token()}`,
        'content-type': 'application/json',
      },
    });
    const json = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      throw new Error(`Google Vertex Omni interaction fetch failed (${response.status}).`);
    }
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
      const response = await this.fetchFn()(url, {
        headers: { authorization: `Bearer ${await this.token()}` },
      });
      if (!response.ok) {
        throw new Error(`Google Vertex Omni GCS output download failed (${response.status}).`);
      }
      return {
        data: Buffer.from(await response.arrayBuffer()),
        mime: response.headers.get('content-type') || 'video/mp4',
      };
    }

    const response = await this.fetchFn()(uri, {
      headers: { authorization: `Bearer ${await this.token()}` },
    });
    if (!response.ok) {
      throw new Error(`Google Vertex Omni output download failed (${response.status}).`);
    }
    return {
      data: Buffer.from(await response.arrayBuffer()),
      mime: response.headers.get('content-type') || 'video/mp4',
    };
  }
}

export function getGoogleVertexOmniClient(): GoogleVertexOmniClient {
  return new GoogleVertexOmniClient();
}
