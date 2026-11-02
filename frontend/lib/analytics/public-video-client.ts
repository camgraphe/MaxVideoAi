import { track } from '@vercel/analytics';
import { hasAnalyticsConsentInBrowser } from './consent-client';
import { isBrowserCommercialAnalyticsExcluded } from './commercial-client';
import { getPublicVideoAnalyticsPath, isPublicVideoAnalyticsPath } from './public-video';

/** Return whether delivery was attempted, so denied consent does not consume a play. */
export function trackPublicVideoPlay(path: string | null | undefined, surface: 'watch' | 'gallery'): boolean {
  if (typeof window === 'undefined' || !window.va || !hasAnalyticsConsentInBrowser()
    || isBrowserCommercialAnalyticsExcluded() || !isPublicVideoAnalyticsPath(path)) return false;
  if (getPublicVideoAnalyticsPath(new URL(window.location.href)) !== path) return false;
  try {
    track('public_video_play', { video_slug: path.slice('/video/'.length), surface });
    return true;
  } catch { return false; }
}
