import type { BeforeSendEvent } from '@vercel/analytics';
import { hasAnalyticsConsentInBrowser } from './consent-client';
import { getAnalyticsRouteContext } from '../analytics-route';
import { isBrowserCommercialAnalyticsExcluded } from './commercial-client';
import { buildAnalyticsPageContext } from './page-context';
import { getPublicVideoAnalyticsPath, getVideoAnalyticsMarker } from './public-video';

export function sanitizeVercelAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent | null {
  if (isBrowserCommercialAnalyticsExcluded() || (event.type === 'event' && !hasAnalyticsConsentInBrowser())) return null;
  const context = buildAnalyticsPageContext(event.url);
  if (!context || getAnalyticsRouteContext(new URL(event.url).pathname).excludedFromGa4) return null;
  const url = new URL(context.page_location);
  const publicVideoPath = getPublicVideoAnalyticsPath(new URL(event.url));
  // The delivery script exposes custom payloads even though SDK 1.5's type
  // predates that field. A queued play may flush after the reader has changed.
  const payload = (event as BeforeSendEvent & { payload?: { name?: string; data?: { video_slug?: string } } }).payload;
  if (event.type === 'event' && payload?.name === 'public_video_play'
    && (!publicVideoPath || payload.data?.video_slug !== publicVideoPath.slice('/video/'.length))) return null;
  if (publicVideoPath) url.pathname = publicVideoPath;
  // Keep approved acquisition values; free query strings and private IDs never pass.
  for (const [key, value] of [
    ['utm_source', context.campaign_source], ['utm_medium', context.campaign_medium],
    ['utm_campaign', context.campaign_name], ['utm_content', context.campaign_content],
  ]) {
    if (value) url.searchParams.set(key!, value);
  }
  return { ...event, url: url.href };
}

/** Defer video views until the reader resolves; one view per opening, including
 * automatic SDK views, explicit detail-ready views, and React effect replays. */
export function createVercelAnalyticsBeforeSend() {
  const viewedReaders = new WeakSet<HTMLElement>();
  return (event: BeforeSendEvent): BeforeSendEvent | null => {
    const sanitized = sanitizeVercelAnalyticsEvent(event);
    if (!sanitized) return null;
    if (event.type === 'pageview' && new URL(event.url).pathname.startsWith('/video/')) {
      const marker = getVideoAnalyticsMarker(new URL(event.url));
      if (!marker || viewedReaders.has(marker)) return null;
      viewedReaders.add(marker);
    }
    return sanitized;
  };
}
