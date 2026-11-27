import type { PurchaseProviderKey } from '@/lib/video-purchase-decision';
import type { ComparisonRequest } from './comparison-offers';

/** Each job belongs to exactly one group. The quote ceiling is per job in USD micros. */
export type HistoricalReplayGroup = {
  engineId: string;
  jobs: number;
  status: string;
  paidWallet: boolean;
  bucketAt?: string | null;
  source?: string | null;
  mode?: string | null;
  resolution?: string | null;
  durationSec?: number | null;
  historicalProvider: string | null;
  request: ComparisonRequest | null;
  ceilingMicros: number | null;
  missingReason?: string;
};

export type ReplayChoice = {
  provider: PurchaseProviderKey;
  costMicros: number;
  order: PurchaseProviderKey[];
};

export type ReplayTrace = {
  paidWallet: boolean;
  basisNote?: string;
  bucketAt: string | null;
  source: string | null;
  engineId: string;
  mode: string | null;
  resolution: string | null;
  durationSec: number | null;
  jobs: number;
  status: string;
  historicalProvider: string | null;
  historicalMicros: number | null;
  ceilingMicros: number | null;
  installed: ReplayChoice | null;
  all: ReplayChoice | null;
  profile: {
    aspectRatio: string | null;
    observedAspectRatio: string | null;
    requestedRatioVerified: boolean;
    images: number;
    hasStartFrame: boolean;
    hasEndFrame: boolean;
    hasVideo: boolean;
    inputVideoSeconds: number | null;
    hasAudioReference: boolean;
    hasDocument: boolean;
    audioEnabled: boolean | null;
  } | null;
  additional: { candidate: PurchaseProviderKey; choice: ReplayChoice }[];
  excludedReason: string | null;
  offers: {provider: PurchaseProviderKey; costMicros: number | null; reason: string | null; tariff: string; sourceUrl?: string}[];
};

export type ReplayTotals = {
  jobs: number;
  completedPaidJobs: number;
  comparableJobs: number;
  excludedJobs: number;
  historicalPricedJobs: number;
  historicalPricedMicros: number;
  historicalMicros: number;
  installedMicros: number;
  allMicros: number;
  installedSavingsMicros: number;
  additionalSavingsMicros: number;
};

export type ReplayOpportunity = {
  provider: PurchaseProviderKey;
  standaloneSavingsMicros: number;
  incrementalSavingsMicros: number;
  jobsImproved: number;
  incrementalJobs: number;
};

export type HistoricalReplayReport = {
  pricingBasis: 'published-estimates';
  alibabaStandardDiscount: boolean;
  totals: ReplayTotals;
  coverage: ({engineId: string} & ReplayTotals)[];
  opportunities: ReplayOpportunity[];
  flows: {historicalProvider: string; installedProvider: string; chosenProvider: string; jobs: number; savingsMicros: number}[];
  singleRouteProfiles: {engineId: string; mode: string | null; resolution: string | null; provider: string; jobs: number; historicalMicros: number}[];
  coverageGaps: {engineId: string; mode: string | null; resolution: string | null; aspectRatio: string | null; reason: string; jobs: number}[];
  traces: ReplayTrace[];
  excludedReasons: {reason: string; jobs: number}[];
  totalProfiles: number;
  page: number;
  pageSize: number;
};
