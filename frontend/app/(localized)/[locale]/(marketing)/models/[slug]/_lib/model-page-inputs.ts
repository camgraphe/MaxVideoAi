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

/** Complete-input compatibility API; active pages consume the critical and pricing reads separately. */
export function loadModelPageInputs<TGallery, TPricing>(
  locale: AppLocale,
  loadGallery: () => Promise<TGallery>,
  loadPricing?: (overrides: EnginePricingOverrides) => Promise<TPricing>,
) {
  return prepareModelPageInputs(locale, loadGallery, loadPricing).result;
}

/** Start each read once. Only pricing depends on the current request's override. */
export function prepareModelPageInputs<TGallery, TPricing>(
  locale: AppLocale,
  loadGallery: () => Promise<TGallery>,
  loadPricing?: (overrides: EnginePricingOverrides) => Promise<TPricing>,
) {
  let result!: Promise<ModelPageInputs<TGallery> & { pricing?: TPricing }>;
  let critical!: Promise<Omit<ModelPageInputs<TGallery>, 'enginePricingOverrides'>>;
  let pricing!: Promise<TPricing | undefined>;
  const completed = withPublicPageTiming({ route: 'model', locale }, async (measure) => {
    const scores = measure('scores', () => loadBenchmarkScoreSlugs());
    const overrides = measure('engine-settings', () => listEnginePricingOverrides());
    const specs = measure('key-specs', () => loadEngineKeySpecs());
    const gallery = measure('model-gallery', async () => loadGallery());
    pricing = loadPricing
      ? overrides.then(value => measure('model-pricing', () => loadPricing(value)))
      : Promise.resolve(undefined);
    critical = Promise.all([scores, specs, gallery]).then(([benchmarkScoreSlugs, keySpecsMap, gallery]) => (
      { benchmarkScoreSlugs, keySpecsMap, gallery }
    ));
    const reads = [scores, overrides, specs, gallery, pricing] as const;
    result = Promise.all(reads).then(([benchmarkScoreSlugs, enginePricingOverrides, keySpecsMap, gallery, pricing]) => (
      { benchmarkScoreSlugs, enginePricingOverrides, keySpecsMap, gallery, ...(loadPricing ? { pricing } : {}) }
    ));
    // Observe every public branch eagerly without turning its original rejection into a fallback.
    void critical.catch(() => undefined);
    void pricing.catch(() => undefined);
    void result.catch(() => undefined);
    await Promise.allSettled(reads);
    await result;
  });
  void completed.catch(() => undefined);
  return { critical, pricing, result, completed };
}
