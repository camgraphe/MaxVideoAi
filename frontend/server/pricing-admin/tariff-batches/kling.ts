import type { ManualTariffSelector } from '@maxvideoai/pricing';
import { klingV4TariffScenarios } from '@/lib/pricing-audit/kling-v4-tariff-scenario';
import { continuousInputTariffSelector } from '@/lib/pricing-manual-scenario';
import { klingV4PricingUsage, KLING_V4_PRICING_SOURCE } from '@/lib/kling-v4-pricing';
import { customerTariffCellId } from '@/server/pricing/customer-tariff-seed';
import { continuousInputTariffIdentity } from '../continuous-input-tariff';
import type { TariffBatchPrice } from './contract';
import { batchSelectorKey, decimalRatio } from './input';

export function klingBatchClasses() {
  const rows = klingV4TariffScenarios().map(scenario => {
    const continuous = continuousInputTariffSelector(scenario.selector);
    const selector: ManualTariffSelector = continuous ?? scenario.selector;
    return { selector, key: batchSelectorKey(selector), scenario,
      id: continuous ? continuousInputTariffIdentity(scenario).id : customerTariffCellId(scenario.id) };
  });
  // Preserve the shortest canonical example for a continuous class.
  const unique = new Map<string, (typeof rows)[number]>();
  for (const row of rows) if (!unique.has(row.key)) unique.set(row.key, row);
  return [...unique.values()].sort((a, b) => a.key.localeCompare(b.key));
}
export type KlingBatchClass = ReturnType<typeof klingBatchClasses>[number];

/** Authoring only: compile a frozen LIST recipe into literal fixed/unit prices. */
export function compileKlingBatchPrice(row: KlingBatchClass, multiplier: string): TariffBatchPrice {
  const usage = klingV4PricingUsage(row.scenario.context);
  const rate = decimalRatio(String(usage.centsPerSecond));
  const factor = decimalRatio(multiplier);
  const numerator = rate.numerator * factor.numerator;
  const denominator = rate.denominator * factor.denominator;
  if (row.selector.billingInputType === 'video_input') return { kind: 'unit_terms', rounding: 'up',
    terms: [{ unit: 'billable_seconds', centsPerUnit: Number(numerator) / Number(denominator) }] };
  const total = numerator * BigInt(row.selector.durationSec);
  return { kind: 'fixed', customerCents: Number((total + denominator - BigInt(1)) / denominator) };
}
export function klingBatchSourceFacts() {
  return { source: KLING_V4_PRICING_SOURCE, sourceDate: '2026-10-25', costKind: 'supplier_list',
    classes: klingBatchClasses().map(row => ({ selector: row.selector, usage: klingV4PricingUsage(row.scenario.context) })) };
}
