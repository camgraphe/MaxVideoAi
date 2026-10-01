import {
  BYTEPLUS_MODELARK_LIST_PRICE_SOURCE,
  getBytePlusVideoListRate,
  getPublishedPromotionAt,
  getSeedance15ListRate,
  getSeedance25StepListRate,
  quoteSeedreamListCost,
} from '@/server/byteplus-list-tariff';
import type { CanonicalPricingQuote, ManualTariffQuote } from '@maxvideoai/pricing';
import type { PricingAuditScenario } from '@/lib/pricing-audit/types';
import { computeSeedance2TokenQuote, isSeedance2TokenPricing } from '@/lib/seedance-2-pricing';
import { expectedBytePlusTokens } from '@/server/byteplus-accounting';
import type { EngineCaps } from '@/types/engines';
import type { PricingContext } from '@/lib/pricing-context';
import { resolveSeedreamProviderSize } from '@/lib/image/seedream';
import { catalogSupplierReference, type CatalogSupplierReference, type SupplierRateLine } from './catalog-supplier-reference';
import { publishedSupplierEstimate, type PublishedSupplierEstimate } from './published-supplier-tariffs';
import { signedBytePlusContractCost, type BytePlusContractTerms } from '@/server/byteplus-account-contract';
import { bytePlusNormalListCost } from '@/server/byteplus-normal-cost';

type CostEvidence = { amountUsd: number; source: string; confirmedAt: string; contract?: BytePlusContractTerms };
type CustomerQuoteSummary = {
  totalCents: number;
  currency: string;
  source: 'database' | 'versioned';
  ruleId: string;
  pricingMode: 'legacy_margin_rule' | 'manual_tariff';
};

/** The customer side is projected from the canonical quote, never the supplier subtotal. */
export function customerQuoteFromCanonical(quote: CanonicalPricingQuote | ManualTariffQuote): CustomerQuoteSummary {
  return {
    totalCents: quote.customerTotalCents,
    currency: quote.currency,
    source: quote.policyProvenance.source,
    ruleId: quote.policyProvenance.sourceRuleId,
    pricingMode: 'pricingMode' in quote && quote.pricingMode === 'manual_tariff'
      ? 'manual_tariff' : 'legacy_margin_rule',
  };
}

export type ProviderCostComparisonInput = {
  scenarioId: string;
  brandId: string;
  familyId?: string;
  engineId: string;
  executionProvider: string;
  accountContractRegion?: string;
  routeConfigured?: boolean | null;
  generationDisabledReason?: 'local_sandbox' | 'route_unavailable' | null;
  mediaType?: 'video' | 'image';
  workflowPairId?: string;
  mode: string;
  resolution: string;
  durationSec?: number;
  inputVideoDurationSec?: number;
  outputQuantity?: number;
  aspectRatio?: string;
  step: 'normal' | 'draft' | 'final';
  billingInputType?: 'no_video_input' | 'video_input';
  audio?: boolean;
  /** Estimated normal-task tokens, or already billable tokens when provider-reported. */
  videoTokens?: number | null;
  tokenEvidence?: 'scenario_estimate' | 'provider_reported' | null;
  outputPixels?: number[];
  inputImages?: number;
  confirmedEffectiveCost?: CostEvidence | null;
  observedInvoiceCost?: CostEvidence | null;
  catalogReference?: CatalogSupplierReference | null;
  publishedList?: PublishedSupplierEstimate | null;
  customerQuote: CustomerQuoteSummary | null;
};

