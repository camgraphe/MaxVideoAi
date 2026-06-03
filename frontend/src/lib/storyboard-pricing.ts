import type { PricingSnapshot } from '@/types/engines';

export const STORYBOARD_PRICING_MULTIPLIER = 3;
export const STORYBOARD_EDIT_PRICING_MULTIPLIER = 2;
export const STORYBOARD_SOURCE = 'storyboard';
export const STORYBOARD_EDIT_SOURCE = 'storyboard_edit';
export const STORYBOARD_BILLING_ENGINE_ID = 'storyboarder';
export const STORYBOARD_BILLING_LABEL = 'Storyboarder';
export const STORYBOARD_EDIT_BILLING_LABEL = 'Storyboarder edit';

export type StoryboardTier = 'hd' | '4k' | 'ultra';

export function isStoryboardBillingSource(value: unknown): value is typeof STORYBOARD_SOURCE | typeof STORYBOARD_EDIT_SOURCE {
  return value === STORYBOARD_SOURCE || value === STORYBOARD_EDIT_SOURCE;
}

export function getStoryboardBillingIdentity(source: unknown): {
  engineId: string;
  engineLabel: string;
  productLabel: string;
} {
  return {
    engineId: STORYBOARD_BILLING_ENGINE_ID,
    engineLabel: STORYBOARD_BILLING_LABEL,
    productLabel: source === STORYBOARD_EDIT_SOURCE ? STORYBOARD_EDIT_BILLING_LABEL : STORYBOARD_BILLING_LABEL,
  };
}

export function resolveStoryboardTier(params: {
  customImageSize?: { width?: number | null; height?: number | null } | null;
  resolution?: string | null;
  quality?: string | null;
}): StoryboardTier {
  const quality = typeof params.quality === 'string' ? params.quality.trim().toLowerCase() : '';
  const resolution = typeof params.resolution === 'string' ? params.resolution.trim().toLowerCase() : '';
  const customWidth = Number(params.customImageSize?.width ?? 0);
  const customHeight = Number(params.customImageSize?.height ?? 0);
  const customIs4k = customWidth >= 2160 || customHeight >= 2160 || customWidth * customHeight >= 8_000_000;
  const is4k = resolution === '3840x2160' || customIs4k;
  if (quality === 'high' && is4k) return 'ultra';
  if (is4k) return '4k';
  return 'hd';
}

function applyStoryboardMultiplierPricing(params: {
  snapshot: PricingSnapshot;
  multiplier: number;
  meta: Record<string, string | number>;
}): PricingSnapshot {
  const { snapshot, multiplier, meta } = params;
  const baseAmountCents = Math.max(0, Math.round(snapshot.base?.amountCents ?? 0));
  const marginAmountCents = Math.max(0, baseAmountCents * (multiplier - 1));
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
      percentApplied: multiplier - 1,
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
      ...meta,
    },
  };
}

export function applyStoryboardPricing(snapshot: PricingSnapshot, tier: StoryboardTier): PricingSnapshot {
  return applyStoryboardMultiplierPricing({
    snapshot,
    multiplier: STORYBOARD_PRICING_MULTIPLIER,
    meta: {
      pricing_model: 'storyboarder_x3',
      source: STORYBOARD_SOURCE,
      engineId: STORYBOARD_BILLING_ENGINE_ID,
      engineLabel: STORYBOARD_BILLING_LABEL,
      billingEngineId: STORYBOARD_BILLING_ENGINE_ID,
      billingEngineLabel: STORYBOARD_BILLING_LABEL,
      billingProductLabel: STORYBOARD_BILLING_LABEL,
      storyboard_multiplier: STORYBOARD_PRICING_MULTIPLIER,
      storyboard_tier: tier,
    },
  });
}

export function applyStoryboardEditPricing(snapshot: PricingSnapshot): PricingSnapshot {
  return applyStoryboardMultiplierPricing({
    snapshot,
    multiplier: STORYBOARD_EDIT_PRICING_MULTIPLIER,
    meta: {
      pricing_model: 'storyboarder_edit_x2',
      source: STORYBOARD_EDIT_SOURCE,
      engineId: STORYBOARD_BILLING_ENGINE_ID,
      engineLabel: STORYBOARD_BILLING_LABEL,
      billingEngineId: STORYBOARD_BILLING_ENGINE_ID,
      billingEngineLabel: STORYBOARD_BILLING_LABEL,
      billingProductLabel: STORYBOARD_EDIT_BILLING_LABEL,
      storyboard_edit_multiplier: STORYBOARD_EDIT_PRICING_MULTIPLIER,
    },
  });
}
