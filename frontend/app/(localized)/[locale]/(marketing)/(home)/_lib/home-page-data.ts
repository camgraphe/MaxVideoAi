import type { AppLocale } from '@/i18n/locales';
import { withPublicPageTiming } from '@/server/public-page-timing';
import { loadEngineScores } from '../../ai-video-engines/[slug]/_lib/compare-page-data-loaders';
import { loadHomepageExamples } from './home-route-data/examples';
import { loadProgrammedHomepageHeroSlots } from './home-route-data/hero';
import type { RedesignContent } from './home-route-data/types';
import { quoteCurrentExamplePrices } from '@/server/current-example-price';
import type { GalleryVideo } from '@/server/videos';
import { buildCurrentHomePriceDemo } from './current-home-price-demo-data';

export function prepareHomePageData(locale: AppLocale, content: RedesignContent) {
  let examples!: ReturnType<typeof loadHomepageExamples>;
  let heroPrices!: ReturnType<typeof quoteCurrentExamplePrices>;
  let priceModels!: ReturnType<typeof buildCurrentHomePriceDemo>;
  let critical!: Promise<{
    programmedHeroSlots: Awaited<ReturnType<typeof loadProgrammedHomepageHeroSlots>>;
    engineScores: Awaited<ReturnType<typeof loadEngineScores>>;
  }>;
  // The timing owner starts its callback synchronously, exposing the same request's reads.
  const completed = withPublicPageTiming({ route: 'home', locale }, async (measure) => {
    examples = measure('examples', () => loadHomepageExamples(locale, content, { measure }));
    const slots = measure('hero-slots', () => loadProgrammedHomepageHeroSlots());
    const scores = measure('scores', () => loadEngineScores());
    heroPrices = measure('hero-pricing', () => quoteCurrentExamplePrices(content.hero.mockup.engineRecommendations.map((recommendation) => ({
        id: recommendation.engineId, engineId: recommendation.engineId, durationSec: 0,
      } as GalleryVideo))));
    priceModels = measure('demo-pricing', () => buildCurrentHomePriceDemo(locale));
    critical = Promise.all([slots, scores]).then(([programmedHeroSlots, engineScores]) => (
      { programmedHeroSlots, engineScores }
    ));
    const reads = [examples, slots, scores, heroPrices, priceModels];
    const result = Promise.all(reads);
    void result.catch(() => undefined);
    // Record eventual durations even if an earlier read fails; retain the first original error.
    await Promise.allSettled(reads);
    await result;
  });
  // Attach observers before the route awaits critical data or React consumes discovery.
  // The original promises still reject for their consumers; these do not supply fallbacks.
  void examples.catch(() => undefined);
  void heroPrices.catch(() => undefined);
  void priceModels.catch(() => undefined);
  void critical.catch(() => undefined);
  void completed.catch(() => undefined);
  return { critical, examples, heroPrices, priceModels, completed };
}

export async function loadHomePageData(locale: AppLocale, content: RedesignContent) {
  const pending = prepareHomePageData(locale, content);
  const [critical, examples, currentHeroPrices, currentPriceModels] = await Promise.all([
    pending.critical, pending.examples, pending.heroPrices, pending.priceModels, pending.completed,
  ]);
  return { ...critical, examples, currentHeroPrices, currentPriceModels };
}
