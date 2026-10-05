import { hasAdsConsentInBrowser, hasAnalyticsConsentInBrowser } from './consent-client';

const ADMIN_EXCLUSION_KEY = 'mvai.analytics-excluded-admin.v1';
const GA_ID = (() => {
  try {
    // Keep literal public env lookups for Next's compile-time substitution;
    // standalone browser bundles need no Node process shim.
    return process.env.NEXT_PUBLIC_GA_ID ?? process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID ?? process.env.NEXT_PUBLIC_GA4_ID ?? '';
  } catch { return ''; }
})();
export const COMMERCIAL_ANALYTICS_RESOLVED_EVENT = 'mvai:commercial-analytics-resolved';
export const COMMERCIAL_ANALYTICS_CONTEXT_CHANGED_EVENT = 'mvai:commercial-analytics-context-changed';
let activeUserId: string | null = null;
let activeBrowser: Window | null = null;
let activeResolution: Promise<boolean> | null = null;
let resolvedAt = 0;

declare global {
  interface Window { __mvaiCommercialAnalyticsExcluded?: boolean; __mvaiCommercialAnalyticsPending?: boolean; }
}

function applyBrowserAnalyticsExclusion(excluded: boolean, persist: boolean): void {
  if (typeof window === 'undefined') return;
  window.__mvaiCommercialAnalyticsExcluded = excluded;
  if (persist) try {
    if (excluded) window.sessionStorage.setItem(ADMIN_EXCLUSION_KEY, '1');
    else window.sessionStorage.removeItem(ADMIN_EXCLUSION_KEY);
  } catch { /* Role suppression still works when storage is unavailable. */ }
  if (GA_ID) (window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`] = excluded;
}

/** Only call with app_metadata from an authenticated Supabase user response. */
export function setBrowserAnalyticsAuthContext(appMetadata: unknown): void {
  if (typeof window === 'undefined') return;
  const metadata = appMetadata && typeof appMetadata === 'object' ? appMetadata as Record<string, unknown> : {};
  const roles = [metadata.role, ...(Array.isArray(metadata.roles) ? metadata.roles : [])];
  const admin = roles.some((role) => typeof role === 'string' && role.trim().toLowerCase() === 'admin');
  // Non-admin metadata cannot disprove authoritative DB admin evidence.
  applyBrowserAnalyticsExclusion(admin || isBrowserCommercialAnalyticsExcluded(), admin);
}

export function clearBrowserAnalyticsAuthContext(): void {
  activeUserId = null;
  activeBrowser = null;
  activeResolution = null;
  resolvedAt = 0;
  applyBrowserAnalyticsExclusion(false, true);
  if (typeof window !== 'undefined') window.__mvaiCommercialAnalyticsPending = true;
  if (typeof window !== 'undefined') window.dispatchEvent(new window.CustomEvent(COMMERCIAL_ANALYTICS_CONTEXT_CHANGED_EVENT, { detail: { resetJourney: true } }));
}

export function isBrowserCommercialAnalyticsPending(): boolean {
  return typeof window !== 'undefined' && window.__mvaiCommercialAnalyticsPending !== false;
}

export function shouldDeferCommercialAnalyticsEvent(event: string, payload: Record<string, unknown>): boolean {
  return isBrowserCommercialAnalyticsPending() && (
    ['workspace', 'app_tools', 'billing'].includes(String(payload.route_family))
    || event === 'sign_up_completed' || event === 'login_completed'
  );
}

/** Reuses the existing authenticated role endpoint; product work never awaits it. */
export function resolveBrowserCommercialAnalyticsAuthContext(
  userId: string, accessToken?: string | null, appMetadata?: unknown,
): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  const identityChanged = activeBrowser !== window || activeUserId !== userId;
  const resetJourney = activeBrowser === window && activeUserId !== null && activeUserId !== userId;
  if (identityChanged) {
    if (resetJourney) applyBrowserAnalyticsExclusion(false, true);
    window.dispatchEvent(new window.CustomEvent(COMMERCIAL_ANALYTICS_CONTEXT_CHANGED_EVENT, { detail: { resetJourney } }));
    activeUserId = userId;
    activeBrowser = window;
    activeResolution = null;
    resolvedAt = 0;
  }
  const metadata = appMetadata && typeof appMetadata === 'object' ? appMetadata as Record<string, unknown> : {};
  if ([metadata.role, ...(Array.isArray(metadata.roles) ? metadata.roles : [])].some((role) => typeof role === 'string' && role.trim().toLowerCase() === 'admin')) {
    setBrowserAnalyticsAuthContext(appMetadata);
    window.__mvaiCommercialAnalyticsPending = false;
    activeResolution = Promise.resolve(false);
    resolvedAt = Date.now();
    window.dispatchEvent(new window.CustomEvent(COMMERCIAL_ANALYTICS_RESOLVED_EVENT));
    return activeResolution;
  }
  if (!hasAnalyticsConsentInBrowser() && !hasAdsConsentInBrowser()) {
    activeResolution = null;
    resolvedAt = 0;
    setBrowserAnalyticsAuthContext(appMetadata);
    window.__mvaiCommercialAnalyticsPending = true;
    return Promise.resolve(false);
  }
  if (activeBrowser === window && activeUserId === userId && activeResolution && (resolvedAt === 0 || Date.now() - resolvedAt < 30_000)) return activeResolution;
  activeUserId = userId;
  activeBrowser = window;
  resolvedAt = 0;
  setBrowserAnalyticsAuthContext(appMetadata);
  window.__mvaiCommercialAnalyticsPending = true;
  const browser = window;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  const resolution = Promise.resolve().then(async () => {
    let eligible = false;
    let confirmedAdmin = false;
    try {
      const response = await fetch('/api/admin/access', {
        credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        ...(accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {}),
      });
      const body = response.ok ? await response.json() : null;
      eligible = body?.ok === false && body?.commercialAnalyticsEligible === true;
      confirmedAdmin = body?.ok === true && body?.commercialAnalyticsEligible === false;
    } catch { /* Uncertain roles suppress commercial events, never product use. */ }
    finally { clearTimeout(timer); }
    if (activeResolution !== resolution || typeof window === 'undefined' || browser !== window) return false;
    // A newer metadata-admin resolution invalidates this promise above.
    // Confirmed ordinary eligibility can retire prior stored DB exclusion.
    applyBrowserAnalyticsExclusion(!eligible, eligible || confirmedAdmin);
    browser.__mvaiCommercialAnalyticsPending = false;
    resolvedAt = Date.now();
    browser.dispatchEvent(new browser.CustomEvent(COMMERCIAL_ANALYTICS_RESOLVED_EVENT));
    return eligible;
  });
  activeResolution = resolution;
  return resolution;
}

export function isBrowserCommercialAnalyticsExcluded(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.__mvaiCommercialAnalyticsExcluded === 'boolean') return window.__mvaiCommercialAnalyticsExcluded;
  try { return window.sessionStorage.getItem(ADMIN_EXCLUSION_KEY) === '1'; }
  catch { return false; }
}
