import type { EngineCaps, EnginePricingDetails } from '@/types/engines';
import type { PricingEngineDefinition, PricingSnapshot } from '@maxvideoai/pricing';
import { computePricingSnapshot as computeKernelSnapshot } from '@maxvideoai/pricing';
import { getPricingKernel } from '@/lib/pricing-kernel';
import { getPricingDetails } from '@/lib/fal-catalog';
import { getMembershipDiscountMap } from '@/lib/membership';
import { isSeedance2TokenPricing } from '@/lib/seedance-2-pricing';
import type { LumaRay2EditWorkflow } from '@/lib/luma-ray2-pricing';
import {
  getLumaRay2DurationInfo,
  getLumaRay2ResolutionInfo,
  isLumaRay2EditMode,
  isLumaRay2EngineId,
  isLumaRay2GenerateMode,
  normaliseLumaRay2Loop,
  LUMA_RAY2_ERROR_UNSUPPORTED,
} from '@/lib/luma-ray2';
import type { Mode } from '@/types/engines';
import type { GptImage2ImageSize } from '@/lib/image/gptImage2';
import { loadPricingRules, selectPricingRuleForBilling } from '@/lib/pricing-rule-store';
import {
  buildDefinitionFromEngine,
  buildGptImage2Snapshot,
  buildLumaRay2EditSnapshot,
  buildLumaRay2Snapshot,
  buildSeedance2Snapshot,
  getLumaRay2BasePriceEnv,
  getLumaRay2EditRateEnv,
} from '@/lib/pricing-specialized-snapshots';

export type { RawPricingRule, PricingRule, UpsertPricingRuleInput } from '@/lib/pricing-rule-store';
export {
  deletePricingRule,
  generatePricingRuleId,
  invalidatePricingRulesCache,
  listPricingRules,
  upsertPricingRule,
} from '@/lib/pricing-rule-store';

export type PricingContext = {
  engine: EngineCaps;
  durationSec: number;
  resolution: string;
  aspectRatio?: string | null;
  quality?: string | null;
  customImageSize?: GptImage2ImageSize | null;
  mode?: Mode;
  membershipTier?: string | null;
  currency?: string;
  loop?: boolean;
  durationOption?: number | string | null;
  addons?: Record<string, boolean | number | undefined>;
};

