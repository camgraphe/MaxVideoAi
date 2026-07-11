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
  let index = Math.max(0, Math.min(events.length, startIndex));
  while (index < events.length) {
    const prepared = events[index];
    try {
      gtag('event', prepared.event, prepared.payload);
    } catch {
      return index;
    }
    index += 1;
  }
  return index;
}
