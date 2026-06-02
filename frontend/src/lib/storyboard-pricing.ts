import type { PricingSnapshot } from '@/types/engines';

export const STORYBOARD_PRICING_MULTIPLIER = 3;
export const STORYBOARD_SOURCE = 'storyboard';

export type StoryboardTier = 'normal' | 'hq';

export function resolveStoryboardTier(params: {
  resolution?: string | null;
  quality?: string | null;
}): StoryboardTier {
  const quality = typeof params.quality === 'string' ? params.quality.trim().toLowerCase() : '';
  const resolution = typeof params.resolution === 'string' ? params.resolution.trim().toLowerCase() : '';
  return quality === 'high' || resolution === '3840x2160' ? 'hq' : 'normal';
}

export function applyStoryboardPricing(snapshot: PricingSnapshot, tier: StoryboardTier): PricingSnapshot {
  const baseAmountCents = Math.max(0, Math.round(snapshot.base?.amountCents ?? 0));
  const marginAmountCents = Math.max(0, baseAmountCents * (STORYBOARD_PRICING_MULTIPLIER - 1));
  const subtotalBeforeDiscountCents = baseAmountCents + marginAmountCents;
  const discountPercent = snapshot.discount?.percentApplied ?? 0;
  const discountAmountCents =
    discountPercent > 0 ? Math.round(subtotalBeforeDiscountCents * discountPercent) : 0;
  const totalCents = Math.max(0, subtotalBeforeDiscountCents - discountAmountCents);
  const discountAppliedToMargin = Math.min(marginAmountCents, discountAmountCents);
  const platformFeeCents = Math.max(0, marginAmountCents - discountAppliedToMargin);
  const vendorShareCents = Math.max(0, totalCents - platformFeeCents);

  return {
    ...snapshot,
    totalCents,
    subtotalBeforeDiscountCents,
    margin: {
      amountCents: marginAmountCents,
      percentApplied: STORYBOARD_PRICING_MULTIPLIER - 1,
      flatCents: 0,
    },
    discount: discountAmountCents
      ? {
          amountCents: discountAmountCents,
          percentApplied: discountPercent,
          tier: snapshot.discount?.tier ?? snapshot.membershipTier ?? 'member',
        }
      : undefined,
    platformFeeCents,
    vendorShareCents,
    meta: {
      ...(snapshot.meta ?? {}),
      pricing_model: 'storyboard_gpt_image_2_x3',
      source: STORYBOARD_SOURCE,
      storyboard_multiplier: STORYBOARD_PRICING_MULTIPLIER,
      storyboard_tier: tier,
    },
  };
}
