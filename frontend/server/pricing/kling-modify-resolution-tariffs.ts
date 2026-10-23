import { createHash } from 'node:crypto';
import { resolveManualTariffCell, type ManualTariffCell } from '@maxvideoai/pricing';
import type { EffectiveCustomerTariffState } from './customer-tariff-store';

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Read-only release preparation. Publish these cells through reviewed tariff maintenance
 * before deploying the catalog correction. Never alias a 720p quote to a 1080p selector. */
export function prepareKlingModifyResolutionTariffs(input: { state: EffectiveCustomerTariffState; at: string }) {
  const { state, at } = input;
  if (state.status !== 'loaded' || !state.active || !Number.isFinite(Date.parse(at))) {
    throw new Error('Active reviewed customer tariffs and a valid preparation time are required.');
  }
  const current = [...state.databaseCells, ...state.versionedCells];
  if (current.some(cell => cell.selector.engineId === 'kling-o3-standard'
    && cell.selector.mode === 'v2v' && cell.selector.resolution === '720p')) {
    throw new Error('Kling Modify 720p tariffs already exist; review them in the admin.');
  }
  const sourceCells: ManualTariffCell[] = [];
  const cells = Array.from({ length: 13 }, (_, index): ManualTariffCell => {
    const selector = { engineId: 'kling-o3-standard', mode: 'v2v', resolution: '1080p', durationSec: String(index + 3) };
    const source = resolveManualTariffCell({ selector, at, databaseCells: state.databaseCells, versionedCells: state.versionedCells });
    if (source.currency !== 'USD' || source.price.kind !== 'fixed') throw new Error('Reviewed fixed USD tariffs are required.');
    sourceCells.push(source);
    const corrected = { ...selector, resolution: '720p' };
    return { id: `kling-modify-720p-${digest(corrected).slice(0, 32)}`, selector: corrected, currency: source.currency,
      price: structuredClone(source.price), source: 'database', version: 1, effectiveFrom: at };
  });
  return { sourceRevision: state.revision, cells,
    fingerprint: digest({ revision: state.revision, sourceCells, cells }),
    scope: { engineId: 'kling-o3-standard', mode: 'v2v', fromResolution: '1080p', toResolution: '720p' },
    existingPricesChanged: false as const };
}