/** Projects an audit scenario without treating its padded retail basis as supplier cost. */
export function providerComparisonInputFromScenario(input: {
  scenario: PricingAuditScenario;
  quote: CanonicalPricingQuote | ManualTariffQuote | null;
  engine: EngineCaps;
  brandId: string;
  familyId?: string;
  executionProvider: string;
  mediaType?: 'video' | 'image';
  context?: PricingContext;
}): ProviderCostComparisonInput {
  const { scenario, engine } = input;
  const mode = scenario.mode ?? 'unknown';
  const billingInputType = typeof input.context?.hasVideoInput === 'boolean'
    ? input.context.hasVideoInput ? 'video_input' as const : 'no_video_input' as const
    : mode === 'v2v' || mode === 'extend'
    ? 'video_input' as const
    : mode === 't2v' || mode === 'i2v'
      ? 'no_video_input' as const
      : undefined;
  const aspectRatio = typeof scenario.input.aspectRatio === 'string' ? scenario.input.aspectRatio : undefined;
  const schemaAspectRatio = engine.inputSchema?.optional?.find((field) => field.id === 'aspect_ratio')?.default;
  const seedance15AspectRatio = scenario.engineId === 'seedance-1-5-pro'
    ? aspectRatio ?? (typeof schemaAspectRatio === 'string' ? schemaAspectRatio : undefined)
    : undefined;
  const seedance15AudioDefault = scenario.engineId === 'seedance-1-5-pro'
    ? engine.inputSchema?.optional?.find((field) => field.id === 'generate_audio')?.default
    : undefined;
  let tokenEstimate: ReturnType<typeof computeSeedance2TokenQuote> | null = null;
  if (billingInputType && isSeedance2TokenPricing(engine.pricingDetails) && scenario.durationSec && scenario.resolution) {
    try {
      tokenEstimate = computeSeedance2TokenQuote({
        details: engine.pricingDetails,
        durationSec: scenario.durationSec,
        resolution: scenario.resolution,
        aspectRatio,
        billingInputType,
      });
    } catch {
      // Unsupported dimensions remain unavailable in the supplier column.
    }
  }
  const seedance15Tokens = scenario.engineId === 'seedance-1-5-pro'
    && scenario.durationSec
    && scenario.resolution
    && ['480p', '720p', '1080p'].includes(scenario.resolution)
    && seedance15AspectRatio
    && ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'].includes(seedance15AspectRatio)
      ? expectedBytePlusTokens({
        engine_id: scenario.engineId,
        duration_sec: scenario.durationSec,
        settings_snapshot: { core: { resolution: scenario.resolution, aspectRatio: seedance15AspectRatio } },
      })
      : null;
  const seedream = scenario.engineId === 'seedream' || scenario.engineId === 'seedream-5-0-pro';
  const quantity = Number(scenario.input.quantity ?? input.context?.durationSec ?? 1);
  const inputImages = input.context
    ? (input.context.inputImageCount ?? (mode === 'i2i' ? 1 : 0)) + (input.context.referenceImageCount ?? 0)
    : typeof scenario.input.referenceImageCount === 'number' ? scenario.input.referenceImageCount
      : mode === 't2i' ? 0 : undefined;
  const size = seedream ? resolveSeedreamProviderSize(scenario.resolution ?? '', aspectRatio) : '';
  const dimensions = /^(\d+)x(\d+)$/.exec(size);
  const outputPixels = dimensions && Number.isSafeInteger(quantity) && quantity > 0 && quantity <= 15
    ? Array.from({ length: quantity }, () => Number(dimensions[1]) * Number(dimensions[2])) : undefined;
  let catalogReference: CatalogSupplierReference | null = null;
  try { if (input.context) catalogReference = catalogSupplierReference(input.context); }
  catch { /* Unsupported or incomplete factual inputs have no supplier reference. */ }
  return {
    scenarioId: scenario.id,
    brandId: input.brandId,
    familyId: input.familyId,
    engineId: scenario.engineId,
    executionProvider: input.executionProvider,
    mediaType: input.mediaType ?? 'video',
    mode,
    resolution: scenario.resolution ?? 'unknown',
    durationSec: input.mediaType === 'image' ? undefined : scenario.durationSec,
    ...(input.context?.inputVideoDurationSec !== undefined ? { inputVideoDurationSec: input.context.inputVideoDurationSec } : {}),
    outputQuantity: input.mediaType === 'image' ? quantity : undefined,
    aspectRatio: tokenEstimate?.aspectRatio ?? seedance15AspectRatio ?? aspectRatio,
    step: input.context?.workflowStep ?? 'normal',
    billingInputType,
    audio: typeof scenario.input.audio === 'boolean'
      ? scenario.input.audio
      : seedance15AudioDefault === 'true' ? true : seedance15AudioDefault === 'false' ? false : undefined,
    videoTokens: tokenEstimate?.tokenCount ?? seedance15Tokens,
    tokenEvidence: tokenEstimate || seedance15Tokens ? 'scenario_estimate' : null,
    ...(seedream ? { outputPixels, inputImages } : {}),
    catalogReference,
    publishedList: input.context ? publishedSupplierEstimate(input.context, input.executionProvider) : null,
    customerQuote: input.quote ? customerQuoteFromCanonical(input.quote) : null,
  };
}

type UnavailableReason =
  | 'supplier_rate_unverified_for_route'
  | 'billable_tokens_unavailable'
  | 'image_usage_unavailable'
  | 'unsupported_model_options';

