export type MemberTier = 'member' | 'plus' | 'pro';

export interface DurationSteps {
  min: number;
  max: number;
  step: number;
  default?: number;
}

export interface PricingAddonRule {
  perSecondCents?: number;
  perSecondCentsByResolution?: Record<string, number>;
  flatCents?: number;
}

export interface PricingEngineDefinition {
  engineId: string;
  label?: string;
  version?: string;
  currency: string;
  baseUnitPriceCents: number;
  durationSteps: DurationSteps;
  resolutionMultipliers: Record<string, number>;
  minChargeCents?: number;
  taxPolicyHint?: string;
  addons?: Record<string, PricingAddonRule | undefined>;
  availability?: string;
  metadata?: Record<string, unknown>;
}

export interface PricingAddonLine {
  type: string;
  amountCents: number;
}

export interface PricingMargin {
  amountCents: number;
  percentApplied?: number;
  flatCents?: number;
  ruleId?: string;
}

export interface PricingDiscount {
  amountCents: number;
  percentApplied?: number;
  tier?: string;
}

export interface PricingSnapshot {
  currency: string;
  totalCents: number;
  subtotalBeforeDiscountCents: number;
  base: {
    seconds: number;
    rate: number;
    unit?: string;
    amountCents: number;
  };
  addons: PricingAddonLine[];
  margin: PricingMargin;
  discount?: PricingDiscount;
  membershipTier?: string;
  platformFeeCents?: number;
  vendorShareCents?: number;
  vendorAccountId?: string;
  meta?: Record<string, unknown>;
}

export interface PricingKernel {
  listDefinitions(): PricingEngineDefinition[];
  getDefinition(engineId: string): PricingEngineDefinition | undefined;
  getDurations(engineId: string): DurationSteps | undefined;
}
