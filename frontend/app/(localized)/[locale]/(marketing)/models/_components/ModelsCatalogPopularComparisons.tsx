import { ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { ModelsCatalogPopularComparison } from '../_lib/models-catalog-decision-data';

type ModelsCatalogPopularComparisonsProps = {
  title: string;
  subtitle: string;
  hubLabel: string;
  comparisons: ModelsCatalogPopularComparison[];
};

export function ModelsCatalogPopularComparisons({
  title,
  subtitle,
  hubLabel,
  comparisons,
}: ModelsCatalogPopularComparisonsProps) {
  return (
    <section
      id="popular-comparisons"
      className="scroll-mt-24 rounded-[8px] border border-hairline bg-surface p-5 shadow-card sm:p-6"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-secondary">{subtitle}</p>
        </div>
        <Link href="/ai-video-engines" className="inline-flex items-center gap-2 text-xs font-semibold text-text-secondary hover:text-text-primary">
          {hubLabel}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {comparisons.map((comparison) => (
          <Link
            key={comparison.label}
            href={comparison.href}
            prefetch={false}
            className="flex min-h-12 items-center justify-between gap-3 rounded-[8px] border border-hairline bg-bg px-3 py-2 text-sm font-semibold text-text-primary transition hover:border-text-muted hover:bg-surface-2"
          >
            <span>{comparison.label}</span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden />
          </Link>
        ))}
      </div>
    </section>
  );
}
