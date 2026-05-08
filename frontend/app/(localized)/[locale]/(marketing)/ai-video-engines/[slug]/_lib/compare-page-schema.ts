import type { ComparePageCopy } from './compare-page-copy';
import { formatEngineName, formatTemplate, replaceCriteriaCount } from './compare-page-helpers';
import type { EngineCatalogEntry } from './compare-page-types';

type CompareMetaOverride = {
  title?: string;
  description?: string;
};

export function buildCompareBreadcrumbJsonLd({
  compareCopy,
  compareHubCanonicalUrl,
  comparisonCanonicalUrl,
  left,
  right,
}: {
  compareCopy: ComparePageCopy;
  compareHubCanonicalUrl: string;
  comparisonCanonicalUrl: string;
  left: EngineCatalogEntry;
  right: EngineCatalogEntry;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: compareCopy.breadcrumb?.root ?? 'Comparisons',
        item: compareHubCanonicalUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: `${formatEngineName(left)} vs ${formatEngineName(right)}`,
        item: comparisonCanonicalUrl,
      },
    ],
  };
}

export function buildCompareWebPageJsonLd({
  compareCopy,
  comparisonCanonicalUrl,
  criteriaCount,
  left,
  metaOverride,
  pairHasKling3Native4k,
  right,
}: {
  compareCopy: ComparePageCopy;
  comparisonCanonicalUrl: string;
  criteriaCount: number;
  left: EngineCatalogEntry;
  metaOverride?: CompareMetaOverride | null;
  pairHasKling3Native4k: boolean;
  right: EngineCatalogEntry;
}) {
  const descriptionTemplate = replaceCriteriaCount(
    metaOverride?.description ??
      (pairHasKling3Native4k
        ? `Compare {left} vs {right} across native 4K delivery, iteration cost, key specs, and a scorecard across ${criteriaCount} criteria on MaxVideoAI.`
        : compareCopy.meta?.description ??
          `Compare {left} vs {right} with the same prompts, key specs, and a scorecard across ${criteriaCount} criteria on MaxVideoAI.`),
    criteriaCount
  );

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: formatTemplate(
      metaOverride?.title ?? compareCopy.meta?.title ?? '{left} vs {right}: specs, pricing & prompt test',
      { left: formatEngineName(left), right: formatEngineName(right) }
    ),
    url: comparisonCanonicalUrl,
    description: formatTemplate(descriptionTemplate, {
      left: formatEngineName(left),
      right: formatEngineName(right),
    }),
  };
}
