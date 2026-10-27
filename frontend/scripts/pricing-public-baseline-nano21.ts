import type { ManualTariffCell } from '@maxvideoai/pricing';
import type { FalEngineEntry } from '@/config/falEngines';
import tariffDocument from '../config/customer-tariffs.json';
import { computeCanonicalPublicSnapshot } from '@/server/pricing/quote-public';
import type { PublicProjectionRow } from './pricing-public-baseline-collector';

/** Offline versioned launch evidence, never a substitute for effective DB quotes.
 * Native fixed tariffs cannot use the historical percentage-policy adapters. */
export async function collectNano21PublicProjectionRows(entry: FalEngineEntry): Promise<PublicProjectionRow[]> {
  const quote = async (resolution: string) => computeCanonicalPublicSnapshot({
    engine: entry.engine, mode: 't2i', durationSec: 1, resolution, referenceImageCount: 0,
  }, {
    pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [] }) },
    loadCustomerTariffState: async () => ({ status: 'loaded', active: true, revision: 0,
      versionedCells: tariffDocument.cells as ManualTariffCell[], databaseCells: [] }),
  });
  const [standard, high] = await Promise.all([quote('1k'), quote('4k')]);
  const exact = (id: string, surface: PublicProjectionRow['surface'], cents = standard.totalCents): PublicProjectionRow => ({
    id: id.startsWith('estimator') ? id : `${surface}:${entry.id}:${id}`,
    surface, engineId: entry.id, status: 'exact', currency: 'USD', customerTotalCents: cents,
    unit: surface === 'json-ld' ? 'offer' : 'image', quantity: 1,
    ...(surface === 'pricing-hub-image' ? { displayedAmount: `$${(cents / 100).toFixed(2)}` } : {}),
    ...(surface === 'json-ld' ? { structuredDataAmount: (cents / 100).toFixed(2) } : {}),
  });
  return [
    ...(['member', 'plus', 'pro'] as const).map(tier => exact(`estimator:${entry.id}:${tier}:default`, 'estimator')),
    exact('default', 'image-estimate'), exact('offer', 'json-ld'), exact('default', 'model-page'),
    exact('standard', 'pricing-hub-image'), exact('high', 'pricing-hub-image', high.totalCents),
    { id: `pricing-hub-image:${entry.id}:quantity-4`, surface: 'pricing-hub-image', engineId: entry.id, status: 'unavailable' },
  ];
}
