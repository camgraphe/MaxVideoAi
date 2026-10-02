import type { ManualTariffPrice, ManualTariffSelector } from '@maxvideoai/pricing';
import type { ManualTariffCoverageScenario } from '@/lib/pricing-audit/manual-tariff-coverage';
import { normalBytePlusSupplierCost } from '@/server/byteplus-normal-cost';
import { prepareSeedanceInputTariffPrice } from './seedance-input-tariff';

/** Explicitly approved initialization from captured cents, never a live percentage rule. */
export function prepareReviewedSeedanceMigrationPrice(scenario: ManualTariffCoverageScenario,
  currentCustomerCents: number, amount: (selector: ManualTariffSelector) => number | undefined, at: string) {
  if (scenario.context.engine.providerMeta?.provider === 'fal') {
    const price: ManualTariffPrice = { kind: 'unit_components', rounding: 'up', components: [{ id: 'retail', rounding: 'none',
      flatCents: currentCustomerCents, terms: [{ unit: 'input_video_seconds', centsPerUnit: 0 }] }] };
    return { price, minimumCustomerCents: currentCustomerCents, marginSource: 'other_route' as const };
  }
  const minimum = normalBytePlusSupplierCost({ ...scenario.context, inputVideoDurationSec: Number.MIN_VALUE }, at);
  if (!minimum) throw new Error('Current BytePlus supplier reference is required for reviewed migration.');
  const { inputVideoDurationSec: _, ...options } = scenario.selector;
  const noVideoCustomerCents = currentCustomerCents <= minimum.amountUsd * 100
    ? amount({ ...options, billingInputType: 'no_video_input' })
      ?? (['v2v', 'extend'].includes(options.mode) ? amount({ ...options, mode: 't2v', billingInputType: 'no_video_input' }) : undefined)
    : undefined;
  return prepareSeedanceInputTariffPrice({ context: scenario.context, currentCustomerCents, noVideoCustomerCents, at });
}
