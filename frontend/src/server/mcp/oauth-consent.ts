const AUTHORIZATION_ID_PATTERN = /^[A-Za-z0-9._~-]{8,512}$/;

function isLoopback(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
}

export function isValidAuthorizationId(value: unknown): value is string {
  return typeof value === 'string' && AUTHORIZATION_ID_PATTERN.test(value);
}

export function buildConsentLoginPath(authorizationId: string): string {
  if (!isValidAuthorizationId(authorizationId)) {
    throw new Error('Invalid OAuth authorization id.');
  }
  const nextPath = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
  return `/login?next=${encodeURIComponent(nextPath)}`;
}

function singleForwardedValue(value: string | null): string | null {
  if (!value || value.includes(',')) return null;
  const normalized = value.trim();
  return normalized || null;
}

export function isSameOriginConsentRequest(request: Pick<Request, 'headers' | 'url'>): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const parsedOrigin = new URL(origin);
    const requestUrl = new URL(request.url);
    if (
      (parsedOrigin.protocol !== 'http:' && parsedOrigin.protocol !== 'https:')
      || parsedOrigin.username
      || parsedOrigin.password
      || parsedOrigin.pathname !== '/'
      || parsedOrigin.search
      || parsedOrigin.hash
      || origin !== parsedOrigin.origin
      || requestUrl.username
      || requestUrl.password
    ) return false;
    if (parsedOrigin.origin === requestUrl.origin) return true;

    const forwardedHostHeader = request.headers.get('x-forwarded-host');
    const forwardedHost = singleForwardedValue(forwardedHostHeader);
    if (forwardedHostHeader && !forwardedHost) return false;
    const externalHost = forwardedHost ?? singleForwardedValue(request.headers.get('host'));
    if (!externalHost || /[@/\\\s]/u.test(externalHost)) return false;

    const forwardedProtocolHeader = request.headers.get('x-forwarded-proto');
    const forwardedProtocol = singleForwardedValue(forwardedProtocolHeader);
    if (forwardedProtocolHeader && forwardedProtocol !== 'http' && forwardedProtocol !== 'https') {
      return false;
    }
    const protocol = forwardedProtocol ? `${forwardedProtocol}:` : requestUrl.protocol;
    const externalUrl = new URL(`${protocol}//${externalHost}`);
    if (
      externalUrl.username
      || externalUrl.password
      || externalUrl.pathname !== '/'
      || externalUrl.search
      || externalUrl.hash
    ) return false;
    return parsedOrigin.origin === externalUrl.origin;
  } catch {
    return false;
  }
}

export function resolveOAuthRedirectUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Invalid OAuth redirect URL.');
  }

  const allowed = parsed.protocol === 'https:' || (parsed.protocol === 'http:' && isLoopback(parsed.hostname));
  if (!allowed || parsed.username || parsed.password) {
    throw new Error('Invalid OAuth redirect URL.');
  }
  return parsed.toString();
}
