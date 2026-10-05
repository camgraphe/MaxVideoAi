import {quoteCanonicalPricing} from '@maxvideoai/pricing';
import {STUDIO_ASSISTANCE_CREDIT_TARIFF,studioAssistanceTariff} from '@/lib/studio/assistance-contract';

/** One client message, including its tool loops/retries. The canonical kernel owns all retail math. */
export function quoteStudioAssistance(tariffBasisNanoUsd: number,tariffVersion=STUDIO_ASSISTANCE_CREDIT_TARIFF.version) {
  if (!Number.isSafeInteger(tariffBasisNanoUsd) || tariffBasisNanoUsd < 0) throw new Error('Invalid assistance tariff basis');
  const tariff=studioAssistanceTariff(tariffVersion);
  if(!tariff)throw new Error('Unknown assistance tariff');
  const id = tariff.version;
  return quoteCanonicalPricing({
    facts: {engineId: 'studio-assistance-sol',currency: 'USD',vendorSubtotalExactCents: tariffBasisNanoUsd / 10_000_000,unit: 'client_message',quantity: 1},
    scenario: {id,engineId: 'studio-assistance-sol',membershipTier: 'member',discountPercent: 0},
    policy: {source: 'versioned',matchedBy: 'engine',sourceRuleId: id,rule: {id,engineId: 'studio-assistance-sol',marginPercent: id===STUDIO_ASSISTANCE_CREDIT_TARIFF.version?1:2,marginFlatCents: 0,surchargeAudioPercent: 0,surchargeUpscalePercent: 0,currency: 'USD'}},
    compatibilityProfile: {id: 'studio-message-aggregate-v1',vendorSubtotalRounding: 'preserve',marginRounding: 'down',surchargeRounding: 'down',discountRounding: 'down',subtotalRounding: 'up',totalRounding: 'up'},
  });
}
