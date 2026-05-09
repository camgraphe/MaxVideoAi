import { Link } from '@/i18n/navigation';
import type { ComparePageCopy } from '../_lib/compare-page-copy';
import type { RelatedComparisonLink } from '../_lib/compare-page-related-links';

type CompareRelatedSectionProps = {
  compareCopy: ComparePageCopy;
  relatedLinks: RelatedComparisonLink[];
};

export function CompareRelatedSection({ compareCopy, relatedLinks }: CompareRelatedSectionProps) {
  if (!relatedLinks.length) return null;

  return (
    <section className="stack-gap-sm">
      <h2 className="text-2xl font-semibold text-text-primary">
        {compareCopy.related?.title ?? 'Related comparisons'}
      </h2>
      <p className="text-sm text-text-secondary">
        {compareCopy.related?.subtitle ?? 'Explore a few more popular side-by-side matchups.'}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {relatedLinks.map((item) => (
          <Link
            key={item.href.params.slug}
            href={item.href}
            className="rounded-card border border-hairline bg-surface px-4 py-3 text-sm font-semibold text-text-primary transition hover:bg-surface-2"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
