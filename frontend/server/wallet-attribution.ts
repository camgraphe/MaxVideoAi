import { createHash } from 'node:crypto';

import {
  ANALYTICS_JOURNEY_VERSION,
  parseWalletAnalyticsJourney,
  type WalletAnalyticsJourney,
} from '@/lib/analytics/journey-contract';

export type NormalizedWalletAttribution = {
  journey: WalletAnalyticsJourney;
  fingerprint: string;
};

function fingerprintJourney(journey: WalletAnalyticsJourney): string {
  const projection = [
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
  ];

  return createHash('sha256')
    .update(JSON.stringify(projection), 'utf8')
    .digest('hex')
    .slice(0, 32);
}

export function normalizeWalletAttribution(
  value: unknown,
  consentGranted: boolean,
): NormalizedWalletAttribution | null {
  if (!consentGranted) return null;

  const journey = parseWalletAnalyticsJourney(value);
  if (!journey) return null;

  return {
    journey,
    fingerprint: fingerprintJourney(journey),
  };
}

export function buildWalletAttributionMetadata(
  attribution: NormalizedWalletAttribution | null,
): Record<string, string> {
  if (!attribution) return {};

  const { journey, fingerprint } = attribution;
  return {
    journey_id: journey.journeyId,
    acquisition_cohort: journey.cohortWeek,
    first_touch_source: journey.firstSource,
    first_touch_medium: journey.firstMedium,
    ...(journey.firstCampaign ? { first_touch_campaign: journey.firstCampaign } : {}),
    ...(journey.firstContent ? { first_touch_content: journey.firstContent } : {}),
    last_touch_source: journey.lastSource,
    last_touch_medium: journey.lastMedium,
    ...(journey.lastCampaign ? { last_touch_campaign: journey.lastCampaign } : {}),
    ...(journey.lastContent ? { last_touch_content: journey.lastContent } : {}),
    attribution_fingerprint: fingerprint,
  };
}

export function buildCheckoutAttemptAttributionMetadata(
  attribution: NormalizedWalletAttribution | null,
): Record<string, string> {
  if (!attribution) return {};

  const { journey, fingerprint } = attribution;
  return {
    journeyId: journey.journeyId,
    acquisitionCohort: journey.cohortWeek,
    firstSource: journey.firstSource,
    firstMedium: journey.firstMedium,
    lastSource: journey.lastSource,
    lastMedium: journey.lastMedium,
    attributionFingerprint: fingerprint,
  };
}

export function matchesWalletAttribution(
  metadata: Record<string, unknown> | null,
  attribution: NormalizedWalletAttribution | null,
): boolean {
  const metadataJourneyId = metadata?.journey_id;
  const metadataFingerprint = metadata?.attribution_fingerprint;

  if (!attribution) {
    return metadataJourneyId === undefined && metadataFingerprint === undefined;
  }

  return metadataJourneyId === attribution.journey.journeyId
    && metadataFingerprint === attribution.fingerprint;
}

export function buildTopupAttributionGa4Params(metadata: unknown): Record<string, string> {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};

  const candidate = metadata as Record<string, unknown>;
  const journey = parseWalletAnalyticsJourney({
    version: ANALYTICS_JOURNEY_VERSION,
    journeyId: candidate.journey_id,
    cohortWeek: candidate.acquisition_cohort,
    firstSource: candidate.first_touch_source,
    firstMedium: candidate.first_touch_medium,
    firstCampaign: candidate.first_touch_campaign,
    firstContent: candidate.first_touch_content,
    lastSource: candidate.last_touch_source,
    lastMedium: candidate.last_touch_medium,
    lastCampaign: candidate.last_touch_campaign,
    lastContent: candidate.last_touch_content,
  });
  if (!journey) return {};

  return {
    journey_id: journey.journeyId,
    acquisition_cohort: journey.cohortWeek,
    first_touch_source: journey.firstSource,
    first_touch_medium: journey.firstMedium,
    ...(journey.firstCampaign ? { first_touch_campaign: journey.firstCampaign } : {}),
    ...(journey.firstContent ? { first_touch_content: journey.firstContent } : {}),
    last_touch_source: journey.lastSource,
    last_touch_medium: journey.lastMedium,
    ...(journey.lastCampaign ? { last_touch_campaign: journey.lastCampaign } : {}),
    ...(journey.lastContent ? { last_touch_content: journey.lastContent } : {}),
  };
}
