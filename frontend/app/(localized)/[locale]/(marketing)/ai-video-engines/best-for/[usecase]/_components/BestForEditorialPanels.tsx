import type { ContentEntry } from '@/lib/content/markdown';
import { Check, ChevronRight } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import type {
  BestForDetailCopy,
  BestForEntry,
  RankedPick,
} from '../_lib/best-for-detail-config';
import {
  buildReasonSentence,
  buildUsecaseMistakes,
} from '../_lib/best-for-detail-helpers';

export function EditorialReasonCard({
  entry,
  picks,
  locale,
  copy,
}: {
  entry: BestForEntry;
  picks: RankedPick[];
  locale: AppLocale;
  copy: BestForDetailCopy;
}) {
  return (
    <section className="rounded-[14px] border border-hairline bg-surface p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-text-primary">{copy.whyTitle}</h2>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-text-secondary">
        {picks.slice(0, 4).map((pick) => (
          <p key={pick.slug}>
            <strong className="font-semibold text-text-primary">{pick.engine?.marketingName ?? pick.slug}</strong>{' '}
            {buildReasonSentence(locale, entry.slug, pick)}
          </p>
        ))}
      </div>
      <a href="#full-analysis" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-brandHover">
        {copy.fullAnalysis}
        <ChevronRight className="h-4 w-4" aria-hidden />
      </a>
    </section>
  );
}

export function MistakesCard({
  locale,
  usecaseSlug,
  criteria,
  copy,
}: {
  locale: AppLocale;
  usecaseSlug: string;
  criteria: string[];
  copy: BestForDetailCopy;
}) {
  const mistakes = buildUsecaseMistakes(locale, usecaseSlug, criteria);
  return (
    <section className="rounded-[14px] border border-hairline bg-surface p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-text-primary">{copy.mistakesTitle}</h2>
      <ul className="mt-4 space-y-3">
        {mistakes.map((mistake) => (
          <li key={mistake} className="flex items-start gap-3 text-sm leading-relaxed text-text-secondary">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-text-primary/5 text-text-primary">
              <Check className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span>{mistake}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function BestForContent({ content, contentComing }: { content: ContentEntry | null; contentComing: string }) {
  if (!content) {
    return (
      <div className="rounded-card border border-hairline bg-surface p-6 text-sm text-text-secondary shadow-card">
        {contentComing}
      </div>
    );
  }

  return (
    <article id="full-analysis" className="rounded-[16px] border border-hairline bg-surface p-6 shadow-card sm:p-8">
      <div className="prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: content.content }} />
    </article>
  );
}
