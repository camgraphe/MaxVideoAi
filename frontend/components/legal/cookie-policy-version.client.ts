export const FALLBACK_COOKIE_POLICY_VERSION = '2025-10-26';

let pendingVersion: Promise<string> | null = null;

/** Share the pending public-policy read between the banner and script gates. */
export function loadCookiePolicyVersion(): Promise<string> {
  if (pendingVersion) return pendingVersion;
  const request = Promise.resolve().then(async () => {
    const response = await fetch('/api/legal/cookies/version', { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok || !body?.ok || typeof body.version !== 'string') throw new Error('Unavailable cookie policy');
    return body.version as string;
  }).catch(() => {
    console.warn('[cookie-consent] failed to load cookie policy version');
    return FALLBACK_COOKIE_POLICY_VERSION;
  });
  pendingVersion = request;
  void request.then(() => { if (pendingVersion === request) pendingVersion = null; });
  return request;
}
