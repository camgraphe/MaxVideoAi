import { CONSENT_COOKIE_NAME, parseConsent } from '@/lib/consent';
import { getAnalyticsRouteContext } from '@/lib/analytics-route';
import { isBrowserCommercialAnalyticsConfirmedAdmin, isBrowserCommercialAnalyticsExcluded } from './commercial-client';
import {
  OPENAI_ATTRIBUTION_COOKIE,
  OPENAI_CLICK_TTL_MS,
  parseOpenAIAttribution,
  validOpenAIClickId,
  type OpenAIAttribution,
} from './openai-contract';

function cookie(name: string): string | null {
  try {
    const value = document.cookie
      .split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith(`${name}=`));
    return value ? decodeURIComponent(value.slice(name.length + 1)) : null;
  } catch {
    return null;
  }
}
export function clearOpenAIAttribution(): void {
  document.cookie = `${OPENAI_ATTRIBUTION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; Secure`;
}
/** First-party click measurement only. No third-party SDK or automatic field matching. */
export function syncOpenAIAttribution(policyVersion: string): OpenAIAttribution | null {
  if (!['maxvideoai.com', 'www.maxvideoai.com'].includes(window.location.hostname)) return null;
  const consent = parseConsent(cookie(CONSENT_COOKIE_NAME));
  if (
    !consent?.categories.analytics ||
    !consent.categories.ads ||
    consent.version !== policyVersion ||
    isBrowserCommercialAnalyticsConfirmedAdmin()
  ) {
    clearOpenAIAttribution();
    return null;
  }
  // Pending email confirmation or an unavailable role lookup is not admin evidence.
  // Keep an already-consented click for recovery, but do not capture or emit now.
  if (isBrowserCommercialAnalyticsExcluded()) return null;
  if (getAnalyticsRouteContext(window.location.pathname).excludedFromGa4) return null;
  const now = Date.now();
  const context = { ...consent.categories, version: policyVersion, timestamp: consent.timestamp };
  const stored = parseOpenAIAttribution(cookie(OPENAI_ATTRIBUTION_COOKIE), context, now);
  const oppref = new URL(window.location.href).searchParams.get('oppref');
  if (validOpenAIClickId(oppref) && stored?.oppref !== oppref) {
    const next = { oppref, capturedAt: now, consentAt: consent.timestamp, policyVersion };
    if (!parseOpenAIAttribution(JSON.stringify(next), context, now)) return null;
    document.cookie = `${OPENAI_ATTRIBUTION_COOKIE}=${encodeURIComponent(JSON.stringify(next))}; Path=/; Max-Age=${OPENAI_CLICK_TTL_MS / 1000}; SameSite=Lax; Secure`;
    return next;
  }
  if (!stored) clearOpenAIAttribution();
  return stored;
}
