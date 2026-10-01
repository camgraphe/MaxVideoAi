import type { PricingContext } from '@/lib/pricing-context';
import { isSeedance2TokenPricing } from '@/lib/seedance-2-pricing';
import { resolveSeedreamProviderSize } from '@/lib/image/seedream';
import { ENV } from '@/lib/env';
import { resolveBytePlusSeedanceRouteProfile } from '@/server/video-providers/byteplus-modelark-profile-policy';
import { getBytePlusVideoListRate, quoteSeedreamListCost } from './byteplus-list-tariff';
import { signedBytePlusContractCost } from './byteplus-account-contract';
import { estimateBytePlusBillableTokens } from './byteplus-accounting';

type NormalUsage = {
  engineId: string;
  resolution: string;
  billingInputType?: 'no_video_input' | 'video_input';
  videoTokens?: number | null;
  outputPixels?: number[];
  inputImages?: number;
};
const VIDEO_PROFILES = { 'seedance-2-0': 'standard', 'seedance-2-0-fast': 'fast',
  'seedance-2-0-mini': 'mini', 'seedance-2-5': 'seedance25' } as const;

/** The same dated normal-task LIST estimate serves admin comparison and manual settlement. */
export function bytePlusNormalListCost(usage: NormalUsage) {
  try {
    if (usage.engineId === 'seedream' || usage.engineId === 'seedream-5-0-pro') {
      if (!usage.outputPixels?.length || usage.inputImages == null) return null;
      const list = quoteSeedreamListCost({ model: usage.engineId === 'seedream' ? 'lite' : 'pro',
        outputPixels: usage.outputPixels, inputImages: usage.inputImages });
      return { amountUsd: list.totalUsd, unitPriceUsdPer1kTokens: null,
        sourceUrl: list.source.url, checkedAt: list.source.checkedAt };
    }
    const profile = VIDEO_PROFILES[usage.engineId as keyof typeof VIDEO_PROFILES];
    if (!profile || !usage.billingInputType || !Number.isFinite(usage.videoTokens) || !usage.videoTokens || usage.videoTokens < 0) return null;
    const rate = getBytePlusVideoListRate({ profile, resolution: usage.resolution, billingInputType: usage.billingInputType });
    return { amountUsd: Number((usage.videoTokens * rate.unitPriceUsdPer1kTokens / 1000).toFixed(6)),
      unitPriceUsdPer1kTokens: rate.unitPriceUsdPer1kTokens, sourceUrl: rate.source.url, checkedAt: rate.source.checkedAt };
  } catch { return null; }
}

/** Factual cost only: never derive a customer tariff from the supplier discount. */
export function normalBytePlusSupplierCost(context: PricingContext, at: string) {
  const { engine, resolution, mode } = context;
  const declared = engine.providerMeta?.provider;
  const image = engine.id === 'seedream' || engine.id === 'seedream-5-0-pro';
  if (image ? declared !== 'byteplus_modelark' : !resolveBytePlusSeedanceRouteProfile(engine.id, declared)) return null;
  const usage: NormalUsage = { engineId: engine.id, resolution };
  if (image) {
    const quantity = context.durationSec;
    const dimensions = /^(\d+)x(\d+)$/.exec(resolveSeedreamProviderSize(resolution, context.aspectRatio));
    if (!dimensions || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 15) return null;
    usage.outputPixels = Array.from({ length: quantity }, () => Number(dimensions[1]) * Number(dimensions[2]));
    usage.inputImages = (context.inputImageCount ?? (mode === 'i2i' ? 1 : 0)) + (context.referenceImageCount ?? 0);
  } else {
    if (!isSeedance2TokenPricing(engine.pricingDetails)) return null;
    usage.billingInputType = typeof context.hasVideoInput === 'boolean'
      ? context.hasVideoInput ? 'video_input' : 'no_video_input'
      : mode === 'v2v' || mode === 'extend' ? 'video_input'
      : mode === 't2v' || mode === 'i2v' ? 'no_video_input' : undefined;
    if (!usage.billingInputType) return null;
    usage.videoTokens = estimateBytePlusBillableTokens({ engineId: engine.id, resolution,
      durationSec: context.durationSec, aspectRatio: context.aspectRatio,
      billingInputType: usage.billingInputType, inputVideoDurationSec: context.inputVideoDurationSec })?.tokenCount;
  }
  const list = bytePlusNormalListCost(usage);
  if (!list) return null;
  const contract = signedBytePlusContractCost({ ...usage, executionProvider: 'byteplus_modelark',
    accountContractRegion: ENV.BYTEPLUS_ARK_REGION, step: context.workflowStep ?? 'normal' }, { ...list, status: 'published_list_estimate' }, at);
  return { amountUsd: contract?.amountUsd ?? list.amountUsd, listAmountUsd: list.amountUsd,
    kind: contract ? 'signed_contract_estimate' as const : 'published_list_estimate' as const,
    source: contract?.source ?? 'BytePlus ModelArk published LIST', sourceUrl: list.sourceUrl,
    checkedAt: list.checkedAt, contract: contract?.contract, usage };
}
