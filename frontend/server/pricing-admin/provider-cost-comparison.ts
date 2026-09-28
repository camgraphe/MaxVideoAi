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
import type { EngineCaps } from '@/types/engines';

type CostEvidence = { amountUsd: number; source: string; confirmedAt: string };
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
  engineId: string;
  executionProvider: string;
  mode: string;
  resolution: string;
  durationSec?: number;
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
  customerQuote: CustomerQuoteSummary | null;
};

/** Projects an audit scenario without treating its padded retail basis as supplier cost. */
export function providerComparisonInputFromScenario(input: {
  scenario: PricingAuditScenario;
  quote: CanonicalPricingQuote | ManualTariffQuote | null;
  engine: EngineCaps;
  brandId: string;
  executionProvider: string;
}): ProviderCostComparisonInput {
  const { scenario, engine } = input;
  const mode = scenario.mode ?? 'unknown';
  const billingInputType = mode === 'v2v' || mode === 'extend'
    ? 'video_input' as const
    : mode === 't2v' || mode === 'i2v'
      ? 'no_video_input' as const
      : undefined;
  const aspectRatio = typeof scenario.input.aspectRatio === 'string' ? scenario.input.aspectRatio : undefined;
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
  return {
    scenarioId: scenario.id,
    brandId: input.brandId,
    engineId: scenario.engineId,
    executionProvider: input.executionProvider,
    mode,
    resolution: scenario.resolution ?? 'unknown',
    durationSec: scenario.durationSec,
    aspectRatio: tokenEstimate?.aspectRatio ?? aspectRatio,
    step: 'normal',
    billingInputType,
    audio: typeof scenario.input.audio === 'boolean' ? scenario.input.audio : undefined,
    videoTokens: tokenEstimate?.tokenCount ?? null,
    tokenEvidence: tokenEstimate ? 'scenario_estimate' : null,
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
  engineId: string;
  executionProvider: string;
  mode: string;
  resolution: string;
  step: ProviderCostComparisonInput['step'];
  durationSec: number | null;
  aspectRatio: string | null;
  billingInputType: ProviderCostComparisonInput['billingInputType'] | null;
  audio: boolean | null;
  videoTokens: number | null;
  tokenEvidence: ProviderCostComparisonInput['tokenEvidence'] | null;
  outputPixels: number[] | null;
  inputImages: number | null;
  supplierList: {
    status: 'published_list_estimate' | 'published_list_from_usage' | 'unavailable';
    amountUsd: number | null;
    unitPriceUsdPer1kTokens: number | null;
    sourceUrl: string | null;
    checkedAt: string | null;
    reason: UnavailableReason | null;
  };
  publicPromotion: {
    amountUsd: number | null;
    unitPriceUsdPer1kTokens: number;
    startsAt: string;
    endsAt: string;
  } | null;
  supplierEffective: { status: 'confirmed' | 'account_contract_unconfirmed' | 'unavailable'; amountUsd: number | null; source: string | null; confirmedAt: string | null };
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
  if (input.executionProvider !== 'byteplus_modelark') return unavailable('supplier_rate_unverified_for_route');

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
    const { supplierList, publicPromotion } = listCost(input, at);
    const effective = validEvidence(input.confirmedEffectiveCost, at) ? input.confirmedEffectiveCost : null;
    const observed = validEvidence(input.observedInvoiceCost, at) ? input.observedInvoiceCost : null;
    const sameCurrency = input.customerQuote?.currency.toUpperCase() === 'USD';
    return {
      scenarioId: input.scenarioId,
      brandId: input.brandId,
      engineId: input.engineId,
      executionProvider: input.executionProvider,
      mode: input.mode,
      resolution: input.resolution,
      step: input.step,
      durationSec: input.durationSec ?? null,
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
        ? { status: 'confirmed', amountUsd: effective.amountUsd, source: effective.source, confirmedAt: effective.confirmedAt }
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
