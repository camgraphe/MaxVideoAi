import { isPublishedComparisonSlug } from '@/lib/compare-hub/data';
import { RELATED_COMPARISONS } from './compare-page-config';
import { formatEngineName, getCanonicalCompareSlug, resolveEngines } from './compare-page-helpers';

export type RelatedComparisonLink = {
  href: { pathname: string; params: { slug: string } };
  label: string;
};

export function buildRelatedComparisonLinks(canonicalSlug: string): RelatedComparisonLink[] {
  const relatedSlugs = RELATED_COMPARISONS[canonicalSlug] ?? [];
  return relatedSlugs
    .map((pairSlug) => {
      const resolvedPair = resolveEngines(pairSlug);
      if (!resolvedPair) return null;
      const canonicalPair = getCanonicalCompareSlug(pairSlug)?.canonicalSlug ?? pairSlug;
      if (!isPublishedComparisonSlug(canonicalPair)) return null;
      return {
        href: { pathname: '/ai-video-engines/[slug]', params: { slug: canonicalPair } },
        label: `${formatEngineName(resolvedPair.left)} vs ${formatEngineName(resolvedPair.right)}`,
      };
    })
    .filter((item): item is RelatedComparisonLink => Boolean(item));
}
