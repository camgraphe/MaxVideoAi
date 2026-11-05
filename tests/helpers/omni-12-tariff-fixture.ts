import type { ManualTariffCell } from '@maxvideoai/pricing';
import { collectSellableManualTariffCoverage } from '../../frontend/lib/pricing-audit/manual-tariff-coverage';
import { continuousInputTariffSelector } from '../../frontend/src/lib/pricing-manual-scenario';
import { omniContinuousTariffBounds } from '../../frontend/server/pricing/omni-continuous-tariff';

export const omniReleaseIdentity = { actorId: '11111111-1111-4111-8111-111111111111', candidateCommit: 'a'.repeat(40) };
export const omniSelectorKey = (selector: object) => JSON.stringify(Object.entries(selector).sort(([a], [b]) => a.localeCompare(b)));
export function omniPreviousTariffState() {
  const cells = new Map<string, ManualTariffCell>();
  for (const scenario of collectSellableManualTariffCoverage({ modelId: 'gemini-omni-flash' }).scenarios) {
    const continuous = continuousInputTariffSelector(scenario.selector);
    const selector = continuous ?? scenario.selector;
    const key = omniSelectorKey(selector);
    if (cells.has(key)) continue;
    const maxUnits = continuous ? omniContinuousTariffBounds(scenario.context, '1.1').maximum : 0;
    const t2vFive = { '360p': 23, '720p': 67, '1080p': 99, '4k': 198 };
    cells.set(key, {
      id: `omni-original-${cells.size}`, selector, currency: 'USD', source: 'database', version: 1,
      effectiveFrom: '2026-10-02T00:00:00.000Z',
      price: continuous ? { kind: 'unit_bands', divisor: 10000, maxUnits,
        terms: [{ unit: 'output_tokens', centsPerUnit: 17.5 }, { unit: 'input_tokens', centsPerUnit: 1.5 }],
        bands: [{ minUnits: 0, customerCents: 1000 }, { minUnits: maxUnits / 2, customerCents: 1201 }] }
        : { kind: 'fixed', customerCents: selector.mode === 't2v' && selector.durationSec === '5'
          ? t2vFive[selector.resolution as keyof typeof t2vFive] : 1001 + cells.size },
    });
  }
  return { status: 'loaded' as const, active: true, revision: 500, versionedCells: [] as ManualTariffCell[], databaseCells: [...cells.values()] };
}
