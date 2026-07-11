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

export function isSameOriginConsentRequest(request: Pick<Request, 'headers' | 'url'>): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
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
