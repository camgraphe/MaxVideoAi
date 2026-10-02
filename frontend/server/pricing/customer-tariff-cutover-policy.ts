import type { ManualTariffCoverageScenario } from '@/lib/pricing-audit/manual-tariff-coverage';
import type { PricingPolicyOverrideLoadResult } from '@/lib/pricing-rule-store';
import type { CustomerTariffCutoverRelease } from './customer-tariff-cutover-evidence';
import { cutoverDigest } from './customer-tariff-cutover-evidence';
import { continuousInputTariffSelector } from '@/lib/pricing-manual-scenario';
import { supportsSeedanceInputTariff } from '@/lib/seedance-input-tariff';
import { buildBillingPricingFacts } from '@/lib/pricing-billing-facts';
import { compileCurrentContinuousTariffPrice } from './compile-current-continuous-tariff';
import { prepareReviewedSeedanceMigrationPrice } from './seedance-reviewed-migration';

const key = (selector: object) => JSON.stringify(Object.entries(selector).sort(([a],[b]) => a.localeCompare(b)));

/** Initial migration only. Reproduce complete literal curves from captured
 * baseline cents and the reviewed authoring owners; cost safety alone is not
 * price parity. Subsequent admin edits use their own explicit preview/approval. */
export async function assertReviewedCustomerTariffCutoverPolicy(input: {
  scenarios: readonly ManualTariffCoverageScenario[]; release: CustomerTariffCutoverRelease;
  policy: PricingPolicyOverrideLoadResult;
}) {
  const cells = new Map(input.release.cells.map(cell => [key(cell.selector),cell]));
  const checkpoints = new Map(input.release.checkpoints.map(row => [row.key,row]));
  const original = new Map(input.scenarios.map(s => [key(s.selector),checkpoints.get(`ordinary:${s.id}`)?.beforeCents ?? undefined]));
  const checkedCurves = new Set<string>();
  for (const scenario of input.scenarios) {
    const row = checkpoints.get(`ordinary:${scenario.id}`);
    if (!row || row.beforeCents === null) throw new Error('Original ordinary captured amount missing.');
    const selector = continuousInputTariffSelector(scenario.selector);
    if (selector) {
      const cell = cells.get(key(selector));
      if (!cell) throw new Error('Reviewed continuous curve missing.');
      if (!checkedCurves.has(cell.id)) {
        const seedance = supportsSeedanceInputTariff(scenario.modelId,scenario.selector.mode,scenario.selector.billingInputType);
        const expected = seedance ? prepareReviewedSeedanceMigrationPrice(scenario,row.beforeCents,
          s => original.get(key(s)),input.release.capturedAt).price : await compileCurrentContinuousTariffPrice(scenario,input.policy);
        if (cutoverDigest(cell.price) !== cutoverDigest(expected)) throw new Error('Continuous curve changed outside the reviewed baseline and margin policy.');
        checkedCurves.add(cell.id);
      }
      continue;
    }
    if (row.customerCents !== row.beforeCents) {
      const ceiling = Math.ceil(buildBillingPricingFacts(scenario.context,scenario.context.engine.pricingDetails,'USD').facts.vendorSubtotalExactCents - 1e-9);
      if (!['gpt-image-2-5-flare','gpt-image-2-5-sunburst'].includes(scenario.modelId)
        || scenario.selector.mode !== 'i2i' || !(scenario.context.referenceImageCount! > 0)
        || row.customerCents !== row.beforeCents + 1 || row.customerCents !== ceiling) {
        throw new Error('Approved GPT reference floor must reach the actual reference ceiling.');
      }
    }
  }
}
