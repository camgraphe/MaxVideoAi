export type PreparedAnalyticsTransportEvent = {
  event: string;
  payload: Record<string, unknown>;
};

export type BrowserGtag = (...args: unknown[]) => void;

export function sendPreparedAnalyticsEvents(
  gtag: BrowserGtag,
  events: PreparedAnalyticsTransportEvent[],
  startIndex = 0,
): number {
  if (isBrowserCommercialAnalyticsExcluded()) return events.length;
  let index = Math.max(0, Math.min(events.length, startIndex));
  while (index < events.length) {
    const prepared = events[index];
    try {
      gtag('event', prepared.event, boundGa4EventParams(prepared.payload));
    } catch {
      return index;
    }
    try { recordClarityAnalyticsEvent(prepared.event); } catch { /* Clarity never blocks the canonical transport. */ }
    index += 1;
  }
  return index;
}
import { isBrowserCommercialAnalyticsExcluded } from './commercial-client';
import { recordClarityAnalyticsEvent } from '@/lib/clarity-client';
import { boundGa4EventParams } from './ga4-params';
