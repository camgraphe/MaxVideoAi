import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { ComparePageCopy } from '../_lib/compare-page-copy';
import { formatEngineName, formatTemplate } from '../_lib/compare-page-helpers';
import type { EngineCatalogEntry } from '../_lib/compare-page-types';

type CompareDetailHeroProps = {
  compareCopy: ComparePageCopy;
  compareHubHref: string;
  heroIntroTemplate: string;
  left: EngineCatalogEntry;
  prelaunchNotice: { title: string; body: string } | null;
  right: EngineCatalogEntry;
};

export function CompareDetailHero({
  compareCopy,
  compareHubHref,
  heroIntroTemplate,
  left,
  prelaunchNotice,
  right,
}: CompareDetailHeroProps) {
  return (
    <>
      <div className="text-sm text-text-muted">
        <Link href={compareHubHref} className="inline-flex items-center gap-2 font-semibold text-brand hover:text-brandHover">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {compareCopy.hero?.back ?? 'Back to comparisons'}
        </Link>
      </div>
      <header className="mx-auto max-w-[760px] py-6 text-center sm:py-8">
        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">
          {compareCopy.hero?.kicker ?? 'Compare engines'}
        </p>
        <h1 className="mt-3 text-[34px] font-semibold leading-[1.08] tracking-normal text-text-primary sm:text-[46px]">
          {formatEngineName(left)} vs {formatEngineName(right)}
        </h1>
        <p className="mt-4 text-sm leading-6 text-text-secondary">
          {formatTemplate(heroIntroTemplate, {
            left: formatEngineName(left),
            right: formatEngineName(right),
          })}
        </p>
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
