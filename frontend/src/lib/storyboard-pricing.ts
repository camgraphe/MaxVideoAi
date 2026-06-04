import type { PricingSnapshot } from '@/types/engines';
import type { ImageGenerationRequest } from '@/types/image-generation';

export const STORYBOARD_PRICING_MULTIPLIER = 3;
export const STORYBOARD_EDIT_PRICING_MULTIPLIER = 2;
export const STORYBOARD_SOURCE = 'storyboard';
export const STORYBOARD_EDIT_SOURCE = 'storyboard_edit';
export const STORYBOARD_BILLING_ENGINE_ID = 'storyboarder';
export const STORYBOARD_BILLING_LABEL = 'Storyboarder';
export const STORYBOARD_EDIT_BILLING_LABEL = 'Storyboarder edit';
export const STORYBOARD_INCLUDED_PAYMENT_STATUS = 'included';
export const STORYBOARD_KLING_FIRST_FRAME_JOB_PREFIX = 'storyboard_kling_first_frame_';

export type StoryboardTier = 'hd' | '4k' | 'ultra';
export type StoryboardOrientation = 'landscape' | 'portrait';

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

export function isKlingStoryboardBoardMetadata(metadata: ImageGenerationRequest['metadata'] | null | undefined) {
  return metadata?.storyboard?.role === 'board' && metadata.storyboard.targetModel === 'kling';
}

export function getKlingStoryboardFirstFrameParentJobId(
  metadata: ImageGenerationRequest['metadata'] | null | undefined
): string | null {
  const storyboard = metadata?.storyboard;
  if (storyboard?.role !== 'kling_first_frame' || storyboard.targetModel !== 'kling') return null;
  return typeof storyboard.parentJobId === 'string' && storyboard.parentJobId.trim().length
    ? storyboard.parentJobId.trim()
    : null;
}

export function inferStoryboardOrientation(params: {
  customImageSize?: { width?: number | null; height?: number | null } | null;
  aspectRatio?: string | null;
}): StoryboardOrientation {
  const width = Number(params.customImageSize?.width ?? 0);
  const height = Number(params.customImageSize?.height ?? 0);
  if (width > 0 && height > 0) return height > width ? 'portrait' : 'landscape';
  return params.aspectRatio === '9:16' ? 'portrait' : 'landscape';
}

export function getStoryboardKlingFirstFramePricingConfig(params: {
  customImageSize?: { width?: number | null; height?: number | null } | null;
  aspectRatio?: string | null;
}): {
  resolution: string;
  customImageSize: { width: number; height: number } | null;
  quality: 'medium';
} {
  const orientation = inferStoryboardOrientation(params);
  return orientation === 'portrait'
    ? {
        resolution: 'custom',
        customImageSize: { width: 1152, height: 2048 },
        quality: 'medium',
      }
    : {
        resolution: '1920x1080',
        customImageSize: null,
        quality: 'medium',
      };
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

function sumCents(...values: Array<number | null | undefined>): number {
  let total = 0;
  for (const value of values) {
    total += Math.max(0, Math.round(value ?? 0));
  }
  return total;
}

export function applyStoryboardKlingBundlePricing(
  boardPricing: PricingSnapshot,
  firstFramePricing: PricingSnapshot
): PricingSnapshot {
  const boardTotalCents = Math.max(0, Math.round(boardPricing.totalCents));
  const firstFrameTotalCents = Math.max(0, Math.round(firstFramePricing.totalCents));
  const discountAmountCents = sumCents(boardPricing.discount?.amountCents, firstFramePricing.discount?.amountCents);

  return {
    ...boardPricing,
    totalCents: boardTotalCents + firstFrameTotalCents,
    subtotalBeforeDiscountCents: sumCents(
      boardPricing.subtotalBeforeDiscountCents,
      firstFramePricing.subtotalBeforeDiscountCents
    ),
    base: {
      ...boardPricing.base,
      amountCents: sumCents(boardPricing.base?.amountCents, firstFramePricing.base?.amountCents),
    },
    addons: [...(boardPricing.addons ?? []), ...(firstFramePricing.addons ?? [])],
    margin: {
      ...boardPricing.margin,
      amountCents: sumCents(boardPricing.margin?.amountCents, firstFramePricing.margin?.amountCents),
    },
    discount: discountAmountCents
      ? {
          ...(boardPricing.discount ?? firstFramePricing.discount),
          amountCents: discountAmountCents,
        }
      : undefined,
    platformFeeCents: sumCents(boardPricing.platformFeeCents, firstFramePricing.platformFeeCents),
    vendorShareCents: sumCents(boardPricing.vendorShareCents, firstFramePricing.vendorShareCents),
    meta: {
      ...(boardPricing.meta ?? {}),
      pricing_model: 'storyboarder_kling_bundle_x3',
      storyboard_includes_kling_first_frame: true,
      storyboard_board_total_cents: boardTotalCents,
      storyboard_kling_first_frame_total_cents: firstFrameTotalCents,
      storyboard_kling_first_frame_tier: 'hd',
    },
  };
}

export function createIncludedStoryboardKlingFirstFramePricing(
  snapshot: PricingSnapshot,
  parentJobId: string
): PricingSnapshot {
  return {
    ...snapshot,
    totalCents: 0,
    subtotalBeforeDiscountCents: 0,
    base: {
      ...snapshot.base,
      amountCents: 0,
    },
    addons: [],
    margin: {
      ...snapshot.margin,
      amountCents: 0,
      percentApplied: 0,
      flatCents: 0,
    },
    discount: undefined,
    platformFeeCents: 0,
    vendorShareCents: 0,
    meta: {
      ...(snapshot.meta ?? {}),
      pricing_model: 'storyboarder_kling_first_frame_included',
      source: STORYBOARD_SOURCE,
      engineId: STORYBOARD_BILLING_ENGINE_ID,
      engineLabel: STORYBOARD_BILLING_LABEL,
      billingEngineId: STORYBOARD_BILLING_ENGINE_ID,
      billingEngineLabel: STORYBOARD_BILLING_LABEL,
      billingProductLabel: STORYBOARD_BILLING_LABEL,
      storyboard_included: true,
      storyboard_included_parent_job_id: parentJobId,
      storyboard_role: 'kling_first_frame',
      storyboard_provider_cost_cents_included: Math.max(0, Math.round(snapshot.base?.amountCents ?? 0)),
    },
  };
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
