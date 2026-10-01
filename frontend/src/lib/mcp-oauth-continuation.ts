const AUTHORIZATION_ID_PATTERN = /^[A-Za-z0-9._~-]{8,512}$/;

export function isValidAuthorizationId(value: unknown): value is string {
  return typeof value === 'string' && AUTHORIZATION_ID_PATTERN.test(value);
}

/** Recognizes the local consent return; it does not validate or approve an OAuth request. */
export function isMcpConsentTarget(value: unknown): value is string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return false;
  try {
    const target = new URL(value, 'https://maxvideoai.local');
    const ids = target.searchParams.getAll('authorization_id');
    return target.origin === 'https://maxvideoai.local'
      && target.pathname === '/oauth/consent'
      && ids.length === 1
      && isValidAuthorizationId(ids[0]);
  } catch {
    return false;
  }
}
