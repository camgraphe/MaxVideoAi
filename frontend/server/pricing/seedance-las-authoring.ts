import type { PricingContext } from '@/lib/pricing-context';
import { quoteSeedance25LasListCost, BYTEPLUS_LAS_LIST_PRICE_SOURCE } from '@/server/byteplus-las-tariff';
import { seedanceInputTariffPriceFromRate } from './seedance-input-tariff';

export const SEEDANCE_LAS_INITIALIZATION_POLICY = 'reviewed_2_5x_las_list' as const;
export const SEEDANCE_LAS_REVIEWED_POLICY = { id: SEEDANCE_LAS_INITIALIZATION_POLICY, customerMultiplier: 2.5,
  supplierSource: BYTEPLUS_LAS_LIST_PRICE_SOURCE, rounding: 'ceil_cent' } as const;

/** Reviewed initialization only. Runtime customer quotes evaluate persisted literals. */
export function prepareReviewedSeedanceLasPrice(context: PricingContext) {
  const cost = quoteSeedance25LasListCost({ resolution: context.resolution, outputDurationSec: context.durationSec,
    inputVideoDurationSec: context.inputVideoDurationSec });
  if (!cost) throw new Error('The reviewed LAS supplier scenario is unsupported.');
  return seedanceInputTariffPriceFromRate(context, cost.unitPriceUsdPerSecond * 100 * SEEDANCE_LAS_REVIEWED_POLICY.customerMultiplier);
}
