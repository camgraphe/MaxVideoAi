import type { ManualTariffPrice } from '@maxvideoai/pricing';
import type { ManualTariffCoverageScenario } from '@/lib/pricing-audit/manual-tariff-coverage';
import type { PricingPolicyOverrideLoadResult } from '@/lib/pricing-rule-store';
import type { PricingContext } from '@/lib/pricing-context';
import { ltx25AudioTariffBounds } from '@/lib/ltx25-audio-tariff';
import { compileLtx25AudioContinuousTariffPrice, validateLtx25AudioContinuousTariffDomain } from '@/server/pricing/ltx25-audio-continuous-tariff';
import { compileOmniContinuousTariffPrice, validateOmniContinuousTariffDomain } from '@/server/pricing/omni-continuous-tariff';
import { buildBillingPricingFacts } from '@/lib/pricing-billing-facts';
import { getVersionedPricingPolicy } from '@/lib/pricing-policy-defaults';
import { resolveServerBillingPolicy } from '@/server/pricing/resolve-pricing-policy';
import { compileWan3ContinuousTariffPrice } from '@/server/pricing/wan3-continuous-tariff';
import { validateWan3ContinuousTariffDomain } from '@/server/pricing/wan3-continuous-tariff-domain';
import { isOpenQuantityTariff, compileOpenQuantityTariffPrice, validateOpenQuantityTariffDomain } from './open-quantity-tariff';
import { supportsSeedanceInputTariff } from '@/lib/seedance-input-tariff';
import { seedanceInputTariffBasis, validateSeedanceInputTariffDomain } from './seedance-input-tariff';
import { validateMonotoneContinuousTariffDomain } from './continuous-tariff-domain';
import { buildManualTariffScenario, continuousInputTariffSelector } from '@/lib/pricing-manual-scenario';

export async function compileCurrentContinuousTariffPrice(scenario: ManualTariffCoverageScenario, rules: PricingPolicyOverrideLoadResult) {
  if (rules.status !== 'loaded') throw new Error('Effective pricing rules are unavailable');
  const { policy } = await resolveServerBillingPolicy({ engineId: scenario.modelId, mode: scenario.context.mode, resolution: scenario.context.resolution },
    null, { loadOverrides: async () => rules });
  const facts = buildBillingPricingFacts(scenario.context, scenario.context.engine.pricingDetails, 'USD');
  const profile = getVersionedPricingPolicy().compatibilityProfiles.find(p => p.id === (policy.rule.compatibilityProfile ?? facts.compatibilityProfileId));
  if (!profile) throw new Error('Current price rounding is unavailable');
  const compile = isOpenQuantityTariff(scenario.modelId, scenario.selector.mode) ? compileOpenQuantityTariffPrice
    : scenario.modelId === 'gemini-omni-flash' ? compileOmniContinuousTariffPrice
    : ltx25AudioTariffBounds(scenario.modelId, scenario.selector.mode) ? compileLtx25AudioContinuousTariffPrice : compileWan3ContinuousTariffPrice;
  return compile({ context: scenario.context, policy, compatibilityProfile: profile });
}


/** Migration and admin authoring share the same reviewed whole-domain guard. */
export function validateCurrentContinuousTariffDomain(input: { context: PricingContext; price: ManualTariffPrice }) {
  if (supportsSeedanceInputTariff(input.context.engine.id, input.context.mode ?? '', input.context.hasVideoInput ? 'video_input' : undefined)) {
    if (input.context.engine.providerMeta?.provider === 'fal') {
      const basis = seedanceInputTariffBasis(input.context);
      const facts = buildBillingPricingFacts(input.context, input.context.engine.pricingDetails, 'USD').facts;
      const selector = continuousInputTariffSelector(buildManualTariffScenario(input.context, facts).selector)!;
      return validateMonotoneContinuousTariffDomain({ price: input.price, selector, unit: 'input_video_seconds',
        minimum: Number.MIN_VALUE, maximum: basis.maximum, factsAt: () => facts });
    }
    return validateSeedanceInputTariffDomain(input);
  }
  return (isOpenQuantityTariff(input.context.engine.id, input.context.mode ?? '') ? validateOpenQuantityTariffDomain
    : input.context.engine.id === 'gemini-omni-flash' ? validateOmniContinuousTariffDomain
    : ltx25AudioTariffBounds(input.context.engine.id, input.context.mode ?? '')
    ? validateLtx25AudioContinuousTariffDomain : validateWan3ContinuousTariffDomain)(input);
}
