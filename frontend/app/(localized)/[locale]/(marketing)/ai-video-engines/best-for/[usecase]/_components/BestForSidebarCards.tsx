import { ArrowUp, ChevronRight } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import { Link } from '@/i18n/navigation';
import type {
  BestForDetailCopy,
  RelatedGuideEntry,
} from '../_lib/best-for-detail-config';
import {
  buildComparisonLabel,
  getFilledCriteria,
} from '../_lib/best-for-detail-helpers';

export function CriteriaCard({
  criteria,
  locale,
  copy,
}: {
  criteria: string[];
  locale: AppLocale;
  copy: BestForDetailCopy;
}) {
  const filledCriteria = getFilledCriteria(locale, criteria);
  return (
    <section className="rounded-[16px] border border-hairline bg-surface p-5 shadow-card">
      <p className="text-sm font-semibold text-text-primary">{copy.criteria}</p>
      <div className="mt-4 space-y-3">
        {filledCriteria.map((criterion, index) => (
          <div key={`${criterion}-${index}`} className="flex items-start gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-brand/20 bg-brand/10 text-xs font-semibold text-brand">
              {index + 1}
            </span>
            <p className="text-sm leading-relaxed text-text-secondary">{criterion}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function CompareCard({ comparisons, copy }: { comparisons: string[]; copy: BestForDetailCopy }) {
  if (!comparisons.length) return null;
  return (
    <section className="rounded-[16px] border border-hairline bg-surface p-5 shadow-card">
      <p className="text-sm font-semibold text-text-primary">{copy.compareShortlist}</p>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">{copy.compareDescription}</p>
      <div className="mt-4 space-y-2">
        {comparisons.map((slug) => (
          <Link
            key={slug}
            href={{ pathname: '/ai-video-engines/[slug]', params: { slug } }}
            className="group flex items-center justify-between gap-3 rounded-card border border-hairline bg-surface-2 px-3 py-3 text-sm font-semibold text-brand transition hover:border-brand/40 hover:text-brandHover"
          >
            <span>{buildComparisonLabel(slug)}</span>
            <ChevronRight className="h-4 w-4 shrink-0 transition group-hover:translate-x-0.5" aria-hidden />
          </Link>
        ))}
      </div>
    </section>
  );
}

export function RelatedGuidesCard({ guides, copy }: { guides: RelatedGuideEntry[]; copy: BestForDetailCopy }) {
  return (
    <section className="rounded-[16px] border border-hairline bg-surface p-5 shadow-card">
      <p className="text-sm font-semibold text-text-primary">{copy.relatedGuides}</p>
      <div className="mt-4 space-y-3">
        {guides.map((guide) => (
          <Link
            key={guide.slug}
            href={{ pathname: '/ai-video-engines/best-for/[usecase]', params: { usecase: guide.slug } }}
            className="block text-sm font-semibold text-brand transition hover:text-brandHover"
          >
            {guide.displayTitle}
          </Link>
        ))}
      </div>
      <Link
        href={{ pathname: '/ai-video-engines/best-for' }}
        className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-brandHover"
      >
        {copy.allGuides}
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Link>
    </section>
  );
}

export function QuickLinksCard({ copy }: { copy: BestForDetailCopy }) {
  return (
    <section className="rounded-[16px] border border-hairline bg-surface p-5 shadow-card">
      <p className="text-sm font-semibold text-text-primary">{copy.quickLinks}</p>
      <div className="mt-4 grid gap-2">
        <Link
          href={{ pathname: '/ai-video-engines/best-for' }}
          className="rounded-card border border-hairline bg-surface-2 px-3 py-3 text-sm font-semibold text-brand transition hover:border-brand/40 hover:text-brandHover"
        >
          {copy.backToHub}
        </Link>
        <a
          href="#top"
          className="inline-flex items-center justify-center gap-2 rounded-card border border-hairline bg-surface-2 px-3 py-3 text-sm font-semibold text-text-primary transition hover:border-brand/40 hover:text-brandHover"
        >
          <ArrowUp className="h-4 w-4" aria-hidden />
          {copy.backToTop}
        </a>
      </div>
    </section>
  );
}
