import Image from 'next/image';
import { ArrowUp, Check, ChevronRight, PlayCircle } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import type { ContentEntry } from '@/lib/content/markdown';
import { EngineIcon } from '@/components/ui/EngineIcon';
import type {
  BestForDetailCopy,
  BestForEntry,
  EngineCatalogEntry,
  ExamplePreviewPick,
  RankedPick,
  RelatedGuideEntry,
} from '../_lib/best-for-detail-config';
import {
  buildComparisonLabel,
  buildReasonSentence,
  buildUsecaseMistakes,
  findComparisonForPick,
  formatScore,
  getExamplesSlug,
  getFilledCriteria,
  getTopPicksTitle,
  pickComparisonSlug,
} from '../_lib/best-for-detail-helpers';

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
                  <RankedShortlistCard key={pick.slug} pick={pick} relatedComparisons={relatedComparisons} copy={copy} />
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

function TopPicksPanel({
  entry,
  picks,
  relatedComparisons,
  locale,
  copy,
}: {
  entry: BestForEntry;
  picks: RankedPick[];
  relatedComparisons: string[];
  locale: AppLocale;
  copy: BestForDetailCopy;
}) {
  const comparisonSlug = pickComparisonSlug(picks, relatedComparisons);

  return (
    <section className="rounded-[18px] border border-hairline bg-surface p-4 shadow-[0_24px_70px_rgba(15,23,42,0.08)] dark:shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="text-sm font-semibold text-text-primary">{getTopPicksTitle(locale, entry.slug)}</h2>
        <span className="rounded-full border border-hairline bg-surface-2 px-3 py-1 text-xs font-semibold text-text-secondary">
          {copy.tier} {entry.tier}
        </span>
      </div>
      <div className="mt-4 overflow-hidden rounded-[14px] border border-hairline">
        {picks.map((pick) => (
          <div key={pick.slug} className="grid grid-cols-[32px_42px_minmax(0,1fr)_58px] items-center gap-3 border-b border-hairline bg-surface px-3 py-3 last:border-b-0">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-text-primary text-xs font-semibold text-surface">
              {pick.rank}
            </span>
            <EngineIcon
              engine={{ id: pick.slug, label: pick.engine?.marketingName ?? pick.slug, brandId: pick.engine?.brandId }}
              size={36}
              rounded="xl"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary">{pick.engine?.marketingName ?? pick.slug}</p>
              <p className="truncate text-xs font-semibold text-brand">{pick.rank === 1 ? copy.overall : pick.criterion}</p>
              <p className="truncate text-xs text-text-secondary">{pick.reason}</p>
            </div>
            <div className="rounded-[12px] bg-brand/10 px-2 py-2 text-center">
              <p className="text-lg font-semibold tabular-nums text-brand">{formatScore(pick.score)}</p>
              <p className="text-[10px] text-text-muted">{copy.score}</p>
            </div>
          </div>
        ))}
      </div>
      {comparisonSlug ? (
        <Link
          href={{ pathname: '/ai-video-engines/[slug]', params: { slug: comparisonSlug } }}
          className="mt-4 inline-flex items-center gap-2 px-1 text-sm font-semibold text-brand transition hover:text-brandHover"
        >
          {copy.compareShortlistCta}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      ) : null}
    </section>
  );
}

