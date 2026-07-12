export type PricingAuditSurface =
  | 'billing'
  | 'pricing-hub'
  | 'estimator'
  | 'price-chip'
  | 'model-page'
  | 'json-ld'
  | 'audio'
  | 'tool';

export type PricingAuditScenario = {
  id: string;
  surface: PricingAuditSurface;
  engineId: string;
  mode?: string;
  resolution?: string;
  durationSec?: number;
  membershipTier?: 'member' | 'plus' | 'pro';
  equivalenceKey?: string;
  compatibilityProfile?: string;
  input: Record<string, boolean | number | string | null>;
};

export type FrozenPricingOutput = {
  scenarioId: string;
  surface: PricingAuditSurface;
  currency: string;
  vendorSubtotalCents: number;
  marginCents: number;
  surchargeCents: number;
  customerTotalCents: number;
  unit: string;
  quantity: number;
  displayedAmount?: string;
  structuredDataAmount?: string;
  equivalenceKey?: string;
  compatibilityProfile?: string;
};
