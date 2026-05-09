import type { GscClientConfig } from './types';

export function resolveGscConfig(): GscClientConfig | null {
  const siteUrl = process.env.GSC_SITE_URL?.trim() || process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL?.trim() || '';
  if (!siteUrl) return null;

  const serviceAccountJson = process.env.GSC_SERVICE_ACCOUNT_JSON?.trim() || process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (serviceAccountJson) {
    try {
      const parsed = JSON.parse(serviceAccountJson) as { client_email?: string; private_key?: string };
      const clientEmail = parsed.client_email?.trim() ?? '';
      const privateKey = normalizePrivateKey(parsed.private_key ?? '');
      if (clientEmail && privateKey) {
        return { siteUrl, authType: 'service-account', clientEmail, privateKey };
      }
    } catch {
      return null;
    }
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() || process.env.GSC_CLIENT_EMAIL?.trim() || '';
  const privateKey = normalizePrivateKey(
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? process.env.GSC_PRIVATE_KEY ?? ''
  );
  if (clientEmail && privateKey) {
    return { siteUrl, authType: 'service-account', clientEmail, privateKey };
  }

  const oauthClientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ?? '';
  const oauthClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ?? '';
  const oauthRefreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim() ?? '';
  if (oauthClientId && oauthClientSecret && oauthRefreshToken) {
    return {
      siteUrl,
      authType: 'oauth-refresh-token',
      clientId: oauthClientId,
      clientSecret: oauthClientSecret,
      refreshToken: oauthRefreshToken,
    };
  }

  return null;
}

export function normalizePrivateKey(value: string): string {
  return value.trim().replace(/\\n/g, '\n');
}
