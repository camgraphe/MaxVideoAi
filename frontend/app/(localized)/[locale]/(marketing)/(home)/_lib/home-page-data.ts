import type { AppLocale } from '@/i18n/locales';
import { withPublicPageTiming } from '@/server/public-page-timing';
import { loadEngineScores } from '../../ai-video-engines/[slug]/_lib/compare-page-data-loaders';
import { loadHomepageExamples } from './home-route-data/examples';
import { loadProgrammedHomepageHeroSlots } from './home-route-data/hero';
import type { RedesignContent } from './home-route-data/types';

export async function loadHomePageData(locale: AppLocale, content: RedesignContent) {
  return withPublicPageTiming({ route: 'home', locale }, async (measure) => {
    const [examples, programmedHeroSlots, engineScores] = await Promise.all([
      measure('examples', () => loadHomepageExamples(locale, content)),
      measure('hero-slots', () => loadProgrammedHomepageHeroSlots()),
      measure('scores', () => loadEngineScores()),
    ]);
    return { examples, programmedHeroSlots, engineScores };
  });
}
