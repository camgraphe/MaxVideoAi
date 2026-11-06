import { getRuntimeModelById } from '../../frontend/config/model-runtime';
import { withClosedKlingV4Release } from './kling-v4-release-profile';

/** Replays the pre-launch catalogue, not the new models' financial approval.
 * Nano21, Flash and GPT Image 2.6 have separate approved native prices and no
 * historical percentage baseline. Their added cells have dedicated price tests. */
export async function withHistoricalCustomerTariffCatalogue<T>(run: () => T | Promise<T>): Promise<T> {
  return withClosedKlingV4Release(async () => {
    const models = ['nano-banana-2-1', 'kling-v4-flash', 'gpt-image-2-6-flare', 'gpt-image-2-6-sunburst']
      .map(id => getRuntimeModelById(id)!);
    const original = models.map(model => model.publication.app.published);
    try {
      models.forEach(model => { model.publication.app.published = false; });
      return await run();
    } finally {
      models.forEach((model, index) => { model.publication.app.published = original[index]; });
    }
  });
}
