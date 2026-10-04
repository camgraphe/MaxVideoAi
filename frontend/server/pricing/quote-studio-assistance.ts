import {quoteCanonicalPricing} from '@maxvideoai/pricing';
import {STUDIO_ASSISTANCE_TARIFF} from '@/lib/studio/assistance-contract';

/** One client message, including its tool loops/retries. The canonical kernel owns all retail math. */
export function quoteStudioAssistance(tariffBasisNanoUsd: number) {
  if (!Number.isSafeInteger(tariffBasisNanoUsd) || tariffBasisNanoUsd < 0) throw new Error('Invalid assistance tariff basis');
  const id = STUDIO_ASSISTANCE_TARIFF.version;
  return quoteCanonicalPricing({
    facts: {engineId: 'studio-assistance-sol',currency: 'USD',vendorSubtotalExactCents: tariffBasisNanoUsd / 10_000_000,unit: 'client_message',quantity: 1},
    scenario: {id,engineId: 'studio-assistance-sol',membershipTier: 'member',discountPercent: 0},
    policy: {source: 'versioned',matchedBy: 'engine',sourceRuleId: id,rule: {id,engineId: 'studio-assistance-sol',marginPercent: 2,marginFlatCents: 0,surchargeAudioPercent: 0,surchargeUpscalePercent: 0,currency: 'USD'}},
    compatibilityProfile: {id: 'studio-message-aggregate-v1',vendorSubtotalRounding: 'preserve',marginRounding: 'down',surchargeRounding: 'down',discountRounding: 'down',subtotalRounding: 'up',totalRounding: 'up'},
  });
}
