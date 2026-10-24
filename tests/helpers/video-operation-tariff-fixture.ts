import type { ManualTariffCell } from '@maxvideoai/pricing';
export const operationPolicy = { status: 'loaded' as const, rules: [{ id: 'default', marginPercent: .3,
  marginFlatCents: 0, surchargeAudioPercent: 0, surchargeUpscalePercent: 0, currency: 'USD' }], routingRules: [] };
export const operationIdentity = { actorId: '11111111-1111-4111-8111-111111111111', candidateCommit: 'a'.repeat(40) };
export function operationTariffState() {
  const databaseCells: ManualTariffCell[] = [];
  for (const resolution of ['720p','1080p','4k']) for (const audio of ['false','true']) databaseCells.push({
    id: `veo-existing-${resolution}-${audio}`, selector: { engineId: 'veo-3-1', mode: 'i2v', durationSec: '8', resolution, audio },
    source: 'database', currency: 'USD', version: 1, effectiveFrom: '2026-01-01T00:00:00Z',
    price: { kind: 'fixed', customerCents: resolution === '4k' ? audio === 'true' ? 624 : 416 : audio === 'true' ? 416 : 208 } });
  return { status: 'loaded' as const, active: true, revision: 1798, databaseCells, versionedCells: [] as ManualTariffCell[] };
}
