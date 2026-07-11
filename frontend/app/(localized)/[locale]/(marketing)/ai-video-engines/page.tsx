import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { FAQSchema } from '@/components/seo/FAQSchema';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { MarketingHeroImage } from '@/components/marketing/MarketingHeroImage';
import { BenchmarkMethodologyLink } from '@/components/marketing/BenchmarkMethodologyLink';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { resolveDictionary } from '@/lib/i18n/server';
import {
  buildCanonicalCompareSlug,
  getHubEngines,
  getPopularComparisons,
  getRankedComparisonPairs,
  getSuggestedOpponents,
  getUseCaseBuckets,
  isPublishedComparisonSlug,
} from '@/lib/compare-hub/data';
import { isComparisonIndexable } from '@/lib/compare-hub/indexation';
import { CompareNowWidget } from './CompareNowWidget.client';
import { UseCaseExplorer } from './UseCaseExplorer.client';
import { EnginesCatalog, type EngineCatalogCard } from './EnginesCatalog.client';
import { ComparisonsDirectory } from './ComparisonsDirectory.client';
import { getBestForCta, getHubCopy } from './_lib/ai-video-engines-copy';
import { loadHubEngineScoreMap } from './_lib/ai-video-engines-scores';

const COMPARE_SLUG_MAP = buildSlugMap('compare');

export async function generateMetadata(props: { params: Promise<{ locale: AppLocale }> }): Promise<Metadata> {
  const params = await props.params;
  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: 'aiVideoEngines.meta' });

  return buildSeoMetadata({
    locale,
    title: t('title'),
    description: t('description'),
    hreflangGroup: 'compare',
    slugMap: COMPARE_SLUG_MAP,
    image: '/og/compare-hub.png',
    imageAlt: t('title'),
    ogType: 'website',
    titleBranding: 'none',
    keywords: ['AI video engines', 'AI video engine comparison', 'compare AI video generators', 'Sora vs Veo', 'MaxVideoAI'],
  });
}

