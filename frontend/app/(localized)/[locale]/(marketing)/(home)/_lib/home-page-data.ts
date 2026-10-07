import type { AppLocale } from '@/i18n/locales';
import { withPublicPageTiming } from '@/server/public-page-timing';
import { loadEngineScores } from '../../ai-video-engines/[slug]/_lib/compare-page-data-loaders';
import { loadHomepageExamples } from './home-route-data/examples';
import { loadProgrammedHomepageHeroSlots } from './home-route-data/hero';
import type { RedesignContent } from './home-route-data/types';
import { quoteCurrentExamplePrices } from '@/server/current-example-price';
import type { GalleryVideo } from '@/server/videos';
import { buildCurrentHomePriceDemo } from './current-home-price-demo-data';

export async function loadHomePageData(locale: AppLocale, content: RedesignContent) {
  return withPublicPageTiming({ route: 'home', locale }, async (measure) => {
    const [examples, programmedHeroSlots, engineScores, currentHeroPrices, currentPriceModels] = await Promise.all([
      measure('examples', () => loadHomepageExamples(locale, content, { measure })),
      measure('hero-slots', () => loadProgrammedHomepageHeroSlots()),
      measure('scores', () => loadEngineScores()),
      measure('hero-pricing', () => quoteCurrentExamplePrices(content.hero.mockup.engineRecommendations.map((recommendation) => ({
        id: recommendation.engineId, engineId: recommendation.engineId, durationSec: 0,
      } as GalleryVideo)))),
      measure('demo-pricing', () => buildCurrentHomePriceDemo(locale)),
    ]);
    return { examples, programmedHeroSlots, engineScores, currentHeroPrices, currentPriceModels };
  });
}
