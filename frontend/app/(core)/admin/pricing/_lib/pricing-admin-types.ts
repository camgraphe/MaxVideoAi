export type PricingRule = {
  id: string;
  engineId?: string;
  resolution?: string;
  marginPercent: number;
  marginFlatCents: number;
  currency: string;
  vendorAccountId?: string;
};

export type PricingRulesResponse =
  | { ok: true; rules: PricingRule[] }
  | { ok: false; error?: string };

export type MembershipTier = {
  tier: string;
  spendThresholdCents: number;
  discountPercent: number;
};

export type MembershipResponse =
  | { ok: true; tiers: MembershipTier[] }
  | { ok: false; error?: string };

export type BillingProduct = {
  productKey: string;
  surface: 'video' | 'image' | 'character' | 'angle';
  label: string;
  currency: string;
  unitKind: 'image' | 'run';
  unitPriceCents: number;
  active: boolean;
  metadata?: Record<string, unknown> | null;
};

export type BillingProductsResponse =
  | { ok: true; products: BillingProduct[] }
  | { ok: false; error?: string };

export type MembershipDraft = Record<string, { thresholdUsd: string; discountPct: string }>;

export type RuleForm = {
  engineId: string;
  resolution: string;
  marginPercent: string;
  marginFlatUsd: string;
  currency: string;
  vendorAccountId: string;
};
