import type { AppLocale } from '@/i18n/locales';
import { loadBenchmarkScoreSlugs } from '@/server/benchmark-lab-data';
import { listEnginePricingOverrides } from '@/server/engine-settings';
import { withPublicPageTiming } from '@/server/public-page-timing';
import { loadEngineKeySpecs } from './model-page-key-specs';

type EnginePricingOverrides = Awaited<ReturnType<typeof listEnginePricingOverrides>>;
type ModelPageInputs<TGallery> = {
  benchmarkScoreSlugs: Awaited<ReturnType<typeof loadBenchmarkScoreSlugs>>;
  enginePricingOverrides: EnginePricingOverrides;
  keySpecsMap: Awaited<ReturnType<typeof loadEngineKeySpecs>>;
  gallery: TGallery;
};

export function loadModelPageInputs<TGallery, TPricing>(
  locale: AppLocale,
  loadGallery: () => Promise<TGallery>,
  loadPricing: (overrides: EnginePricingOverrides) => Promise<TPricing>,
): Promise<ModelPageInputs<TGallery> & { pricing: TPricing }>;
export function loadModelPageInputs<TGallery>(
  locale: AppLocale,
  loadGallery: () => Promise<TGallery>,
): Promise<ModelPageInputs<TGallery>>;

/** Active-model scheduling only; media selection and pricing retain their owners. */
export function loadModelPageInputs<TGallery, TPricing>(
  locale: AppLocale,
  loadGallery: () => Promise<TGallery>,
  loadPricing?: (overrides: EnginePricingOverrides) => Promise<TPricing>,
) {
  let result!: Promise<ModelPageInputs<TGallery> & { pricing?: TPricing }>;
  const completed = withPublicPageTiming({ route: 'model', locale }, async (measure) => {
    const scores = measure('scores', () => loadBenchmarkScoreSlugs());
    const overrides = measure('engine-settings', () => listEnginePricingOverrides());
    const specs = measure('key-specs', () => loadEngineKeySpecs());
    const gallery = measure('model-gallery', async () => loadGallery());
    // Only pricing needs the override. Never wait for unrelated gallery/spec/score reads.
    const pricing = loadPricing
      ? overrides.then(value => measure('model-pricing', () => loadPricing(value)))
      : Promise.resolve(undefined);
    const reads = [scores, overrides, specs, gallery, pricing] as const;
    result = Promise.all(reads).then(([benchmarkScoreSlugs, enginePricingOverrides, keySpecsMap, gallery, pricing]) => (
      { benchmarkScoreSlugs, enginePricingOverrides, keySpecsMap, gallery, ...(loadPricing ? { pricing } : {}) }
    ));
    // The public result keeps its first original rejection promptly. Its separate
    // diagnostic completion observes every sibling before recording durations/errors.
    void result.catch(() => undefined);
    await Promise.allSettled(reads);
    await result;
  });
  // Observe diagnostic rejection immediately; neither observer supplies a fallback.
  void completed.catch(() => undefined);
  return result;
}
