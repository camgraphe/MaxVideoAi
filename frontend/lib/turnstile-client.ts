export type TurnstileClientStatus = 'accepted' | 'reload' | 'unavailable';

/** This same-origin POST can expire an HttpOnly pin before a document navigation. */
export async function clearTurnstileDeploymentPin(signal: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch('/api/turnstile/reload', { method: 'POST', cache: 'no-store', credentials: 'same-origin', signal });
    return response.status === 204;
  } catch { return false; }
}

/** Public configuration is advisory; the server guard remains authoritative. */
export async function readTurnstileClientStatus(siteKey: string, signal: AbortSignal): Promise<TurnstileClientStatus> {
  try {
    // This public read must reach the current release, without a stale __vdpl cookie.
    const response = await fetch('/api/turnstile/config', { cache: 'no-store', credentials: 'omit', signal });
    if (!response.ok) return 'unavailable';
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object') return 'unavailable';
    const { activeSiteKey, acceptedSiteKeys } = body as Record<string, unknown>;
    if (typeof activeSiteKey !== 'string' || !Array.isArray(acceptedSiteKeys) ||
        acceptedSiteKeys.length < 1 || acceptedSiteKeys.length > 2 ||
        !acceptedSiteKeys.every(key => typeof key === 'string' && key.length > 0 && key.length <= 256) ||
        !acceptedSiteKeys.includes(activeSiteKey)) return 'unavailable';
    return acceptedSiteKeys.includes(siteKey) ? 'accepted' : 'reload';
  } catch {
    return 'unavailable';
  }
}
