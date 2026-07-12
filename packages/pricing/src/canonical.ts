import type { PricingCompatibilityProfile, ResolvedPricingPolicy } from './policy';

const CENT_EPSILON = 1e-9;

export type PricingFacts = {
  engineId: string;
  currency: string;
  vendorSubtotalExactCents: number;
  unit: string;
  quantity: number;
  metadata?: Record<string, unknown>;
};

export type PricingScenario = {
  id: string;
  engineId: string;
  mode?: string;
  resolution?: string;
  membershipTier: 'member' | 'plus' | 'pro';
  discountPercent: number;
  surcharge?: 'audio' | 'upscale';
};

export type CanonicalPricingQuote = {
  engineId: string;
  scenarioId: string;
  membershipTier: 'member' | 'plus' | 'pro';
  currency: string;
  vendorSubtotalCents: number;
  marginCents: number;
  surchargeCents: number;
  discountCents: number;
  subtotalBeforeDiscountCents: number;
  customerTotalCents: number;
  platformFeeCents: number;
  vendorShareCents: number;
  unit: string;
  quantity: number;
  breakdown: {
    vendorSubtotalExactCents: number;
    marginPercent: number;
    marginFlatCents: number;
    surchargePercent: number;
    discountPercent: number;
  };
  policyProvenance: {
    source: 'database' | 'versioned';
    matchedBy: 'precise' | 'engine' | 'global';
    sourceRuleId: string;
    compatibilityProfile: string;
  };
};

export type PricingDomainErrorCode =
  | 'invalid_facts'
  | 'invalid_scenario'
  | 'currency_mismatch'
  | 'unknown_surcharge';

export class PricingDomainError extends Error {
  readonly code: PricingDomainErrorCode;

  constructor(code: PricingDomainErrorCode, message: string) {
    super(message);
    this.name = 'PricingDomainError';
    this.code = code;
  }
}

type IntegerRounding = 'nearest' | 'up' | 'down';

function roundCents(value: number, mode: IntegerRounding): number {
  if (mode === 'up') return Math.ceil(value - CENT_EPSILON);
  if (mode === 'down') return Math.floor(value + CENT_EPSILON);
  return Math.round(value);
}

function normaliseCents(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function assertFiniteNonNegative(value: number, code: PricingDomainErrorCode, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new PricingDomainError(code, `${label} must be finite and non-negative`);
  }
}