export async function computePricingSnapshot(context: PricingContext): Promise<PricingSnapshot> {
  const { engine, durationSec, resolution } = context;
  const lumaMode = context.mode ?? 't2v';
  const pricingDetails: EnginePricingDetails | undefined =
    engine.pricingDetails ?? (await getPricingDetails(engine.id));
  const rules = await loadPricingRules();
  const rule = selectPricingRuleForBilling(rules, engine.id, resolution);
  const vendorAccountId = rule.vendorAccountId ?? engine.vendorAccountId;
  const membershipDiscounts = await getMembershipDiscountMap();
  const memberTierDiscounts: PricingEngineDefinition['memberTierDiscounts'] = {
    member: 0,
    plus: 0.05,
    pro: 0.1,
  };
  (Object.keys(memberTierDiscounts) as Array<keyof PricingEngineDefinition['memberTierDiscounts']>).forEach((key) => {
    const override = membershipDiscounts[key];
    if (typeof override === 'number' && Number.isFinite(override)) {
      memberTierDiscounts[key] = Math.max(0, override);
    }
  });

  const memberTier = (context.membershipTier ?? 'member').toLowerCase() as 'member' | 'plus' | 'pro';
  let snapshot: PricingSnapshot;

  if (isLumaRay2EngineId(engine.id) && isLumaRay2GenerateMode(lumaMode)) {
    const baseRaw = getLumaRay2BasePriceEnv(engine.id);
    const baseUsd = Number(baseRaw);
    if (!Number.isFinite(baseUsd) || baseUsd <= 0) {
      throw new Error(
        engine.id === 'lumaRay2_flash'
          ? 'LUMARAY2_FLASH_BASE_5S_540P_USD or LUMARAY2_BASE_5S_540P_USD must be a positive number'
          : 'LUMARAY2_BASE_5S_540P_USD must be a positive number'
      );
    }

    const durationInfo = getLumaRay2DurationInfo(context.durationOption ?? durationSec);
    if (!durationInfo) {
      throw new Error(LUMA_RAY2_ERROR_UNSUPPORTED);
    }
    const resolutionInfo = getLumaRay2ResolutionInfo(resolution);
    if (!resolutionInfo) {
      throw new Error(LUMA_RAY2_ERROR_UNSUPPORTED);
    }

    const loop = normaliseLumaRay2Loop(context.loop);
    const currency = (context.currency ?? rule.currency ?? pricingDetails?.currency ?? engine.pricing?.currency ?? 'USD').toUpperCase();

    snapshot = buildLumaRay2Snapshot({
      engineId: engine.id === 'lumaRay2_flash' ? 'luma-ray2-flash' : 'luma-ray2',
      baseUsd,
      duration: durationInfo.label,
      resolution: resolutionInfo.value,
      loop,
      rule,
      memberTier,
      memberTierDiscounts,
      currency,
      vendorAccountId,
    });
    snapshot.base.seconds = durationInfo.seconds;
  } else if (isLumaRay2EngineId(engine.id) && isLumaRay2EditMode(lumaMode)) {
    const workflow: LumaRay2EditWorkflow = lumaMode === 'reframe' ? 'reframe' : 'modify';
    const rateRaw = getLumaRay2EditRateEnv(engine.id, workflow);
    const rateUsd = Number(rateRaw);
    if (!Number.isFinite(rateUsd) || rateUsd <= 0) {
      throw new Error(
        workflow === 'modify'
          ? engine.id === 'lumaRay2_flash'
            ? 'LUMARAY2_FLASH_MODIFY_PER_SECOND_USD or LUMARAY2_MODIFY_PER_SECOND_USD must be a positive number'
            : 'LUMARAY2_MODIFY_PER_SECOND_USD must be a positive number'
          : engine.id === 'lumaRay2_flash'
            ? 'LUMARAY2_FLASH_REFRAME_PER_SECOND_USD or LUMARAY2_REFRAME_PER_SECOND_USD must be a positive number'
            : 'LUMARAY2_REFRAME_PER_SECOND_USD must be a positive number'
      );
    }

    const currency = (context.currency ?? rule.currency ?? pricingDetails?.currency ?? engine.pricing?.currency ?? 'USD').toUpperCase();
    snapshot = buildLumaRay2EditSnapshot({
      engineId: engine.id === 'lumaRay2_flash' ? 'luma-ray2-flash' : 'luma-ray2',
      workflow,
      durationSec,
      rateUsd,
      rule,
      memberTier,
      memberTierDiscounts,
      currency,
      vendorAccountId,
    });
  } else if (engine.id === 'gpt-image-2') {
    const currency = (context.currency ?? rule.currency ?? pricingDetails?.currency ?? engine.pricing?.currency ?? 'USD').toUpperCase();
    snapshot = buildGptImage2Snapshot({
      numImages: durationSec,
      imageSize: resolution,
      customImageSize: context.customImageSize,
      quality: context.quality,
      rule,
      memberTier,
      memberTierDiscounts,
      currency,
      vendorAccountId,
    });
  } else if (isSeedance2TokenPricing(pricingDetails)) {
    const currency = (context.currency ?? rule.currency ?? pricingDetails.currency ?? engine.pricing?.currency ?? 'USD').toUpperCase();
    snapshot = buildSeedance2Snapshot({
      pricingDetails,
      durationSec,
      resolution,
      aspectRatio: context.aspectRatio,
      rule,
      memberTier,
      memberTierDiscounts,
      currency,
      vendorAccountId,
    });
  } else {
    let definition: PricingEngineDefinition | null = null;
    if (pricingDetails || engine.pricing) {
      definition = buildDefinitionFromEngine(engine, pricingDetails);
    }

    if (!definition) {
      const kernel = getPricingKernel();
      const fallback = kernel.getDefinition(engine.id);
      if (!fallback) {
        throw new Error(`Pricing definition not found for engine ${engine.id}`);
      }
      definition = fallback;
    }

    if (
      !definition.resolutionMultipliers[resolution] &&
      pricingDetails?.perSecondCents?.byResolution?.[resolution]
    ) {
      const perSecond = pricingDetails.perSecondCents.byResolution[resolution];
      if (typeof perSecond === 'number' && definition.baseUnitPriceCents > 0) {
        definition = {
          ...definition,
          resolutionMultipliers: {
            ...definition.resolutionMultipliers,
            [resolution]: perSecond / definition.baseUnitPriceCents,
          },
        };
      }
    }

    (Object.keys(memberTierDiscounts) as Array<keyof PricingEngineDefinition['memberTierDiscounts']>).forEach((key) => {
      const override = membershipDiscounts[key];
      if (typeof override === 'number' && Number.isFinite(override)) {
        memberTierDiscounts[key] = Math.max(0, override);
        return;
      }
      const definitionValue = definition.memberTierDiscounts[key];
      if (typeof definitionValue === 'number' && Number.isFinite(definitionValue)) {
        memberTierDiscounts[key] = Math.max(0, definitionValue);
      }
    });

    const augmentedDefinition: PricingEngineDefinition = {
      ...definition,
      currency: context.currency ?? definition.currency,
      platformFeePct: rule.marginPercent,
      platformFeeFlatCents: rule.marginFlatCents,
      memberTierDiscounts,
      metadata: {
        ...(definition.metadata ?? {}),
        ruleId: rule.id,
        vendorAccountId,
      },
    };

    const kernelInput = {
      engineId: engine.id,
      durationSec,
      resolution,
      memberTier,
      ...(context.addons ? { addons: context.addons } : {}),
    } as const;

    const { quote } = computeKernelSnapshot(augmentedDefinition, kernelInput);
    snapshot = quote.snapshot;
  }

  snapshot.margin = {
    ...snapshot.margin,
    ruleId: rule.id,
  };
  snapshot.membershipTier = memberTier;
  snapshot.vendorAccountId = vendorAccountId;
  const existingMeta = snapshot.meta ?? {};
  snapshot.meta = {
    ...existingMeta,
    ruleId: rule.id,
    engineLabel: engine.label,
    engineVersion: engine.version,
    ruleCurrency: rule.currency,
    membershipDiscounts: memberTierDiscounts,
  };
  return snapshot;
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
  const platformFee = getPlatformFeeCents(snapshot);
  return Math.max(0, snapshot.totalCents - platformFee);
}
