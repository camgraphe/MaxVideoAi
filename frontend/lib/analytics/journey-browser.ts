import { clearPendingAnalyticsEvent } from '../analytics-client';
import { getAnalyticsRouteContext, type AnalyticsRouteContext } from '../analytics-route';
import { hasAnalyticsConsentInBrowser } from './consent-client';
import {
  ANALYTICS_JOURNEY_STORAGE_KEY,
  ANALYTICS_JOURNEY_VERSION,
  ISO_COHORT_WEEK_PATTERN,
  UUID_PATTERN,
  parseWalletAnalyticsJourney,
  sanitizeAttributionValue,
  type AnalyticsJourneyRecordV1,
  type AnalyticsTouch,
  type PreparedAnalyticsEvent,
  type WalletAnalyticsJourney,
} from './journey-contract';
import {
  applyAnalyticsTouch,
  createAnalyticsJourneyRecord,
  prepareJourneyEvents,
  resolveAnalyticsTouch,
} from './journey';

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isBoundedValue(value: unknown, options: { lowercase?: boolean } = {}): value is string {
  return typeof value === 'string' && sanitizeAttributionValue(value, options) === value;
}

function isAnalyticsTouch(value: unknown): value is AnalyticsTouch {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const touch = value as Record<string, unknown>;
  if (
    !isBoundedValue(touch.source, { lowercase: true })
    || !isBoundedValue(touch.medium, { lowercase: true })
    || !isBoundedValue(touch.landingRouteFamily, { lowercase: true })
  ) {
    return false;
  }

  for (const key of ['campaign', 'content', 'landingSurface'] as const) {
    if (touch[key] !== undefined && !isBoundedValue(touch[key])) return false;
  }
  for (const key of ['referrerHost', 'locale'] as const) {
    if (touch[key] !== undefined && !isBoundedValue(touch[key], { lowercase: true })) return false;
  }
  return true;
}

function parseAnalyticsJourney(value: unknown, now: number): AnalyticsJourneyRecordV1 | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    record.version !== ANALYTICS_JOURNEY_VERSION
    || typeof record.journeyId !== 'string'
    || !UUID_PATTERN.test(record.journeyId)
    || !isNonNegativeInteger(record.createdAt)
    || !isNonNegativeInteger(record.expiresAt)
    || record.expiresAt <= record.createdAt
    || record.expiresAt <= now
    || typeof record.cohortWeek !== 'string'
    || !ISO_COHORT_WEEK_PATTERN.test(record.cohortWeek)
    || !isAnalyticsTouch(record.firstTouch)
    || !isAnalyticsTouch(record.lastTouch)
    || !isNonNegativeInteger(record.lastTouchAt)
    || record.lastTouchAt < record.createdAt
    || record.lastTouchAt >= record.expiresAt
    || typeof record.funnelEntrySent !== 'boolean'
    || !isNonNegativeInteger(record.generationStartedCount)
    || !isNonNegativeInteger(record.topupStartedCount)
  ) {
    return null;
  }
  return record as AnalyticsJourneyRecordV1;
}

function readStoredAnalyticsJourney(now: number): AnalyticsJourneyRecordV1 | null {
  try {
    const raw = window.localStorage.getItem(ANALYTICS_JOURNEY_STORAGE_KEY);
    if (!raw) return null;
    const record = parseAnalyticsJourney(JSON.parse(raw), now);
    if (!record) window.localStorage.removeItem(ANALYTICS_JOURNEY_STORAGE_KEY);
    return record;
  } catch {
    return null;
  }
}

function persistAnalyticsJourney(record: AnalyticsJourneyRecordV1): void {
  try {
    window.localStorage.setItem(ANALYTICS_JOURNEY_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Analytics storage must never interrupt product behavior.
  }
}

function landingSurface(context: AnalyticsRouteContext): string | undefined {
  let value: string | null;
  if (context.family === 'public_tools' || context.family === 'app_tools') {
    value = context.toolName;
  } else if (context.family === 'workspace') {
    value = context.workspaceSection;
  } else if (context.family === 'marketing') {
    value = context.normalizedPath;
  } else {
    value = context.family;
  }
  return sanitizeAttributionValue(value) ?? undefined;
}

function resolveCurrentTouch(): AnalyticsTouch | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  try {
    const context = getAnalyticsRouteContext(window.location.pathname);
    const locale = sanitizeAttributionValue(document.documentElement.lang, { lowercase: true }) ?? undefined;
    const surface = landingSurface(context);
    return resolveAnalyticsTouch({
      href: window.location.href,
      referrer: document.referrer,
      siteOrigin: window.location.origin,
      landingRouteFamily: context.family,
      ...(surface ? { landingSurface: surface } : {}),
      ...(locale ? { locale } : {}),
    });
  } catch {
    return null;
  }
}

export function readAnalyticsJourney(now = Date.now()): AnalyticsJourneyRecordV1 | null {
  if (!hasAnalyticsConsentInBrowser()) {
    clearAnalyticsJourney();
    return null;
  }
  return readStoredAnalyticsJourney(now);
}

export function clearAnalyticsJourney(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ANALYTICS_JOURNEY_STORAGE_KEY);
  } catch {
    // Analytics storage must never interrupt product behavior.
  }
}

export function prepareBrowserAnalyticsEvents(
  event: string,
  payload: Record<string, unknown> = {},
): PreparedAnalyticsEvent[] {
  if (!hasAnalyticsConsentInBrowser()) {
    clearAnalyticsJourney();
    return [];
  }

  const now = Date.now();
  const touch = resolveCurrentTouch();
  if (!touch) return [];

  let record = readStoredAnalyticsJourney(now);
  if (!record) {
    try {
      record = createAnalyticsJourneyRecord({ journeyId: crypto.randomUUID(), now, touch });
    } catch {
      return [];
    }
  } else {
    record = applyAnalyticsTouch(record, touch, now);
  }

  const prepared = prepareJourneyEvents(record, event, payload, now);
  persistAnalyticsJourney(prepared.record);
  return prepared.events;
}

export function readWalletAnalyticsJourney(): WalletAnalyticsJourney | null {
  const record = readAnalyticsJourney();
  if (!record) return null;
  return parseWalletAnalyticsJourney({
    version: record.version,
    journeyId: record.journeyId,
    cohortWeek: record.cohortWeek,
    firstSource: record.firstTouch.source,
    firstMedium: record.firstTouch.medium,
    ...(record.firstTouch.campaign ? { firstCampaign: record.firstTouch.campaign } : {}),
    ...(record.firstTouch.content ? { firstContent: record.firstTouch.content } : {}),
    lastSource: record.lastTouch.source,
    lastMedium: record.lastTouch.medium,
    ...(record.lastTouch.campaign ? { lastCampaign: record.lastTouch.campaign } : {}),
    ...(record.lastTouch.content ? { lastContent: record.lastTouch.content } : {}),
  });
}

export function clearBrowserAnalyticsState(): void {
  clearAnalyticsJourney();
  clearPendingAnalyticsEvent();
}
