import { createSign } from 'node:crypto';
import { SEARCH_CONSOLE_SCOPE, TOKEN_ENDPOINT } from './constants';
import type { GscAccessToken, GscClientConfig } from './types';

let tokenCache: GscAccessToken | null = null;
let tokenRequest: { cacheKey: string; promise: Promise<GscAccessToken> } | null = null;

export async function getAccessToken(config: GscClientConfig): Promise<string> {
  const cacheKey = buildTokenCacheKey(config);
  if (tokenCache && tokenCache.cacheKey === cacheKey && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }
  if (tokenRequest?.cacheKey === cacheKey) {
    return (await tokenRequest.promise).token;
  }

  const promise = (async () => {
    const payload =
      config.authType === 'service-account'
        ? await requestServiceAccountAccessToken(config)
        : await requestOAuthRefreshAccessToken(config);

    if (!payload.access_token) {
      throw new Error('Google OAuth token response did not include an access token.');
    }

    return {
      token: payload.access_token,
      expiresAt: Date.now() + Math.max(60, payload.expires_in ?? 3600) * 1000,
      cacheKey,
    };
  })();

  tokenRequest = { cacheKey, promise };
  try {
    tokenCache = await promise;
    return tokenCache.token;
  } finally {
    if (tokenRequest?.promise === promise) {
      tokenRequest = null;
    }
  }
}

async function requestServiceAccountAccessToken(
  config: Extract<GscClientConfig, { authType: 'service-account' }>
): Promise<{ access_token?: string; expires_in?: number }> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claimSet = base64Url(
    JSON.stringify({
      iss: config.clientEmail,
      scope: SEARCH_CONSOLE_SCOPE,
      aud: TOKEN_ENDPOINT,
      exp: now + 3600,
      iat: now,
    })
  );
  const unsignedJwt = `${header}.${claimSet}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsignedJwt);
  signer.end();
  const signature = signer.sign(config.privateKey);
  const assertion = `${unsignedJwt}.${base64Url(signature)}`;

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Google OAuth token request failed (${response.status}): ${detail || response.statusText}`);
  }

  return (await response.json()) as { access_token?: string; expires_in?: number };
}

async function requestOAuthRefreshAccessToken(
  config: Extract<GscClientConfig, { authType: 'oauth-refresh-token' }>
): Promise<{ access_token?: string; expires_in?: number }> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Google OAuth refresh token request failed (${response.status}): ${detail || response.statusText}`);
  }

  return (await response.json()) as { access_token?: string; expires_in?: number };
}

function buildTokenCacheKey(config: GscClientConfig): string {
  if (config.authType === 'service-account') {
    return `${config.siteUrl}:service-account:${config.clientEmail}`;
  }
  return `${config.siteUrl}:oauth-refresh-token:${config.clientId}`;
}

function base64Url(input: string | Buffer): string {
  const buffer = typeof input === 'string' ? Buffer.from(input) : input;
  return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
