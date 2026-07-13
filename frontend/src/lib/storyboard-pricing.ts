import type { PricingFacts, PricingSnapshot } from '@maxvideoai/pricing';
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

export type StoryboardPricingOperation = typeof STORYBOARD_SOURCE | typeof STORYBOARD_EDIT_SOURCE;

export type StoryboardPricingProjection = {
  facts: PricingFacts;
  membershipTier: 'member' | 'plus' | 'pro';
  discountPercent: number;
  resolution: string;
  base: PricingSnapshot['base'];
  addons: PricingSnapshot['addons'];
  meta: Record<string, unknown>;
};

function normalizeStoryboardMembershipTier(value: string | null | undefined): 'member' | 'plus' | 'pro' {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'plus' || normalized === 'pro' ? normalized : 'member';
}

export function buildStoryboardPricingProjection(input: {
  snapshot: PricingSnapshot;
  operation: StoryboardPricingOperation;
  tier?: StoryboardTier;
}): StoryboardPricingProjection {
  const { snapshot, operation } = input;
  const isEdit = operation === STORYBOARD_EDIT_SOURCE;
  const membershipTier = normalizeStoryboardMembershipTier(
    snapshot.membershipTier ?? snapshot.discount?.tier
  );
  const resolution = input.tier ?? 'default';
  const operationMeta: Record<string, unknown> = isEdit
    ? {
        pricing_model: 'storyboarder_edit_x2',
        source: STORYBOARD_EDIT_SOURCE,
        engineId: STORYBOARD_BILLING_ENGINE_ID,
        engineLabel: STORYBOARD_BILLING_LABEL,
        billingEngineId: STORYBOARD_BILLING_ENGINE_ID,
        billingEngineLabel: STORYBOARD_BILLING_LABEL,
        billingProductLabel: STORYBOARD_EDIT_BILLING_LABEL,
        storyboard_edit_multiplier: STORYBOARD_EDIT_PRICING_MULTIPLIER,
      }
    : {
        pricing_model: 'storyboarder_x3',
        source: STORYBOARD_SOURCE,
        engineId: STORYBOARD_BILLING_ENGINE_ID,
        engineLabel: STORYBOARD_BILLING_LABEL,
        billingEngineId: STORYBOARD_BILLING_ENGINE_ID,
        billingEngineLabel: STORYBOARD_BILLING_LABEL,
        billingProductLabel: STORYBOARD_BILLING_LABEL,
        storyboard_multiplier: STORYBOARD_PRICING_MULTIPLIER,
        storyboard_tier: input.tier ?? 'hd',
      };

  return {
    facts: {
      engineId: STORYBOARD_BILLING_ENGINE_ID,
      currency: snapshot.currency,
      vendorSubtotalExactCents: Math.max(0, snapshot.base.amountCents),
      unit: snapshot.base.unit ?? 'image',
      quantity: snapshot.base.seconds,
    },
    membershipTier,
    discountPercent: snapshot.discount?.percentApplied ?? 0,
    resolution,
    base: { ...snapshot.base },
    addons: snapshot.addons.map((addon) => ({ ...addon })),
    meta: {
      ...(snapshot.meta ?? {}),
      ...operationMeta,
    },
  };
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
  const combinedDiscountCents = sumCents(boardPricing.discount?.amountCents, firstFramePricing.discount?.amountCents);

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
    discount: combinedDiscountCents
      ? {
          ...(boardPricing.discount ?? firstFramePricing.discount),
          amountCents: combinedDiscountCents,
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
