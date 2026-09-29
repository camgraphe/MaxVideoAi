import { getFalEngineById } from '@/config/falEngines';
import { buildBillingPricingFacts } from '@/lib/pricing-billing-facts';
import type { PricingContext } from '@/lib/pricing-context';
import { isSeedance2TokenPricing } from '@/lib/seedance-2-pricing';

export type SupplierRateLine = {
  label: string;
  quantity: number;
  unit: 'second' | 'image' | '1000_tokens' | 'task';
  unitPriceUsd: number;
  amountUsd: number;
};

export type CatalogSupplierReference = {
  amountUsd: number;
  referenceProvider: string;
  sourceLabel: string;
  sourceUrl: string | null;
  versionedAt: string | null;
  rateBreakdown: SupplierRateLine[];
};

const precise = (value: number) => Number(value.toFixed(9));

/** Dated repository facts are a reference, never account/settlement evidence or freshly checked LIST. */
export function catalogSupplierReference(context: PricingContext): CatalogSupplierReference | null {
  const { engine } = context;
  // Seedance's historical padded retail basis is expressly NOT a provider rate.
  if (isSeedance2TokenPricing(engine.pricingDetails) || engine.id === 'seedance-1-5-pro'
    || engine.id === 'seedream' || engine.id === 'seedream-5-0-pro') return null;
  const entry = getFalEngineById(engine.id);
  if (!entry) return null;
  const endpoint = entry.modes.find((item) => item.mode === context.mode)?.falModelId;
  if (!endpoint) return null;
  const pricing = buildBillingPricingFacts(context, engine.pricingDetails, 'USD');
  const amountUsd = precise(pricing.facts.vendorSubtotalExactCents / 100);
  if (!Number.isFinite(amountUsd) || amountUsd < 0) return null;
  const source = typeof pricing.meta.provider_cost_source === 'string' ? pricing.meta.provider_cost_source
    : typeof pricing.meta.source === 'string' ? pricing.meta.source : 'versioned engine supplier rates';
  let referenceProvider = 'fal';
  let sourceUrl: string | null = `https://fal.ai/models/${endpoint}`;
  if (engine.providerMeta?.provider === 'google_vertex_image' || engine.id === 'gemini-omni-flash') {
    referenceProvider = engine.id === 'gemini-omni-flash' ? 'google_vertex_omni_direct' : 'google_vertex_image';
    sourceUrl = 'https://cloud.google.com/vertex-ai/generative-ai/pricing';
  } else if (engine.id === 'wan-3' || engine.id === 'wan-3-prime') {
    referenceProvider = 'alibaba_model_studio';
    sourceUrl = 'https://help.aliyun.com/en/model-studio/model-pricing';
  } else if (engine.id === 'minimax-h3-max') {
    referenceProvider = 'minimax';
    sourceUrl = null; // Documented local rate; no verified public endpoint URL in this projection.
  } else if (engine.providerMeta?.provider === 'luma_agents_direct') {
    referenceProvider = 'fal';
    sourceUrl = null; // Fal reference/interpolation, not a Luma account price.
  }
  const quantity = pricing.facts.quantity;
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  const addonUsd = pricing.addons.reduce((sum, addon) => sum + addon.amountCents / 100, 0);
  const baseUsd = precise(amountUsd - addonUsd);
  const unit = entry.category === 'image' ? 'image' : 'second';
  return {
    amountUsd, referenceProvider, sourceLabel: `${source} · repository reference`, sourceUrl,
    versionedAt: Number.isFinite(Date.parse(engine.updatedAt)) ? engine.updatedAt : null,
    rateBreakdown: [{ label: 'Base supplier reference', quantity, unit,
      unitPriceUsd: precise(baseUsd / quantity), amountUsd: baseUsd },
      ...pricing.addons.map((addon) => ({ label: addon.type, quantity: 1, unit: 'task' as const,
        unitPriceUsd: precise(addon.amountCents / 100), amountUsd: precise(addon.amountCents / 100) }))],
  };
}