export function quoteCanonicalPricing(input: {
  facts: PricingFacts;
  scenario: PricingScenario;
  policy: ResolvedPricingPolicy;
  compatibilityProfile: PricingCompatibilityProfile;
}): CanonicalPricingQuote {
  const { facts, scenario, policy, compatibilityProfile } = input;
  assertFiniteNonNegative(facts.vendorSubtotalExactCents, 'invalid_facts', 'vendorSubtotalExactCents');
  assertFiniteNonNegative(facts.quantity, 'invalid_facts', 'quantity');
  if (facts.quantity <= 0 || !facts.unit.trim()) {
    throw new PricingDomainError('invalid_facts', 'quantity and unit must describe a positive factual unit');
  }
  assertFiniteNonNegative(scenario.discountPercent, 'invalid_scenario', 'discountPercent');
  if (scenario.discountPercent > 1 || facts.engineId !== scenario.engineId || !scenario.id.trim()) {
    throw new PricingDomainError('invalid_scenario', 'scenario must match facts and use a discount between 0 and 1');
  }

  const factsCurrency = facts.currency.trim().toUpperCase();
  const policyCurrency = policy.rule.currency.trim().toUpperCase();
  if (!factsCurrency || factsCurrency !== policyCurrency) {
    throw new PricingDomainError('currency_mismatch', `facts use ${factsCurrency || 'no currency'} but policy uses ${policyCurrency}`);
  }

  const vendorBaseForMath =
    compatibilityProfile.vendorSubtotalRounding === 'preserve'
      ? facts.vendorSubtotalExactCents
      : roundCents(facts.vendorSubtotalExactCents, compatibilityProfile.vendorSubtotalRounding);
  const vendorSubtotalCents =
    compatibilityProfile.vendorSubtotalRounding === 'preserve'
      ? roundCents(facts.vendorSubtotalExactCents, 'nearest')
      : vendorBaseForMath;
  const marginPercent = compatibilityProfile.marginPercentOverride ?? policy.rule.marginPercent;
  const marginFlatCents = compatibilityProfile.marginFlatCentsOverride ?? policy.rule.marginFlatCents;
  let marginCents = Math.max(
    0,
    roundCents(
      vendorBaseForMath * marginPercent + marginFlatCents,
      compatibilityProfile.marginRounding
    )
  );

  let surchargePercent = 0;
  if (scenario.surcharge === 'audio') {
    surchargePercent = compatibilityProfile.surchargeAudioPercentOverride ?? policy.rule.surchargeAudioPercent;
  } else if (scenario.surcharge === 'upscale') {
    surchargePercent = compatibilityProfile.surchargeUpscalePercentOverride ?? policy.rule.surchargeUpscalePercent;
  }
  else if (scenario.surcharge != null) {
    throw new PricingDomainError('unknown_surcharge', `unsupported surcharge ${String(scenario.surcharge)}`);
  }
  const surchargeCents = Math.max(
    0,
    roundCents(vendorBaseForMath * surchargePercent, compatibilityProfile.surchargeRounding)
  );
  let subtotalBeforeDiscountExactCents = vendorBaseForMath + marginCents + surchargeCents;
  if (compatibilityProfile.subtotalRounding) {
    subtotalBeforeDiscountExactCents = roundCents(
      facts.vendorSubtotalExactCents * (1 + marginPercent + surchargePercent) + marginFlatCents,
      compatibilityProfile.subtotalRounding
    );
    marginCents = Math.max(0, subtotalBeforeDiscountExactCents - vendorSubtotalCents - surchargeCents);
  }
  const discountPercent = compatibilityProfile.discountPercentOverride ?? scenario.discountPercent;
  const discountCents = Math.max(
    0,
    roundCents(subtotalBeforeDiscountExactCents * discountPercent, compatibilityProfile.discountRounding)
  );
  const customerTotalCents = Math.max(
    0,
    roundCents(subtotalBeforeDiscountExactCents - discountCents, compatibilityProfile.totalRounding)
  );
  const commercialCents = marginCents + surchargeCents;
  const discountAppliedToCommercial = Math.min(commercialCents, discountCents);
  const platformFeeCents = Math.max(0, commercialCents - discountAppliedToCommercial);
  const vendorShareCents =
    compatibilityProfile.vendorShareMode === 'zero'
      ? 0
      : Math.max(0, customerTotalCents - platformFeeCents);

  return {
    engineId: facts.engineId,
    scenarioId: scenario.id,
    membershipTier: scenario.membershipTier,
    currency: factsCurrency,
    vendorSubtotalCents,
    marginCents,
    surchargeCents,
    discountCents,
    subtotalBeforeDiscountCents: normaliseCents(subtotalBeforeDiscountExactCents),
    customerTotalCents,
    platformFeeCents,
    vendorShareCents,
    unit: facts.unit,
    quantity: facts.quantity,
    breakdown: {
      vendorSubtotalExactCents: facts.vendorSubtotalExactCents,
      marginPercent,
      marginFlatCents,
      surchargePercent,
      discountPercent,
    },
    policyProvenance: {
      source: policy.source,
      matchedBy: policy.matchedBy,
      sourceRuleId: policy.sourceRuleId,
      compatibilityProfile: compatibilityProfile.id,
    },
  };
}

export function scaleCanonicalPricingQuote(
  quote: CanonicalPricingQuote,
  factor: number
): CanonicalPricingQuote {
  if (!Number.isInteger(factor) || factor <= 0) {
    throw new PricingDomainError('invalid_scenario', 'canonical quote scale factor must be a positive integer');
  }
  return {
    ...quote,
    vendorSubtotalCents: quote.vendorSubtotalCents * factor,
    marginCents: quote.marginCents * factor,
    surchargeCents: quote.surchargeCents * factor,
    discountCents: quote.discountCents * factor,
    subtotalBeforeDiscountCents: normaliseCents(quote.subtotalBeforeDiscountCents * factor),
    customerTotalCents: quote.customerTotalCents * factor,
    platformFeeCents: quote.platformFeeCents * factor,
    vendorShareCents: quote.vendorShareCents * factor,
    quantity: quote.quantity * factor,
    breakdown: {
      ...quote.breakdown,
      vendorSubtotalExactCents: normaliseCents(quote.breakdown.vendorSubtotalExactCents * factor),
    },
  };
}
