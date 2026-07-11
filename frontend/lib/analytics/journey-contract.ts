export const ANALYTICS_JOURNEY_VERSION = 1 as const;
export const ANALYTICS_JOURNEY_TTL_MS = 90 * 24 * 60 * 60 * 1000;
export const ANALYTICS_JOURNEY_STORAGE_KEY = 'mvai.analytics-journey.v1';

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const ISO_COHORT_WEEK_PATTERN = /^\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])$/;

export type AnalyticsTouch = {
  source: string; medium: string; campaign?: string; content?: string; referrerHost?: string;
  landingRouteFamily: string; landingSurface?: string; locale?: string;
};

export type AnalyticsJourneyRecordV1 = {
  version: 1; journeyId: string; createdAt: number; expiresAt: number; cohortWeek: string;
  firstTouch: AnalyticsTouch; lastTouch: AnalyticsTouch; lastTouchAt: number;
  funnelEntrySent: boolean; generationStartedCount: number; topupStartedCount: number;
};

export type WalletAnalyticsJourney = {
  version: 1; journeyId: string; cohortWeek: string;
  firstSource: string; firstMedium: string; firstCampaign?: string; firstContent?: string;
  lastSource: string; lastMedium: string; lastCampaign?: string; lastContent?: string;
};

export type PreparedAnalyticsEvent = { event: string; payload: Record<string, unknown> };

export function sanitizeAttributionValue(value: unknown, options: { lowercase?: boolean } = {}): string | null {
  if (typeof value !== 'string') return null;
  const result = value.normalize('NFKC').trim().replace(/[^a-zA-Z0-9._~+\-/: ]/g, '').slice(0, 80).trim();
  if (!result) return null;
  return options.lowercase ? result.toLowerCase() : result;
}

export function parseWalletAnalyticsJourney(value: unknown): WalletAnalyticsJourney | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const candidate = value as Record<string, unknown>;
  if (candidate.version !== ANALYTICS_JOURNEY_VERSION) return null;

  const journeyId = sanitizeAttributionValue(candidate.journeyId, { lowercase: true });
  const cohortWeek = sanitizeAttributionValue(candidate.cohortWeek);
  const firstSource = sanitizeAttributionValue(candidate.firstSource, { lowercase: true });
  const firstMedium = sanitizeAttributionValue(candidate.firstMedium, { lowercase: true });
  const lastSource = sanitizeAttributionValue(candidate.lastSource, { lowercase: true });
  const lastMedium = sanitizeAttributionValue(candidate.lastMedium, { lowercase: true });

  if (
    !journeyId || !UUID_PATTERN.test(journeyId)
    || !cohortWeek || !ISO_COHORT_WEEK_PATTERN.test(cohortWeek)
    || !firstSource || !firstMedium || !lastSource || !lastMedium
  ) {
    return null;
  }

  const parsed: WalletAnalyticsJourney = {
    version: ANALYTICS_JOURNEY_VERSION,
    journeyId,
    cohortWeek,
    firstSource,
    firstMedium,
    lastSource,
    lastMedium,
  };

  const firstCampaign = sanitizeAttributionValue(candidate.firstCampaign);
  const firstContent = sanitizeAttributionValue(candidate.firstContent);
  const lastCampaign = sanitizeAttributionValue(candidate.lastCampaign);
  const lastContent = sanitizeAttributionValue(candidate.lastContent);
  if (firstCampaign) parsed.firstCampaign = firstCampaign;
  if (firstContent) parsed.firstContent = firstContent;
  if (lastCampaign) parsed.lastCampaign = lastCampaign;
  if (lastContent) parsed.lastContent = lastContent;

  return parsed;
}

export function walletAnalyticsJourneyCacheKey(value: WalletAnalyticsJourney | null): string {
  const journey = parseWalletAnalyticsJourney(value);
  if (!journey) return 'no-attribution';
  return [
    journey.version,
    journey.journeyId,
    journey.cohortWeek,
    journey.firstSource,
    journey.firstMedium,
    journey.firstCampaign ?? '',
    journey.firstContent ?? '',
    journey.lastSource,
    journey.lastMedium,
    journey.lastCampaign ?? '',
    journey.lastContent ?? '',
  ].join('|');
}
