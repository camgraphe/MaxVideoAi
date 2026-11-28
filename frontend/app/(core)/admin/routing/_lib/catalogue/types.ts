import type { PurchaseCandidate, PurchaseProviderKey, PurchaseRoutingEngineId } from '@/lib/video-purchase-decision';
import type { PurchaseRequest } from '@/server/video-providers/purchase/types';

/** Extra facts for admin simulations and economic replays of observed profiles. */
export type ComparisonRequest = PurchaseRequest & {
  referenceVideoSeconds?: readonly number[];
  promptCharacters?: number;
  h3PromptExpansion?: string;
  requestedRatioVerified?: boolean;
  observedAspectRatio?: string;
};

export type CatalogueQuote = Pick<PurchaseCandidate, 'tariff' | 'costMicros' | 'excluded'> & {
  sourceUrl: string;
  /** Positive evidence that no original frame ratio can make this offer compatible. */
  excludedAtEveryRatio?: true;
};

export type CatalogueCard = {
  provider: PurchaseProviderKey;
  engines: readonly PurchaseRoutingEngineId[];
  quote(request: ComparisonRequest): CatalogueQuote;
};