function RankedShortlistCard({
  pick,
  relatedComparisons,
  copy,
}: {
  pick: RankedPick;
  relatedComparisons: string[];
  copy: BestForDetailCopy;
}) {
  const compareSlug = findComparisonForPick(pick.slug, relatedComparisons);
  return (
    <article className="group flex min-h-[20rem] flex-col rounded-[14px] border border-hairline bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-card">
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
          {pick.rank === 1 ? copy.topPick : `${copy.rank} ${pick.rank}`}
        </span>
        <span className="grid h-12 w-12 place-items-center rounded-full border border-hairline bg-surface-2 text-base font-semibold tabular-nums text-text-primary">
          {formatScore(pick.score)}
        </span>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-text-primary text-[11px] font-semibold text-surface">
          {pick.rank}
        </span>
        <EngineIcon
          engine={{ id: pick.slug, label: pick.engine?.marketingName ?? pick.slug, brandId: pick.engine?.brandId }}
          size={38}
          rounded="xl"
        />
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-tight text-text-primary">{pick.engine?.marketingName ?? pick.slug}</h3>
          <p className="truncate text-xs text-text-secondary">{pick.engine?.provider ?? copy.provider}</p>
        </div>
      </div>

      <div className="mt-5">
        <p className="text-[11px] font-semibold uppercase tracking-micro text-brand">{copy.fit}</p>
        <p className="mt-1 text-sm font-semibold leading-snug text-text-primary">{pick.criterion}</p>
        <div className="mt-3 h-px bg-hairline" />
        <ul className="mt-3 space-y-2">
          {pick.bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2 text-xs leading-relaxed text-text-secondary">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto flex flex-wrap gap-x-4 gap-y-2 pt-5 text-xs font-semibold">
        <Link href={{ pathname: '/models/[slug]', params: { slug: pick.slug } }} className="text-brand transition hover:text-brandHover">
          {copy.viewModel} →
        </Link>
        <Link
          href={{ pathname: '/examples/[model]', params: { model: getExamplesSlug(pick) } }}
          className="text-brand transition hover:text-brandHover"
        >
          {copy.viewExamples} →
        </Link>
        {compareSlug ? (
          <Link href={{ pathname: '/ai-video-engines/[slug]', params: { slug: compareSlug } }} className="text-brand transition hover:text-brandHover">
            {copy.compareWith} →
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function AlsoAvailableRow({ models, copy }: { models: EngineCatalogEntry[]; copy: BestForDetailCopy }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-hairline bg-surface-2 px-4 py-3">
      <p className="mr-1 text-xs font-semibold text-text-primary">{copy.alsoAvailable}:</p>
      {models.map((engine) => (
        <Link
          key={engine.modelSlug}
          href={{ pathname: '/models/[slug]', params: { slug: engine.modelSlug } }}
          className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1 text-xs font-semibold text-text-primary transition hover:border-brand/30 hover:text-brand"
        >
          {engine.marketingName}
          <ChevronRight className="h-3 w-3" aria-hidden />
        </Link>
      ))}
    </div>
  );
}

function ChooseEngineStrip({ picks, copy }: { picks: RankedPick[]; copy: BestForDetailCopy }) {
  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-semibold text-text-primary">{copy.chooseTitle}</h2>
      <div className="grid overflow-hidden rounded-[14px] border border-hairline bg-surface shadow-sm md:grid-cols-2 xl:grid-cols-4">
        {picks.map((pick) => (
          <article key={pick.slug} className="border-b border-hairline p-4 last:border-b-0 md:border-r md:last:border-r-0 xl:border-b-0">
            <div className="flex items-center gap-3">
              <EngineIcon
                engine={{ id: pick.slug, label: pick.engine?.marketingName ?? pick.slug, brandId: pick.engine?.brandId }}
                size={36}
                rounded="xl"
              />
              <h3 className="font-semibold text-text-primary">{pick.engine?.marketingName ?? pick.slug}</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-text-secondary">{pick.reason}</p>
            <p className="mt-4 inline-flex rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
              {pick.rank === 1 ? copy.overall : pick.criterion}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ExamplesPreview({ picks, copy }: { picks: ExamplePreviewPick[]; copy: BestForDetailCopy }) {
  return (
    <section id="examples" className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-semibold text-text-primary">{copy.examplesTitle}</h2>
          <p className="mt-1 text-sm text-text-secondary">{copy.examplesDescription}</p>
        </div>
        <Link href={{ pathname: '/examples' }} className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-brandHover">
          {copy.browseAllExamples}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {picks.map((pick) => (
          <Link
            key={pick.slug}
            href={{ pathname: '/examples/[model]', params: { model: pick.examplesSlug } }}
            className="group relative min-h-[116px] overflow-hidden rounded-[14px] border border-hairline bg-surface shadow-sm"
          >
            <Image
              src={pick.heroThumbUrl ?? '/assets/placeholders/preview-16x9.png'}
              alt=""
              aria-hidden="true"
              fill
              sizes="(min-width: 1280px) 230px, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition duration-300 group-hover:scale-105"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/42 to-black/8" aria-hidden />
            <span className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/92 via-black/68 to-transparent" aria-hidden />
            <span className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-text-primary shadow-sm">
              <PlayCircle className="h-5 w-5" aria-hidden />
            </span>
            <span className="absolute bottom-3 left-3 right-3 z-10 rounded-[10px] bg-black/42 px-3 py-2 shadow-[0_10px_26px_rgba(0,0,0,0.28)] backdrop-blur-[2px]">
              <span className="block text-sm font-semibold leading-tight text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.65)]">
                {pick.engine?.marketingName ?? pick.slug}
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.65)]">
                {pick.criterion}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function EditorialReasonCard({
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

function MistakesCard({
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

function CriteriaCard({
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

function CompareCard({ comparisons, copy }: { comparisons: string[]; copy: BestForDetailCopy }) {
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

function RelatedGuidesCard({ guides, copy }: { guides: RelatedGuideEntry[]; copy: BestForDetailCopy }) {
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

function QuickLinksCard({ copy }: { copy: BestForDetailCopy }) {
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

function BestForContent({ content, contentComing }: { content: ContentEntry | null; contentComing: string }) {
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
