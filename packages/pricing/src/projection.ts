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

function assertProviderAddonAmount(addon: PricingSnapshot['addons'][number], index: number): void {
  if (!Number.isFinite(addon.amountCents)) {
    throw new Error(`addons[${index}].amountCents must be finite`);
  }
  if (addon.amountCents < 0 && addon.type !== 'audio_off') {
    throw new Error(`addons[${index}].amountCents must be non-negative unless it is audio_off`);
  }
}

export function projectCanonicalQuoteToSnapshot(
  input: CanonicalSnapshotProjectionInput
): PricingSnapshot {
  assertFiniteNonNegative(input.base.seconds, 'base.seconds');
  assertFiniteNonNegative(input.base.rate, 'base.rate');
  assertFiniteNonNegative(input.base.amountCents, 'base.amountCents');
  input.addons.forEach(assertProviderAddonAmount);
  const presentedVendorSubtotal =
    input.base.amountCents + input.addons.reduce((sum, addon) => sum + addon.amountCents, 0);
  assertFiniteNonNegative(presentedVendorSubtotal, 'presentedVendorSubtotal');

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

export function getPlatformFeeCents(snapshot: PricingSnapshot): number {
  if (typeof snapshot.platformFeeCents === 'number') {
    return Math.max(0, snapshot.platformFeeCents);
  }
  const margin = snapshot.margin?.amountCents ?? 0;
  const discount = snapshot.discount?.amountCents ?? 0;
  const discountAppliedToMargin = Math.min(margin, discount);
  return Math.max(0, margin - discountAppliedToMargin);
}

export function getVendorShareCents(snapshot: PricingSnapshot): number {
  if (typeof snapshot.vendorShareCents === 'number') {
    return Math.max(0, snapshot.vendorShareCents);
  }
  return Math.max(0, snapshot.totalCents - getPlatformFeeCents(snapshot));
}
