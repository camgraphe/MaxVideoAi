import { createHash } from 'node:crypto';
import type { ManualTariffCell } from '@maxvideoai/pricing';
import type { EffectiveCustomerTariffBaseline, ManualTariffCoverageScenario } from '@/lib/pricing-audit/manual-tariff-coverage';

export function customerTariffCellId(scenarioId: string): string {
  return `customer:${createHash('sha256').update(scenarioId).digest('hex').slice(0, 32)}`;
}

/** Copies reviewed cents. This is a staged seed, never an activation certificate. */
export function buildCustomerTariffSeed(input: {
  baseline: EffectiveCustomerTariffBaseline;
  scenarios: readonly ManualTariffCoverageScenario[];
  registryHash: string;
  coverageGaps: readonly { modelId: string; reason: string }[];
}): { cells: ManualTariffCell[]; coverageGapCount: number; activationReady: false } {
  const { baseline } = input;
  if (baseline.registryHash !== input.registryHash || !baseline.databaseIdentity || !Number.isFinite(Date.parse(baseline.at))) {
    throw new Error('The reviewed baseline registry, database and capture date are required');
  }
  const quotes = new Map(baseline.rows.map((row) => [row.scenarioId, row]));
  if (quotes.size !== baseline.rows.length) throw new Error('Duplicate baseline quotes');
  if (!input.scenarios.length || baseline.gaps.length || quotes.size !== input.scenarios.length) {
    throw new Error('Incomplete baseline coverage');
  }
  const selectors = new Set<string>();
  const cells = input.scenarios.map((scenario): ManualTariffCell => {
    const key = JSON.stringify(Object.entries(scenario.selector).sort(([a], [b]) => a.localeCompare(b)));
    if (selectors.has(key)) throw new Error('Duplicate tariff selector');
    selectors.add(key);
    const row = quotes.get(scenario.id);
    if (!row) throw new Error('Incomplete baseline coverage');
    if (!Number.isSafeInteger(row.customerCents) || row.customerCents < 0 || !/^[A-Z]{3}$/.test(row.currency) ||
        row.policySource !== 'database' || !row.ruleId?.trim()) throw new Error('Invalid effective baseline amount or provenance');
    return { id: customerTariffCellId(scenario.id), source: 'database', version: 1,
      currency: row.currency, selector: scenario.selector, effectiveFrom: baseline.at,
      price: { kind: 'fixed', customerCents: row.customerCents } };
  });
  return { cells, coverageGapCount: input.coverageGaps.length, activationReady: false };
}
