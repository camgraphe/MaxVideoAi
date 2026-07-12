import type { CanonicalPricingQuote } from './canonical';
import type { PricingSnapshot } from './types';

export type CanonicalSnapshotProjectionInput = {
  quote: CanonicalPricingQuote;
  base: PricingSnapshot['base'];
  addons: PricingSnapshot['addons'];
  vendorAccountId?: string | null;
  meta?: Record<string, unknown>;
};

function assertFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be finite and non-negative`);
  }
}

export function projectCanonicalQuoteToSnapshot(
  input: CanonicalSnapshotProjectionInput
): PricingSnapshot {
  assertFiniteNonNegative(input.base.seconds, 'base.seconds');
  assertFiniteNonNegative(input.base.rate, 'base.rate');
  assertFiniteNonNegative(input.base.amountCents, 'base.amountCents');
  input.addons.forEach((addon, index) => {
    assertFiniteNonNegative(addon.amountCents, `addons[${index}].amountCents`);
  });

  const { quote } = input;
  const discount = quote.discountCents
    ? {
        amountCents: quote.discountCents,
        percentApplied: quote.breakdown.discountPercent,
        tier: quote.membershipTier,
      }
    : undefined;

  return {
    currency: quote.currency,
    totalCents: quote.customerTotalCents,
    subtotalBeforeDiscountCents: quote.subtotalBeforeDiscountCents,
    base: { ...input.base },
    addons: input.addons.map((addon) => ({ ...addon })),
    margin: {
      amountCents: quote.marginCents + quote.surchargeCents,
      percentApplied: quote.breakdown.marginPercent + quote.breakdown.surchargePercent,
      flatCents: quote.breakdown.marginFlatCents,
      ruleId: quote.policyProvenance.sourceRuleId,
    },
    ...(discount ? { discount } : {}),
    membershipTier: quote.membershipTier,
    platformFeeCents: quote.platformFeeCents,
    vendorShareCents: quote.vendorShareCents,
    ...(input.vendorAccountId ? { vendorAccountId: input.vendorAccountId } : {}),
    meta: {
      ...(input.meta ?? {}),
      pricingPolicy: { ...quote.policyProvenance },
    },
  };
}
