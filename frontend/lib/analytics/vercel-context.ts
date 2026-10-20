import type { BeforeSendEvent } from '@vercel/analytics';
import { getAnalyticsRouteContext } from '../analytics-route';
import { isBrowserCommercialAnalyticsExcluded } from './commercial-client';
import { buildAnalyticsPageContext } from './page-context';

export function sanitizeVercelAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent | null {
  if (isBrowserCommercialAnalyticsExcluded()) return null;
  const context = buildAnalyticsPageContext(event.url);
  if (!context || getAnalyticsRouteContext(new URL(event.url).pathname).excludedFromGa4) return null;
  const url = new URL(context.page_location);
  // Keep approved acquisition values; free query strings and private IDs never pass.
  for (const [key, value] of [
    ['utm_source', context.campaign_source], ['utm_medium', context.campaign_medium],
    ['utm_campaign', context.campaign_name], ['utm_content', context.campaign_content],
  ]) {
    if (value) url.searchParams.set(key!, value);
  }
  return { ...event, url: url.href };
}
