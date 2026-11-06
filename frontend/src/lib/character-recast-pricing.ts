import type { PricingPolicyRule } from '@maxvideoai/pricing';

export const RECAST_PRODUCT_ID = 'character-recast' as const;
export const RECAST_PRICING_SELECTOR = { engineId: RECAST_PRODUCT_ID, mode: 'recast', resolution: 'video' } as const;

/** Recast has an explicit product rule; generic model/global policies cannot price it. */
export function isValidRecastPricingRule(rule: PricingPolicyRule): boolean {
  return rule.engineId === RECAST_PRICING_SELECTOR.engineId && rule.mode === RECAST_PRICING_SELECTOR.mode
    && rule.resolution === RECAST_PRICING_SELECTOR.resolution && rule.currency === 'USD'
    && (rule.compatibilityProfile == null || rule.compatibilityProfile === 'standard')
    && Number.isFinite(rule.marginPercent) && rule.marginPercent >= 0 && rule.marginPercent <= 9
    && rule.marginFlatCents === 0 && rule.surchargeAudioPercent === 0 && rule.surchargeUpscalePercent === 0;
}