export type ProviderCostComparisonRow = {
  scenarioId: string;
  brandId: string;
  familyId?: string;
  engineId: string;
  executionProvider: string;
  routeConfigured: boolean | null;
  generationDisabledReason?: 'local_sandbox' | 'route_unavailable' | null;
  mediaType: 'video' | 'image';
  workflowPairId: string | null;
  mode: string;
  resolution: string;
  step: ProviderCostComparisonInput['step'];
  durationSec: number | null;
  inputVideoDurationSec?: number | null;
  outputQuantity: number | null;
  aspectRatio: string | null;
  billingInputType: NonNullable<ProviderCostComparisonInput['billingInputType']> | null;
  audio: boolean | null;
  videoTokens: number | null;
  tokenEvidence: NonNullable<ProviderCostComparisonInput['tokenEvidence']> | null;
  outputPixels: number[] | null;
  inputImages: number | null;
  supplierList: {
    status: 'published_list_estimate' | 'published_list_from_usage' | 'catalog_reference_estimate' | 'unavailable';
    amountUsd: number | null;
    unitPriceUsdPer1kTokens: number | null;
    sourceUrl: string | null;
    checkedAt: string | null;
    reason: UnavailableReason | null;
    sourceLabel?: string;
    referenceProvider?: string;
    routeMatches?: boolean;
    versionedAt?: string | null;
    rateBreakdown?: SupplierRateLine[];
  };
  publicPromotion: {
    amountUsd: number | null;
    unitPriceUsdPer1kTokens: number;
    startsAt: string;
    endsAt: string;
  } | null;
  supplierEffective: { status: 'confirmed' | 'account_contract_unconfirmed' | 'unavailable'; amountUsd: number | null; source: string | null; confirmedAt: string | null; contract?: BytePlusContractTerms };
  supplierObserved: { status: 'invoice_observed' | 'unavailable'; amountUsd: number | null; source: string | null; observedAt: string | null };
  customerQuote: ProviderCostComparisonInput['customerQuote'];
  indicativeDifferenceVsListCents: number | null;
  realizedGrossDifferenceCents: number | null;
};

const VIDEO_PROFILES = {
  'seedance-2-0': 'standard',
  'seedance-2-0-fast': 'fast',
  'seedance-2-0-mini': 'mini',
  'seedance-2-5': 'seedance25',
} as const;

function amountUsd(tokens: number, rateUsdPer1kTokens: number): number {
  return Number(((tokens * rateUsdPer1kTokens) / 1000).toFixed(6));
}

function validEvidence(value: CostEvidence | null | undefined, at: string): value is CostEvidence {
  return Boolean(value && Number.isFinite(value.amountUsd) && value.amountUsd >= 0 && value.source.trim() &&
    Number.isFinite(Date.parse(value.confirmedAt)) && Date.parse(value.confirmedAt) <= Date.parse(at));
}

