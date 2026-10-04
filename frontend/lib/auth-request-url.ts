type AuthUrlRequest = {
  url: string;
  headers: Pick<Headers, 'get'>;
};

const LOOPBACK_AUTHORITY = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i;

export function getAuthRequestUrl(request: AuthUrlRequest): URL {
  const url = new URL(request.url);
  // NextRequest normalizes loopback IPs to localhost. PKCE cookies belong to
  // the browser's exact origin, so restore only a matching loopback authority.
  // Public origins and forwarded headers must never select a new destination.
  if (url.hostname !== 'localhost') return url;
  const host = request.headers.get('host');
  if (!host || !LOOPBACK_AUTHORITY.test(host)) return url;
  try {
    const localUrl = new URL(`${url.protocol}//${host}`);
    if (localUrl.port === url.port) url.host = localUrl.host;
  } catch {
    // An invalid authority retains the framework's original URL.
  }
  return url;
}
