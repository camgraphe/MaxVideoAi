import type { CSSProperties } from 'react';
import type { AppLocale } from '@/i18n/locales';
import { Link } from '@/i18n/navigation';
import type { SelectOption } from '@/components/ui/SelectMenu';
import type { CompareDetailLabels, ComparePageCopy } from '../_lib/compare-page-copy';
import type { CompareFaqItem } from '../_lib/compare-page-faq';
import type { EngineAccent } from '../_lib/compare-page-helpers';
import type { ComparePageOverride } from '../_lib/compare-page-overrides';
import type { RelatedComparisonLink } from '../_lib/compare-page-related-links';
import type { CompareMetric, CompareSummaryRow } from '../_lib/compare-page-scorecard';
import type { CompareSpecRow } from '../_lib/compare-page-spec-rows';
import type { CompareShowdownSlot, EngineCatalogEntry } from '../_lib/compare-page-types';
import { CompareDetailHero } from './CompareDetailHero';
import { CompareEngineHeroCards } from './CompareEngineHeroCards';
import { CompareFaqSection } from './CompareFaqSection';
import { CompareRelatedSection } from './CompareRelatedSection';
import { CompareScorecardSection } from './CompareScorecardSection';
import { CompareShowdownSection } from './CompareShowdownSection';
import { CompareSpecsSection } from './CompareSpecsSection';

type CompareDetailContentProps = {
  activeLocale: AppLocale;
  breadcrumbJsonLd: unknown;
  compareCopy: ComparePageCopy;
  compareHubHref: string;
  comparisonMetrics: CompareMetric[];
  criteriaCount: number;
  engineScoresBySlug: Record<string, number>;
  exposeSourcePrompt: boolean;
  faqItems: CompareFaqItem[];
  faqJsonLd: unknown;
  generateWithLabel: string;
  heroIntroTemplate: string;
  labels: CompareDetailLabels;
  left: EngineCatalogEntry;
  leftAccent: EngineAccent;
  leftCanGenerate: boolean;
  leftIsPrelaunch: boolean;
  leftOverall: number | null;
  leftScoreStyle: CSSProperties;
  localizedPromptNote: string;
  pageOverride?: ComparePageOverride | null;
  pairHasNativeAudio: boolean;
  prelaunchNotice: { title: string; body: string } | null;
  relatedLinks: RelatedComparisonLink[];
  resolvedLeftOptions: SelectOption[];
  resolvedRightOptions: SelectOption[];
  right: EngineCatalogEntry;
  rightAccent: EngineAccent;
  rightCanGenerate: boolean;
  rightIsPrelaunch: boolean;
  rightOverall: number | null;
  rightScoreStyle: CSSProperties;
  scorecardCriteriaLabel: string;
  scorecardProvisionalNote: string | null;
  showdownActionHint: string;
  showdownActionLabel: string;
  showdownSlots: CompareShowdownSlot[];
  showdownSubtitle: string;
  slug: string;
  specRows: CompareSpecRow[];
  summaryRows: CompareSummaryRow[];
  webPageJsonLd: unknown;
  winnerSummaryHeading: string;
};

