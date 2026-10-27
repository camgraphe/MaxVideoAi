import { getRuntimeModelById } from '../../frontend/config/model-runtime';
import { withClosedKlingV4Release } from './kling-v4-release-profile';

/** Replays the pre-launch catalogue, not the new models' financial approval.
 * Nano21 was born with fixed prices and has no historical percentage baseline.
 * Its six new cells are qualified by the separate native-price tests. */
export async function withHistoricalCustomerTariffCatalogue<T>(run: () => T | Promise<T>): Promise<T> {
  return withClosedKlingV4Release(async () => {
    const nano = getRuntimeModelById('nano-banana-2-1')!;
    const original = nano.publication.app.published;
    try {
      nano.publication.app.published = false;
      return await run();
    } finally {
      nano.publication.app.published = original;
    }
  });
}
