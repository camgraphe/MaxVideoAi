import type { PricingSnapshot } from '@maxvideoai/pricing';
import { quoteCreatorProviderBillingSnapshot } from '@/server/pricing/quote-creator';
import { resolveServerBillingPolicy, type ResolveServerPricingPolicyDependencies } from '@/server/pricing/resolve-pricing-policy';

const ENGINE_ID = 'toolbox-subtitles';
const LIST_USD_PER_MINUTE = 0.008;

/** Reference list cost, not an assertion about the supplier's final account invoice. */
export async function quoteSubtitleTranscription(
  input: { durationSec: number; keyterms?: readonly string[] },
  dependencies: { pricingPolicy?: ResolveServerPricingPolicyDependencies } = {},
): Promise<PricingSnapshot> {
  if (!Number.isFinite(input.durationSec) || input.durationSec <= 0 || input.durationSec > 1800) {
    throw new Error('SUBTITLE_DURATION_INVALID');
  }
  const hasKeyterms = Boolean(input.keyterms?.length);
  const vendorUsd = input.durationSec / 60 * LIST_USD_PER_MINUTE * (hasKeyterms ? 1.3 : 1);
  const mode = hasKeyterms ? 'transcription-keyterms' : 'transcription';
  const { policy, vendorAccountId } = await resolveServerBillingPolicy(
    { engineId: ENGINE_ID, mode, resolution: 'audio' }, undefined, dependencies.pricingPolicy,
  );
  if (policy.rule.engineId !== ENGINE_ID || policy.rule.currency !== 'USD') throw new Error('TOOL_PRICING_UNAVAILABLE');
  return quoteCreatorProviderBillingSnapshot({
    toolId: 'subtitles',
    facts: { engineId: ENGINE_ID, currency: 'USD', vendorSubtotalExactCents: vendorUsd * 100, unit: 'audio', quantity: 1 },
    base: { seconds: input.durationSec, rate: LIST_USD_PER_MINUTE / 60, unit: 'audio', amountCents: vendorUsd * 100 },
    addons: [], vendorAccountId,
    meta: { surface: 'tool', toolId: 'subtitles', operation: 'transcription', providerCostKind: 'list-reference',
      providerCostSource: 'https://fal.ai/models/fal-ai/elevenlabs/speech-to-text/scribe-v2', providerCostCheckedAt: '2026-10-19',
      providerCostListUsd: vendorUsd, keytermsSurchargePercent: hasKeyterms ? 30 : 0, ruleId: policy.sourceRuleId },
  });
}
