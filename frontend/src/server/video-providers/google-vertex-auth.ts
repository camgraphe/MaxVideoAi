import { createSign } from 'node:crypto';

export type GoogleVertexServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
  project_id?: string;
};

type TokenCacheEntry = { accessToken: string; expiresAtMs: number };

const tokenCache = new Map<string, TokenCacheEntry>();

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

export function parseGoogleVertexServiceAccount(raw: string | undefined): GoogleVertexServiceAccount {
  const value = (raw ?? '').trim();
  if (!value) throw new Error('GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON is missing.');

  const json = value.startsWith('{') ? value : Buffer.from(value, 'base64').toString('utf8');
  const parsed = JSON.parse(json) as Partial<GoogleVertexServiceAccount>;
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

function buildJwt(serviceAccount: GoogleVertexServiceAccount): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const tokenUri = serviceAccount.token_uri || 'https://oauth2.googleapis.com/token';
  const signingInput = `${base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64Url(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: tokenUri,
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    })
  )}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  return `${signingInput}.${base64Url(signer.sign(serviceAccount.private_key))}`;
}

export async function getGoogleVertexAccessToken(params: {
  serviceAccount: GoogleVertexServiceAccount;
  fetchFn?: typeof fetch;
}): Promise<string> {
  const cached = tokenCache.get(params.serviceAccount.client_email);
  if (cached && cached.expiresAtMs - Date.now() > 60_000) return cached.accessToken;

  const tokenUri = params.serviceAccount.token_uri || 'https://oauth2.googleapis.com/token';
  const response = await (params.fetchFn ?? fetch)(tokenUri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: buildJwt(params.serviceAccount),
    }),
  });
  const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const accessToken = typeof json?.access_token === 'string' ? json.access_token : null;
  if (!response.ok || !accessToken) {
    throw new Error(`Google OAuth token request failed (${response.status}).`);
  }
  const expiresIn = typeof json?.expires_in === 'number' ? json.expires_in : 3600;
  tokenCache.set(params.serviceAccount.client_email, {
    accessToken,
    expiresAtMs: Date.now() + expiresIn * 1000,
  });
  return accessToken;
}
