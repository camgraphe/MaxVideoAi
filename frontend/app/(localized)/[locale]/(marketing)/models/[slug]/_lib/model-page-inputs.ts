import type { AppLocale } from '@/i18n/locales';
import { loadBenchmarkScoreSlugs } from '@/server/benchmark-lab-data';
import { listEnginePricingOverrides } from '@/server/engine-settings';
import { withPublicPageTiming } from '@/server/public-page-timing';
import { loadEngineKeySpecs } from './model-page-key-specs';

/** Active-model inputs only; media selection and pricing stay with their current owners. */
export function loadModelPageInputs<TGallery>(locale: AppLocale, loadGallery: () => Promise<TGallery>) {
  return withPublicPageTiming({ route: 'model', locale }, async (measure) => {
    // None of these readers depends on another reader's result. Promise.all attaches
    // rejection handlers immediately, including when a sibling read fails first.
    const [benchmarkScoreSlugs, enginePricingOverrides, keySpecsMap, gallery] = await Promise.all([
      measure('scores', () => loadBenchmarkScoreSlugs()),
      measure('engine-settings', () => listEnginePricingOverrides()),
      measure('key-specs', () => loadEngineKeySpecs()),
      measure('model-gallery', loadGallery),
    ]);
    return { benchmarkScoreSlugs, enginePricingOverrides, keySpecsMap, gallery };
  });
}