export function CompareDetailContent({
  activeLocale,
  breadcrumbJsonLd,
  compareCopy,
  compareHubHref,
  comparisonMetrics,
  criteriaCount,
  engineScoresBySlug,
  exposeSourcePrompt,
  faqItems,
  faqJsonLd,
  generateWithLabel,
  heroIntroTemplate,
  labels,
  left,
  leftAccent,
  leftCanGenerate,
  leftIsPrelaunch,
  leftOverall,
  leftScoreStyle,
  localizedPromptNote,
  pageOverride,
  pairHasNativeAudio,
  prelaunchNotice,
  relatedLinks,
  resolvedLeftOptions,
  resolvedRightOptions,
  right,
  rightAccent,
  rightCanGenerate,
  rightIsPrelaunch,
  rightOverall,
  rightScoreStyle,
  scorecardCriteriaLabel,
  scorecardProvisionalNote,
  showdownActionHint,
  showdownActionLabel,
  showdownSlots,
  showdownSubtitle,
  slug,
  specRows,
  summaryRows,
  webPageJsonLd,
  winnerSummaryHeading,
}: CompareDetailContentProps) {
  return (
    <div className="relative isolate overflow-hidden">
      <div
        className="pointer-events-none absolute right-0 top-24 -z-10 h-[760px] w-[46vw] opacity-70 dark:opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(circle at center, color-mix(in srgb, var(--brand) 30%, transparent) 1px, transparent 1px)',
          backgroundSize: '16px 16px',
          maskImage: 'linear-gradient(90deg, transparent, black 24%, black 74%, transparent)',
        }}
        aria-hidden
      />
      <div className="container-page max-w-[1040px] section">
        <div className="space-y-4 sm:space-y-5">
          <CompareDetailHero
            compareCopy={compareCopy}
            compareHubHref={compareHubHref}
            heroIntroTemplate={heroIntroTemplate}
            left={left}
            prelaunchNotice={prelaunchNotice}
            right={right}
          />

          <CompareEngineHeroCards
            activeLocale={activeLocale}
            compareCopy={compareCopy}
            comparisonMetrics={comparisonMetrics}
            engineScoresBySlug={engineScoresBySlug}
            left={left}
            leftOverall={leftOverall}
            leftScoreStyle={leftScoreStyle}
            resolvedLeftOptions={resolvedLeftOptions}
            resolvedRightOptions={resolvedRightOptions}
            right={right}
            rightOverall={rightOverall}
            rightScoreStyle={rightScoreStyle}
          />

          <section className="mx-auto max-w-[940px]">
            <CompareScorecardSection
              compareCopy={compareCopy}
              comparisonMetrics={comparisonMetrics}
              criteriaCount={criteriaCount}
              generateWithLabel={generateWithLabel}
              labels={labels}
              left={left}
              leftAccent={leftAccent}
              leftCanGenerate={leftCanGenerate}
              right={right}
              rightAccent={rightAccent}
              rightCanGenerate={rightCanGenerate}
              scorecardCriteriaLabel={scorecardCriteriaLabel}
              scorecardProvisionalNote={scorecardProvisionalNote}
              summaryRows={summaryRows}
              winnerSummaryHeading={winnerSummaryHeading}
            />

            <CompareSpecsSection
              activeLocale={activeLocale}
              compareCopy={compareCopy}
              labels={labels}
              left={left}
              pageOverride={pageOverride}
              pairHasNativeAudio={pairHasNativeAudio}
              right={right}
              specRows={specRows}
            />
          </section>

          <CompareShowdownSection
            activeLocale={activeLocale}
            compareCopy={compareCopy}
            exposeSourcePrompt={exposeSourcePrompt}
            labels={labels}
            left={left}
            leftIsPrelaunch={leftIsPrelaunch}
            localizedPromptNote={localizedPromptNote}
            right={right}
            rightIsPrelaunch={rightIsPrelaunch}
            showdownActionHint={showdownActionHint}
            showdownActionLabel={showdownActionLabel}
            showdownSlots={showdownSlots}
            showdownSubtitle={showdownSubtitle}
            slug={slug}
          />

          <CompareRelatedSection compareCopy={compareCopy} relatedLinks={relatedLinks} />

          <CompareFaqSection
            breadcrumbJsonLd={breadcrumbJsonLd}
            compareCopy={compareCopy}
            faqItems={faqItems}
            faqJsonLd={faqJsonLd}
            left={left}
            pageOverride={pageOverride}
            right={right}
            webPageJsonLd={webPageJsonLd}
          />

          <div className="text-sm text-text-muted">
            <Link href={compareHubHref} className="font-semibold text-brand hover:text-brandHover">
              {compareCopy.hero?.back ?? 'Back to comparisons'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
