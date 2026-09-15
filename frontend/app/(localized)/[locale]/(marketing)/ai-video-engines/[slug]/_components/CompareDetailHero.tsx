import type { AppLocale } from '@/i18n/locales';
import { getCompareEditorialCopy } from '../_lib/compare-editorial-copy';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { ComparePageCopy } from '../_lib/compare-page-copy';
import { formatEngineName, formatTemplate } from '../_lib/compare-page-helpers';
import type { ComparePageOverride } from '../_lib/compare-page-overrides';
import type { EngineCatalogEntry } from '../_lib/compare-page-types';

type CompareDetailHeroProps = {
  activeLocale: AppLocale;
  compareCopy: ComparePageCopy;
  compareHubHref: string;
  heroIntroTemplate: string;
  left: EngineCatalogEntry;
  pageOverride?: ComparePageOverride | null;
  prelaunchNotice: { title: string; body: string } | null;
  right: EngineCatalogEntry;
};

export function CompareDetailHero({
  activeLocale,
  compareCopy,
  compareHubHref,
  heroIntroTemplate,
  left,
  pageOverride,
  prelaunchNotice,
  right,
}: CompareDetailHeroProps) {
  const copy = getCompareEditorialCopy(activeLocale);
  return (
    <>
      <div className="text-sm text-text-muted">
        <Link href={compareHubHref} className="inline-flex items-center gap-2 font-semibold text-brand hover:text-brandHover">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {compareCopy.hero?.back ?? 'Back to comparisons'}
        </Link>
      </div>
      <header className="compare-opening">
        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">
          {compareCopy.hero?.kicker ?? 'Compare engines'}
        </p>
        <h1 className="mt-3 text-[34px] font-semibold leading-[1.08] tracking-normal text-text-primary sm:text-[46px]">
          <span>{formatEngineName(left)}</span><span className="compare-title-vs"> vs </span><span>{formatEngineName(right)}</span>
        </h1>
        <p className="compare-opening-intro">{copy.intro}</p>
        <details className="compare-context">
          <summary>{copy.context}<span aria-hidden="true"> +</span></summary>
          <p>{formatTemplate(heroIntroTemplate, { left: formatEngineName(left), right: formatEngineName(right) })}</p>
          {pageOverride?.quickVerdict ? <div><h2>{pageOverride.quickVerdict.title}</h2><p>{pageOverride.quickVerdict.body}</p></div> : null}
      {pageOverride?.topCards?.length ? (
        <section className="mt-6 rounded-[24px] border border-hairline bg-surface-2/70 p-4 shadow-sm sm:p-5">
          <div className="grid gap-3 md:grid-cols-2">
            {pageOverride.topCards.map((card) => (
              <article key={card.title} className="rounded-[18px] border border-hairline bg-surface/90 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">
                  {card.title}
                </p>
                <p className="mt-1.5 text-sm leading-6 text-text-secondary">{card.body}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

        </details>
        {prelaunchNotice ? (
          <div className="mx-auto mt-4 max-w-3xl rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-left shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-micro text-amber-900">{prelaunchNotice.title}</p>
            <p className="mt-1 text-sm text-amber-950">{prelaunchNotice.body}</p>
          </div>
        ) : null}
      </header>
    </>
  );
}
