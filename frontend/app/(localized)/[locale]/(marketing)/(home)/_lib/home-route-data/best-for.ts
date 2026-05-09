import type { ShotTypeCard } from '@/components/marketing/home/HomeRedesignSections';
import { BEST_FOR_BY_SLUG, ENGINE_BY_MODEL_SLUG } from './constants';
import type { RedesignContent } from './types';

export function buildBestForGuideCards(content: RedesignContent, slugs: readonly string[]): ShotTypeCard[] {
  const copyBySlug = new Map(content.shotTypes.cards.map((card) => [card.slug, card]));

  return slugs.flatMap((slug) => {
    const entry = BEST_FOR_BY_SLUG.get(slug);
    const localized = copyBySlug.get(slug);
    if (!entry || !localized) return [];

    return [
      {
        id: slug,
        slug,
        title: localized.title,
        body: localized.body || entry.description || '',
        cta: localized.cta,
        href: { pathname: '/ai-video-engines/best-for/[usecase]', params: { usecase: slug } },
        tier: entry.tier,
        topPicks: (entry.topPicks ?? []).slice(0, 3).map((modelSlug) => {
          const engine = ENGINE_BY_MODEL_SLUG.get(modelSlug);
          return {
            slug: modelSlug,
            label: engine?.marketingName ?? modelSlug,
            brandId: engine?.brandId,
            provider: engine?.provider,
          };
        }),
      },
    ];
  });
}