export default async function AiVideoEnginesPage() {
  const { locale } = await resolveDictionary();
  const copy = getHubCopy(locale);
  const bestForCta = getBestForCta(locale);
  const engines = getHubEngines();
  const enginesWithWaitlist = getHubEngines({ includeLimited: true, includeWaitlist: true });
  const scoreMap = await loadHubEngineScoreMap();
  const enginesBySlug = new Map(engines.map((engine) => [engine.modelSlug, engine]));
  const isIndexablePair = (slug: string) => isComparisonIndexable(locale, slug);

  const engineOptions = engines.map((engine) => ({ value: engine.modelSlug, label: engine.marketingName }));
  const popularComparisons = getPopularComparisons(engines).filter((pair) => isIndexablePair(pair.slug)).slice(0, 12);
  const useCaseBuckets = getUseCaseBuckets(engines).map((bucket) => ({
    id: bucket.id,
    label: copy.useCaseLabels[bucket.id] ?? bucket.id,
    pairs: bucket.pairs.filter((pair) => isIndexablePair(pair.slug)),
  }));

  const toEngineCards = (list: ReturnType<typeof getHubEngines>): EngineCatalogCard[] =>
    list.map((engine) => {
      const compareActions = getSuggestedOpponents(engine.modelSlug, list, list.length)
        .map((opponent) => {
          return {
            slug: buildCanonicalCompareSlug(engine.modelSlug, opponent.modelSlug),
            label: opponent.marketingName,
          };
        })
        .filter(
          (action) => isPublishedComparisonSlug(action.slug) && isIndexablePair(action.slug)
        )
        .slice(0, 3);

      return {
        ...engine,
        compareActions,
      };
    });

  const engineCards = toEngineCards(engines);
  const extendedEngineCards = toEngineCards(enginesWithWaitlist);

  const allComparisonEntries = getRankedComparisonPairs(engines)
    .filter((pair) => isIndexablePair(pair.slug))
    .map((pair) => ({
      slug: pair.slug,
      label: pair.label,
    }));
  const engineMetaBySlug = Object.fromEntries(
    engines.map((engine) => [
      engine.modelSlug,
      {
        overall: scoreMap.get(engine.modelSlug) ?? null,
        strengths: engine.bestFor ?? null,
        modes: engine.modes,
      },
    ])
  );
  const defaultComparison = allComparisonEntries[0];
  const strategicSeedanceVeoComparison =
    allComparisonEntries.find((entry) => entry.slug === 'seedance-2-0-vs-veo-3-1') ?? null;
  const strategicKlingVeoComparison =
    allComparisonEntries.find((entry) => entry.slug === 'kling-3-pro-vs-veo-3-1') ?? null;
  const strategicSeedanceSoraComparison =
    allComparisonEntries.find((entry) => entry.slug === 'seedance-2-0-vs-sora-2') ?? null;
  const pikaSeedanceCompareSlug = buildCanonicalCompareSlug('pika-text-to-video', 'seedance-2-0');
  const strategicPikaSeedanceComparison =
    allComparisonEntries.find((entry) => entry.slug === pikaSeedanceCompareSlug) ?? null;
  const seedancePrelaunch = enginesWithWaitlist.find((engine) => engine.modelSlug === 'seedance-2-0') ?? null;
  const showSeedanceSpotlight = Boolean(seedancePrelaunch && !engines.some((engine) => engine.modelSlug === 'seedance-2-0'));
  const seedanceCompareSlug = buildCanonicalCompareSlug('seedance-2-0', 'sora-2');
  const enginesToggleLabel = copy.sections.enginesToggle.replace('{count}', String(engineCards.length));
  const quickStartComparisons = [
    strategicSeedanceVeoComparison ?? defaultComparison ?? null,
    strategicKlingVeoComparison,
    showSeedanceSpotlight ? null : strategicSeedanceSoraComparison,
    showSeedanceSpotlight ? null : strategicPikaSeedanceComparison,
  ]
    .filter((entry): entry is { slug: string; label: string } => entry != null)
    .filter((entry) => isIndexablePair(entry.slug))
    .filter((entry, index, entries) => entries.findIndex((candidate) => candidate.slug === entry.slug) === index);

  const faqJsonLdEntries = copy.faq.slice(0, 5).map((entry) => ({
    question: entry.question,
    answer: entry.answer,
  }));

  return (
    <div className="bg-bg">
      <section className="relative overflow-hidden border-b border-hairline bg-bg px-4 py-14 sm:px-8 sm:py-20">
        <MarketingHeroImage
          src="/assets/compare/compare-hero-reference-light.webp"
          darkSrc="/assets/compare/compare-hero-reference-dark.webp"
          className="opacity-55 dark:opacity-70"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_24%,rgba(255,255,255,0.88)_0%,rgba(255,255,255,0.58)_34%,rgba(247,249,253,0.14)_70%,rgba(247,249,253,0.02)_100%)] dark:bg-[radial-gradient(circle_at_50%_24%,rgba(3,7,18,0.24)_0%,rgba(3,7,18,0.16)_42%,rgba(3,7,18,0.05)_76%,rgba(3,7,18,0.00)_100%)]" />

        <div className="container-page relative z-10 mx-auto max-w-[1220px]">
            <header className="mx-auto max-w-[760px] text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-text-muted">{copy.hero.eyebrow}</p>
              <h1 className="mt-3 text-4xl font-semibold leading-[1.04] text-text-primary sm:text-6xl">
                {copy.hero.title}
              </h1>
              <p className="mx-auto mt-5 max-w-[680px] text-base leading-7 text-text-secondary">{copy.hero.intro}</p>
              {showSeedanceSpotlight ? (
                <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs font-semibold">
                  <Link
                    href={{ pathname: '/models/[slug]', params: { slug: 'seedance-2-0' } }}
                    className="rounded-full border border-hairline bg-bg px-3 py-1.5 text-text-secondary transition hover:border-text-muted hover:text-text-primary"
                  >
                    {copy.sections.prelaunchModelLabel}
                  </Link>
                  <Link
                    href={{ pathname: '/ai-video-engines/[slug]', params: { slug: seedanceCompareSlug } }}
                    className="rounded-full border border-hairline bg-bg px-3 py-1.5 text-brand transition hover:border-brand hover:text-brandHover"
                  >
                    {copy.sections.prelaunchCompareLabel}
                  </Link>
                  <Link
                    href={{ pathname: '/ai-video-engines/[slug]', params: { slug: pikaSeedanceCompareSlug } }}
                    className="rounded-full border border-hairline bg-bg px-3 py-1.5 text-brand transition hover:border-brand hover:text-brandHover"
                  >
                    {copy.sections.prelaunchCompareSecondaryLabel}
                  </Link>
                </div>
              ) : null}
            </header>

            <div className="mx-auto mt-8 max-w-[980px] stack-gap-sm">
              <CompareNowWidget
                options={engineOptions}
                defaultLeft="seedance-2-0"
                defaultRight="veo-3-1"
                engineMetaBySlug={engineMetaBySlug}
                labels={copy.hero.compareNow}
                embedded
                className="p-0"
              />
              <div className="flex justify-center">
                <BenchmarkMethodologyLink locale={locale} variant="pill" />
              </div>
              {quickStartComparisons.length ? (
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs">
                  <span className="font-semibold uppercase tracking-micro text-text-muted">
                    {copy.sections.quickStartLabel}
                  </span>
                  {quickStartComparisons.map((comparison) => (
                    <Link
                      key={comparison.slug}
                      href={{ pathname: '/ai-video-engines/[slug]', params: { slug: comparison.slug } }}
                      className="font-semibold text-brand transition hover:text-brandHover"
                    >
                      {comparison.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>

      <div className="container-page max-w-[1220px] pb-[var(--section-padding-y)] pt-8">
      <div className="stack-gap-lg">
        <section className="stack-gap">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">{copy.sections.popularTitle}</h2>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{copy.sections.popularIntro}</p>
            </div>
            <Link href="#all-comparisons" className="text-sm font-semibold text-brand transition hover:text-brandHover">
              {copy.sections.allComparisonsTitle} →
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {popularComparisons.slice(0, 6).map((comparison) => {
              const leftEngine = enginesBySlug.get(comparison.leftSlug);
              const rightEngine = enginesBySlug.get(comparison.rightSlug);

              return (
                <article
                  key={comparison.slug}
                  className="group rounded-[16px] border border-hairline bg-surface p-4 shadow-card transition hover:-translate-y-0.5 hover:border-brand/35"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex shrink-0 items-center -space-x-2">
                      <EngineIcon
                        engine={{ id: comparison.leftSlug, label: leftEngine?.marketingName ?? comparison.leftName }}
                        size={42}
                        rounded="full"
                        className="ring-4 ring-surface"
                      />
                      <EngineIcon
                        engine={{ id: comparison.rightSlug, label: rightEngine?.marketingName ?? comparison.rightName }}
                        size={42}
                        rounded="full"
                        className="ring-4 ring-surface"
                      />
                    </div>
                    <h3 className="min-w-0 text-base font-semibold leading-snug text-text-primary">
                      <Link
                        href={{ pathname: '/ai-video-engines/[slug]', params: { slug: comparison.slug } }}
                        prefetch={false}
                        className="hover:text-brandHover"
                      >
                        <span className="block truncate">{comparison.leftName}</span>
                        <span className="block truncate">vs {comparison.rightName}</span>
                      </Link>
                    </h3>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {comparison.tags.map((tag) => (
                      <span
                        key={`${comparison.slug}-${tag}`}
                        className="rounded-full border border-hairline bg-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-micro text-text-muted"
                      >
                        {copy.tagLabels[tag] ?? tag}
                      </span>
                    ))}
                  </div>
                  <Link
                    href={{ pathname: '/ai-video-engines/[slug]', params: { slug: comparison.slug } }}
                    prefetch={false}
                    className="mt-4 inline-flex text-sm font-semibold text-brand transition hover:text-brandHover"
                  >
                    {copy.popularCompareLabel} →
                  </Link>
                </article>
              );
            })}
          </div>
        </section>

        <section className="stack-gap">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">{copy.sections.useCasesTitle}</h2>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">{copy.sections.useCasesIntro}</p>
          </div>
          <UseCaseExplorer buckets={useCaseBuckets} compareLabel={copy.popularCompareLabel} />
          <div className="rounded-2xl border border-hairline bg-surface p-5 shadow-card">
            <h3 className="text-base font-semibold text-text-primary">{bestForCta.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">{bestForCta.body}</p>
            <Link
              href={{ pathname: '/ai-video-engines/best-for' }}
              className="mt-4 inline-flex text-sm font-semibold text-brand transition hover:text-brandHover"
            >
              {bestForCta.label} →
            </Link>
          </div>
        </section>

        <section className="stack-gap">
          <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">{copy.sections.enginesTitle}</h2>
          <p className="text-sm text-text-secondary">{copy.sections.enginesIntro}</p>
          <details className="group rounded-2xl border border-hairline bg-surface p-4 shadow-card">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl border border-hairline bg-bg px-4 py-3 text-left transition hover:border-text-muted">
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-text-primary">{enginesToggleLabel}</span>
                <span className="block text-xs text-text-muted group-open:hidden">
                  {copy.sections.enginesToggleHintClosed}
                </span>
                <span className="hidden text-xs text-text-muted group-open:block">
                  {copy.sections.enginesToggleHintOpen}
                </span>
              </span>
              <span
                aria-hidden
                className="ml-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-hairline text-text-secondary transition group-open:rotate-180"
              >
                ▼
              </span>
            </summary>
            <div className="mt-4">
              <EnginesCatalog cards={engineCards} extendedCards={extendedEngineCards} labels={copy.catalogLabels} />
            </div>
          </details>
        </section>

        <section id="all-comparisons" className="stack-gap scroll-mt-24">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">{copy.sections.allComparisonsTitle}</h2>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              {copy.sections.allComparisonsIntro}{' '}
            <Link
              href={{ pathname: '/docs/[slug]', params: { slug: 'brand-safety' } }}
              className="font-semibold text-brand hover:text-brandHover"
            >
              {copy.sections.complianceLabel}
            </Link>
            .
            </p>
          </div>
          <ComparisonsDirectory
            entries={allComparisonEntries}
            labels={copy.listLabels}
            initialCount={24}
            step={24}
          />
        </section>

        <section className="stack-gap">
          <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">{copy.sections.faqTitle}</h2>
          <div className="stack-gap-sm text-base leading-relaxed text-text-secondary">
            {copy.faq.map((item) => (
              <article key={item.question} className="rounded-card border border-hairline bg-surface p-5 shadow-card">
                <h3 className="text-lg font-semibold text-text-primary">{item.question}</h3>
                <p className="mt-2 text-sm text-text-secondary">{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <FAQSchema questions={faqJsonLdEntries} />
      </div>
      </div>
    </div>
  );
}
