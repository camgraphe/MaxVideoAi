import { ArrowUp, Check, ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import type { ContentEntry } from '@/lib/content/markdown';
import type {
  BestForDetailCopy,
  BestForEntry,
  EngineCatalogEntry,
  ExamplePreviewPick,
  RankedPick,
  RelatedGuideEntry,
} from '../_lib/best-for-detail-config';
import { AlsoAvailableRow, ChooseEngineStrip, RankedShortlistCard } from './BestForShortlistSections';
import { BestForContent, EditorialReasonCard, MistakesCard } from './BestForEditorialPanels';
import { CompareCard, CriteriaCard, QuickLinksCard, RelatedGuidesCard } from './BestForSidebarCards';
import { ExamplesPreview } from './BestForExamplesPreview';
import { TopPicksPanel } from './BestForTopPicksPanel';

type BestForDetailViewProps = {
  alsoAvailable: EngineCatalogEntry[];
  chips: string[];
  content: ContentEntry | null;
  copy: BestForDetailCopy;
  criteria: string[];
  entry: BestForEntry;
  examplePicks: ExamplePreviewPick[];
  heroDescription: string;
  heroTitle: string;
  locale: AppLocale;
  rankedPicks: RankedPick[];
  relatedComparisons: string[];
  relatedGuides: RelatedGuideEntry[];
};

export function BestForDetailView({
  alsoAvailable,
  chips,
  content,
  copy,
  criteria,
  entry,
  examplePicks,
  heroDescription,
  heroTitle,
  locale,
  rankedPicks,
  relatedComparisons,
  relatedGuides,
}: BestForDetailViewProps) {
  return (
    <>
      <div className="space-y-12">
        <header className="space-y-8">
          <nav className="flex items-center gap-2 text-xs font-medium text-text-muted" aria-label="Breadcrumb">
            <Link href={{ pathname: '/ai-video-engines/best-for' }} className="transition hover:text-brand">
              {copy.eyebrow}
            </Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            <span className="text-text-secondary">{heroTitle}</span>
          </nav>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_456px] lg:items-start">
            <div className="max-w-4xl pt-2">
              <p className="text-xs font-semibold uppercase tracking-micro text-brand">{copy.eyebrow}</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.02] tracking-normal text-text-primary sm:text-5xl">
                {heroTitle}
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-relaxed text-text-secondary">{heroDescription}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {chips.slice(0, 5).map((chip) => (
                  <span
                    key={chip}
                    className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold text-text-secondary shadow-sm"
                  >
                    <Check className="h-3.5 w-3.5 text-brand" aria-hidden />
                    {chip}
                  </span>
                ))}
              </div>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#compare-shortlist"
                  className="inline-flex items-center justify-center rounded-card bg-text-primary px-5 py-3 text-sm font-semibold text-surface shadow-card transition hover:-translate-y-0.5 hover:bg-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                >
                  {copy.compareShortlistCta}
                </a>
                <a
                  href="#examples"
                  className="inline-flex items-center justify-center gap-2 rounded-card border border-hairline bg-surface px-5 py-3 text-sm font-semibold text-text-primary shadow-sm transition hover:-translate-y-0.5 hover:border-brand/35 hover:text-brandHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                >
                  {copy.examplesCta}
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </a>
              </div>
            </div>

            <TopPicksPanel
              entry={entry}
              picks={rankedPicks.slice(0, 3)}
              relatedComparisons={relatedComparisons}
              locale={locale}
              copy={copy}
            />
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <main className="space-y-10">
            <section id="compare-shortlist" className="space-y-4" aria-labelledby="best-for-shortlist">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                  <h2 id="best-for-shortlist" className="text-2xl font-semibold text-text-primary">
                    {copy.shortlist}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-text-secondary">{copy.shortlistDescription}</p>
                </div>
                <p className="max-w-md text-xs leading-relaxed text-text-muted">{copy.criteriaNote}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {rankedPicks.map((pick) => (
                  <RankedShortlistCard
                    key={pick.slug}
                    pick={pick}
                    relatedComparisons={relatedComparisons}
                    locale={locale}
                    copy={copy}
                  />
                ))}
              </div>
              {alsoAvailable.length ? <AlsoAvailableRow models={alsoAvailable} copy={copy} /> : null}
            </section>

            <ChooseEngineStrip picks={rankedPicks} copy={copy} />
            <ExamplesPreview picks={examplePicks} copy={copy} />

            <section className="grid gap-3 lg:grid-cols-2">
              <EditorialReasonCard entry={entry} picks={rankedPicks} locale={locale} copy={copy} />
              <MistakesCard locale={locale} usecaseSlug={entry.slug} criteria={criteria} copy={copy} />
            </section>

            <BestForContent content={content} contentComing={copy.contentComing} />
          </main>

          <aside className="space-y-4 lg:sticky lg:top-24">
            <CriteriaCard criteria={criteria} locale={locale} copy={copy} />
            <CompareCard comparisons={relatedComparisons} copy={copy} />
            <RelatedGuidesCard guides={relatedGuides} copy={copy} />
            <QuickLinksCard copy={copy} />
          </aside>
        </div>
      </div>
      <a
        href="#top"
        className="fixed bottom-5 right-5 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-surface/95 text-text-primary shadow-card backdrop-blur transition hover:border-brand/40 hover:text-brandHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        aria-label={copy.backToTop}
      >
        <ArrowUp className="h-4 w-4" aria-hidden />
      </a>
    </>
  );
}
