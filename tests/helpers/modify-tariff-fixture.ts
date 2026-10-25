import type { ManualTariffCell } from '@maxvideoai/pricing';
import { tariffReaderActor } from './customer-tariff-reader-fixture';

export const modifyReleaseIdentity = { actorId: tariffReaderActor, candidateCommit: 'a'.repeat(40) };
export const modifyPolicy = { status: 'loaded' as const, rules: [], routingRules: [] };
export function modifyTariffFixture() {
  const cells: ManualTariffCell[] = [50, 66, 82, 99, 115, 132, 148, 164, 181, 197, 214, 229, 246]
    .map((customerCents, index) => ({ id: `kling-original-${index}`, source: 'database', version: 1, currency: 'USD',
      effectiveFrom: '2026-01-01T00:00:00.000Z', price: { kind: 'fixed', customerCents },
      selector: { engineId: 'kling-o3-standard', mode: 'v2v', resolution: '1080p', durationSec: String(index + 3) } }));
  for (const [resolution, amounts] of Object.entries({ '540p': [94, 188], '720p': [141, 281], '1080p': [281, 562] })) {
    for (const [index, customerCents] of amounts.entries()) cells.push({ id: `luma-original-${resolution}-${index}`,
      source: 'database', version: 1, currency: 'USD', effectiveFrom: '2026-01-01T00:00:00.000Z',
      price: { kind: 'fixed', customerCents },
      selector: { engineId: 'luma-ray-3-2', mode: 'v2v', resolution, durationSec: String(index ? 10 : 5) } });
  }
  return { status: 'loaded' as const, active: true, revision: 1749, versionedCells: [] as ManualTariffCell[], databaseCells: cells };
}