function listCost(input: ProviderCostComparisonInput, at: string): Pick<ProviderCostComparisonRow, 'supplierList' | 'publicPromotion'> {
  const unavailable = (reason: UnavailableReason): Pick<ProviderCostComparisonRow, 'supplierList' | 'publicPromotion'> => ({
    supplierList: { status: 'unavailable', amountUsd: null, unitPriceUsdPer1kTokens: null,
      sourceUrl: null, checkedAt: null, reason },
    publicPromotion: null,
  });
  if (input.executionProvider !== 'byteplus_modelark') {
    const published = input.publishedList;
    if (published && published.referenceProvider === input.executionProvider &&
      Number.isFinite(published.amountUsd) && published.amountUsd >= 0 &&
      Number.isFinite(Date.parse(published.checkedAt)) && Date.parse(published.checkedAt) <= Date.parse(at)) {
      return { supplierList: { ...published, status: 'published_list_estimate',
        unitPriceUsdPer1kTokens: null, reason: null, routeMatches: true }, publicPromotion: null };
    }
    const reference = input.catalogReference;
    if (!reference || !Number.isFinite(reference.amountUsd) || reference.amountUsd < 0) {
      return unavailable('supplier_rate_unverified_for_route');
    }
    return { supplierList: { status: 'catalog_reference_estimate', ...reference,
      unitPriceUsdPer1kTokens: null, checkedAt: null, reason: null,
      routeMatches: input.executionProvider === reference.referenceProvider }, publicPromotion: null };
  }

  if (input.step === 'normal' && input.engineId !== 'seedance-1-5-pro') {
    const image = input.engineId === 'seedream' || input.engineId === 'seedream-5-0-pro';
    const estimate = image || input.tokenEvidence ? bytePlusNormalListCost(input) : null;
    if (estimate) {
      const rate = VIDEO_PROFILES[input.engineId as keyof typeof VIDEO_PROFILES];
      const promotion = rate && input.billingInputType ? getPublishedPromotionAt(getBytePlusVideoListRate({
        profile: rate, resolution: input.resolution, billingInputType: input.billingInputType,
      }), at) : null;
      return { supplierList: { status: input.tokenEvidence === 'provider_reported'
        ? 'published_list_from_usage' : 'published_list_estimate', ...estimate, reason: null },
      publicPromotion: promotion && input.videoTokens ? { amountUsd: amountUsd(input.videoTokens, promotion.unitPriceUsdPer1kTokens),
        unitPriceUsdPer1kTokens: promotion.unitPriceUsdPer1kTokens, startsAt: promotion.startsAt, endsAt: promotion.endsAt } : null };
    }
  }

  if (input.engineId === 'seedream' || input.engineId === 'seedream-5-0-pro') {
    if (input.step !== 'normal' || !input.outputPixels?.length || input.inputImages == null) {
      return unavailable('image_usage_unavailable');
    }
    try {
      const estimate = quoteSeedreamListCost({
        model: input.engineId === 'seedream' ? 'lite' : 'pro',
        outputPixels: input.outputPixels,
        inputImages: input.inputImages,
      });
      return {
        supplierList: { status: 'published_list_estimate', amountUsd: estimate.totalUsd,
          unitPriceUsdPer1kTokens: null, sourceUrl: estimate.source.url, checkedAt: estimate.source.checkedAt,
          reason: null },
        publicPromotion: null,
      };
    } catch {
      return unavailable('image_usage_unavailable');
    }
  }

  if (!Number.isFinite(input.videoTokens) || !input.videoTokens || input.videoTokens < 0 ||
      !input.tokenEvidence || !input.billingInputType) {
    return unavailable('billable_tokens_unavailable');
  }
  const tokens = input.videoTokens;
  const status = input.tokenEvidence === 'provider_reported'
    ? 'published_list_from_usage' as const
    : 'published_list_estimate' as const;
  try {
    if (input.engineId === 'seedance-1-5-pro') {
      if (input.audio == null || (input.step === 'draft' && input.resolution !== '480p')) {
        return unavailable('unsupported_model_options');
      }
      const rate = getSeedance15ListRate({ audio: input.audio, step: input.step });
      const billedTokens = input.tokenEvidence === 'provider_reported' ? tokens : tokens * rate.tokenMultiplier;
      return {
        supplierList: { status, amountUsd: amountUsd(billedTokens, rate.unitPriceUsdPer1kTokens),
          unitPriceUsdPer1kTokens: rate.unitPriceUsdPer1kTokens,
          sourceUrl: BYTEPLUS_MODELARK_LIST_PRICE_SOURCE.url,
          checkedAt: BYTEPLUS_MODELARK_LIST_PRICE_SOURCE.checkedAt, reason: null },
        publicPromotion: null,
      };
    }
    const profile = VIDEO_PROFILES[input.engineId as keyof typeof VIDEO_PROFILES];
    if (!profile || (input.engineId !== 'seedance-2-5' && input.step !== 'normal')) {
      return unavailable('unsupported_model_options');
    }
    const rate = input.engineId === 'seedance-2-5' && input.step !== 'normal'
      ? getSeedance25StepListRate({ step: input.step, billingInputType: input.billingInputType })
      : getBytePlusVideoListRate({ profile, resolution: input.resolution, billingInputType: input.billingInputType });
    if ('resolution' in rate && rate.resolution !== input.resolution) return unavailable('unsupported_model_options');
    const promotion = getPublishedPromotionAt(rate, at);
    return {
      supplierList: { status, amountUsd: amountUsd(tokens, rate.unitPriceUsdPer1kTokens),
        unitPriceUsdPer1kTokens: rate.unitPriceUsdPer1kTokens,
        sourceUrl: rate.source.url, checkedAt: rate.source.checkedAt, reason: null },
      publicPromotion: promotion ? { amountUsd: amountUsd(tokens, promotion.unitPriceUsdPer1kTokens),
        unitPriceUsdPer1kTokens: promotion.unitPriceUsdPer1kTokens,
        startsAt: promotion.startsAt, endsAt: promotion.endsAt } : null,
    };
  } catch {
    return unavailable('unsupported_model_options');
  }
}

