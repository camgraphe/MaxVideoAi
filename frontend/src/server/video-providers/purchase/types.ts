import type { VideoProviderKey } from '../types';

export type PurchaseRequest = {
  engineId: string;
  mode: string;
  durationSec: number;
  resolution: string;
  aspectRatio: string | null;
  images: number;
  hasVideo: boolean;
  inputVideoSeconds: number | null;
  hasAudioReference: boolean;
  hasDocument: boolean;
  hasEndFrame: boolean;
  hasStartFrame?: boolean;
  observedVideoTokens?: number;
  audioEnabled?: boolean;
  requiresDirectControls?: boolean;
  hasUnpricedOptions?: boolean;
};
export type PurchaseOffer = {
  provider: VideoProviderKey;
  tariff: string;
  terminal?: boolean;
  comparisonAccess?: (request: PurchaseRequest) => (
    { simulationOnly: true } | { pilotOnly: true }
  ) & { sourceUrl: string };
  /** Declared in preference order for equal costs. All estimates are integer microdollars. */
  quote: (request: PurchaseRequest) => number | null;
  exclude: (request: PurchaseRequest) => string | null;
};
