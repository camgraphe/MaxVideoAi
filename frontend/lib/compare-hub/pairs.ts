export type CompareRoute = {
  slug: string;
  order?: string;
};

export type ComparisonPublicationModel = {
  id: string;
  slug: string;
  publication: {
    compare: {
      published: boolean;
      indexed: boolean;
      publishedPairIds: readonly string[];
    };
  };
};

export function canonicalizeComparePair(leftSlug: string, rightSlug: string): { leftSlug: string; rightSlug: string } {
  const [left, right] = [leftSlug, rightSlug].sort((a, b) => a.localeCompare(b));
  return { leftSlug: left, rightSlug: right };
}

export function buildCanonicalCompareSlug(leftSlug: string, rightSlug: string): string {
  const { leftSlug: left, rightSlug: right } = canonicalizeComparePair(leftSlug, rightSlug);
  return `${left}-vs-${right}`;
}

export function buildPublishedComparisonSlugsFromModels(
  models: readonly ComparisonPublicationModel[],
  isLocalizedScoreboardComplete: (canonicalSlug: string) => boolean,
): string[] {
  const byId = new Map(models.map((model) => [model.id, model]));
  const published = new Set<string>();

  for (const model of models) {
    for (const opponentId of model.publication.compare.publishedPairIds) {
      const opponent = byId.get(opponentId);
      if (!opponent || opponent.id === model.id) continue;
      if (
        !model.publication.compare.published ||
        !model.publication.compare.indexed ||
        !opponent.publication.compare.published ||
        !opponent.publication.compare.indexed
      ) {
        continue;
      }
      const slug = buildCanonicalCompareSlug(model.slug, opponent.slug);
      if (isLocalizedScoreboardComplete(slug)) published.add(slug);
    }
  }

  return Array.from(published).sort((left, right) => left.localeCompare(right, 'en'));
}

export function canonicalizePublishedCompareSlug(slug: string): string {
  const [leftSlug, rightSlug] = slug.split('-vs-');
  if (!leftSlug || !rightSlug) return slug;
  return buildCanonicalCompareSlug(leftSlug, rightSlug);
}

export function buildCompareRoute(leftSlug: string, rightSlug: string): CompareRoute {
  const { leftSlug: canonicalLeft, rightSlug: canonicalRight } = canonicalizeComparePair(leftSlug, rightSlug);
  const slug = `${canonicalLeft}-vs-${canonicalRight}`;
  return {
    slug,
    order: canonicalLeft === leftSlug ? undefined : leftSlug,
  };
}
