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
import type { ComparePricingDisplay, EngineCatalogEntry } from '../_lib/compare-page-types';
import { CompareDetailHero } from './CompareDetailHero';
import { CompareEngineHeroCards } from './CompareEngineHeroCards';
import { CompareFaqSection } from './CompareFaqSection';
import { ComparePricingQuickSection } from './ComparePricingQuickSection';
import { CompareRelatedSection } from './CompareRelatedSection';
import { CompareScorecardSection } from './CompareScorecardSection';
import { CompareModelGalleries } from './CompareModelGalleries';
import type { CompareGalleryVideo } from '../_lib/compare-gallery-data';
import { CompareSpecsSection } from './CompareSpecsSection';

type CompareDetailContentProps = {
  galleries: { left: CompareGalleryVideo[]; right: CompareGalleryVideo[] };
  returnPath: string;
  activeLocale: AppLocale;
  breadcrumbJsonLd: unknown;
  compareCopy: ComparePageCopy;
  compareHubHref: string;
  comparisonMetrics: CompareMetric[];
  criteriaCount: number;
  engineScoresBySlug: Record<string, number>;
  faqItems: CompareFaqItem[];
  faqJsonLd: unknown;
  generateWithLabel: string;
  heroIntroTemplate: string;
  labels: CompareDetailLabels;
  left: EngineCatalogEntry;
  leftAccent: EngineAccent;
  leftCanGenerate: boolean;
  leftOverall: number | null;
  leftPricingDisplay: ComparePricingDisplay;
  leftScoreStyle: CSSProperties;
  pageOverride?: ComparePageOverride | null;
  pairHasNativeAudio: boolean;
  prelaunchNotice: { title: string; body: string } | null;
  relatedLinks: RelatedComparisonLink[];
  resolvedLeftOptions: SelectOption[];
  resolvedRightOptions: SelectOption[];
  right: EngineCatalogEntry;
  rightAccent: EngineAccent;
  rightCanGenerate: boolean;
  rightOverall: number | null;
  rightPricingDisplay: ComparePricingDisplay;
  rightScoreStyle: CSSProperties;
  scorecardCriteriaLabel: string;
  scorecardProvisionalNote: string | null;
  specRows: CompareSpecRow[];
  summaryRows: CompareSummaryRow[];
  webPageJsonLd: unknown;
  winnerSummaryHeading: string;
};

export function CompareDetailContent({
  galleries, returnPath,
  activeLocale,
  breadcrumbJsonLd,
  compareCopy,
  compareHubHref,
  comparisonMetrics,
  criteriaCount,
  engineScoresBySlug,
  faqItems,
  faqJsonLd,
  generateWithLabel,
  heroIntroTemplate,
  labels,
  left,
  leftAccent,
  leftCanGenerate,
  leftOverall,
  leftPricingDisplay,
  leftScoreStyle,
  pageOverride,
  pairHasNativeAudio,
  prelaunchNotice,
  relatedLinks,
  resolvedLeftOptions,
  resolvedRightOptions,
  right,
  rightAccent,
  rightCanGenerate,
  rightOverall,
  rightPricingDisplay,
  rightScoreStyle,
  scorecardCriteriaLabel,
  scorecardProvisionalNote,
  specRows,
  summaryRows,
  webPageJsonLd,
  winnerSummaryHeading,
}: CompareDetailContentProps) {
  return (
    <div className="compare-editorial relative isolate">
      <div className="container-page max-w-[1280px] section">
        <div className="space-y-4 sm:space-y-5">
          <CompareDetailHero
            activeLocale={activeLocale}
            compareCopy={compareCopy}
            compareHubHref={compareHubHref}
            heroIntroTemplate={heroIntroTemplate}
            left={left}
            pageOverride={pageOverride}
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

          <CompareModelGalleries locale={activeLocale} left={left} right={right} galleries={galleries} returnPath={returnPath} />
          <section className="mx-auto max-w-[940px]">
            <CompareScorecardSection
              activeLocale={activeLocale}
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
            <ComparePricingQuickSection
              activeLocale={activeLocale}
              left={left}
              leftPricingDisplay={leftPricingDisplay}
              right={right}
              rightPricingDisplay={rightPricingDisplay}
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
          <CompareRelatedSection compareCopy={compareCopy} locale={activeLocale} relatedLinks={relatedLinks} />
          <CompareFaqSection
            activeLocale={activeLocale}
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