function differenceCents(customerCents: number, costUsd: number): number {
  return Number((customerCents - costUsd * 100).toFixed(6));
}

export function buildProviderCostComparisonRows(
  inputs: readonly ProviderCostComparisonInput[], at: string,
): ProviderCostComparisonRow[] {
  if (!Number.isFinite(Date.parse(at))) throw new Error('Invalid provider comparison date.');
  return inputs.map((input) => {
    const priced = listCost(input, at);
    const { publicPromotion } = priced;
    const supplierList = priced.supplierList;
    if (input.executionProvider === 'byteplus_modelark' && supplierList.status.startsWith('published_list')) {
      supplierList.sourceLabel = 'BytePlus ModelArk published LIST';
      supplierList.referenceProvider = 'byteplus_modelark';
      supplierList.routeMatches = true;
      if (supplierList.unitPriceUsdPer1kTokens != null && supplierList.amountUsd != null) {
        const rate = supplierList.unitPriceUsdPer1kTokens;
        supplierList.rateBreakdown = [{ label: 'Billable video tokens', unit: '1000_tokens',
          quantity: supplierList.amountUsd / rate, unitPriceUsd: rate, amountUsd: supplierList.amountUsd }];
      } else if (supplierList.amountUsd != null && input.outputPixels?.length && input.inputImages != null) {
        const estimate = quoteSeedreamListCost({ model: input.engineId === 'seedream' ? 'lite' : 'pro',
          outputPixels: input.outputPixels, inputImages: input.inputImages });
        supplierList.rateBreakdown = [{ label: 'Generated images and reference charges', unit: 'task',
          quantity: 1, unitPriceUsd: estimate.totalUsd, amountUsd: estimate.totalUsd }];
      }
    }
    const effective = validEvidence(input.confirmedEffectiveCost, at) ? input.confirmedEffectiveCost
      : signedBytePlusContractCost(input, supplierList, at);
    const observed = validEvidence(input.observedInvoiceCost, at) ? input.observedInvoiceCost : null;
    const sameCurrency = input.customerQuote?.currency.toUpperCase() === 'USD';
    return {
      scenarioId: input.scenarioId,
      brandId: input.brandId,
      familyId: input.familyId,
      engineId: input.engineId,
      executionProvider: input.executionProvider,
      routeConfigured: input.routeConfigured ?? null,
      generationDisabledReason: input.generationDisabledReason ?? null,
      mediaType: input.mediaType ?? 'video',
      workflowPairId: input.workflowPairId ?? null,
      mode: input.mode,
      resolution: input.resolution,
      step: input.step,
      durationSec: input.durationSec ?? null,
      ...(input.inputVideoDurationSec !== undefined ? { inputVideoDurationSec: input.inputVideoDurationSec } : {}),
      outputQuantity: input.outputQuantity ?? null,
      aspectRatio: input.aspectRatio ?? null,
      billingInputType: input.billingInputType ?? null,
      audio: input.audio ?? null,
      videoTokens: input.videoTokens ?? null,
      tokenEvidence: input.tokenEvidence ?? null,
      outputPixels: input.outputPixels ?? null,
      inputImages: input.inputImages ?? null,
      supplierList,
      publicPromotion,
      supplierEffective: effective
        ? { status: 'confirmed', amountUsd: effective.amountUsd, source: effective.source, confirmedAt: effective.confirmedAt,
          ...(effective.contract ? { contract: effective.contract } : {}) }
        : { status: input.executionProvider === 'byteplus_modelark' ? 'account_contract_unconfirmed' : 'unavailable',
          amountUsd: null, source: null, confirmedAt: null },
      supplierObserved: observed
        ? { status: 'invoice_observed', amountUsd: observed.amountUsd,
          source: observed.source, observedAt: observed.confirmedAt }
        : { status: 'unavailable', amountUsd: null, source: null, observedAt: null },
      customerQuote: input.customerQuote,
      indicativeDifferenceVsListCents: sameCurrency && supplierList.amountUsd != null
        ? differenceCents(input.customerQuote!.totalCents, supplierList.amountUsd)
        : null,
      realizedGrossDifferenceCents: sameCurrency && observed
        ? differenceCents(input.customerQuote!.totalCents, observed.amountUsd)
        : null,
    };
  });
}
