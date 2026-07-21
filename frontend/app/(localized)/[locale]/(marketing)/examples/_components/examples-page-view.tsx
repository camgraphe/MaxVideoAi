import clsx from 'clsx';
import type { ExampleGalleryVideo } from '@/components/examples/ExamplesGalleryGrid';
import type { AppLocale } from '@/i18n/locales';
import type { ExampleSort, listExamplesPage } from '@/server/videos';
import type { ExamplesModelLink } from '../_lib/examples-page-data';
import type { EngineFilterOption } from '../_lib/examples-route-utils';
import { ExamplesEngineFilterNav } from './examples-engine-filter-nav';
import { ExamplesJsonLdScripts } from './examples-jsonld-scripts';
import { ExamplesMainVideoFeature } from './examples-main-video-feature';
import {
  ExamplesFaqSection,
  ExamplesGallerySection,
  ExamplesIntroHero,
  ExamplesModelLandingCardsSection,
  ExamplesModelLinksSection,
  ExamplesNextStepsSection,
  ExamplesPaginationNav,
  ExamplesSummarySection,
} from './examples-route-sections';

type ExampleRouteVideo = Awaited<ReturnType<typeof listExamplesPage>>['items'][number];
type ExamplesPaginationHref = string | { pathname: '/examples'; query?: Record<string, string> };

type ExamplesPageViewProps = {
  browseByModelLabel: string;
  breadcrumbJsonLd: unknown;
  currentModelPagesLabel: string;
  currentPage: number;
  displayTotalPages: number;
  engineFilterAllLabel: string;
  engineFilterOptions: EngineFilterOption[];
  faqBlock: {
    title: string;
    items: Array<{
      question: string;
      answer: string;
    }>;
  };
  faqJsonLd: unknown;
  galleryUiCopy: {
    audioAvailable: string;
    detailsCta: string;
    loading: string;
    noPreview: string;
  };
  getEngineFilterHref: (engineId: string | null) => string;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  heroBody: string;
  heroLead: string;
  heroSubtitle: string;
  heroTitle: string;
  initialDesktopBatch: number;
  initialExamples: ExampleGalleryVideo[];
  initialMobileBatch: number;
  isModelLanding: boolean;
  itemListJson: unknown;
  loadMoreLabel: string;
  locale: AppLocale;
  longDescription: string;
  mainVideo: {
    video: ExampleRouteVideo;
    card: ExampleGalleryVideo;
  } | null;
  mainVideoCopy: {
    audioOn: string;
    fullPrompt: string;
    openExample: string;
    openWatchPage: string;
    preview: string;
  };
  mainVideoFeature: {
    aspectRatio: string;
    contentUrl: string | null;
    heroLine: string | null;
    isPortrait: boolean;
    mimeType: string;
    poster: string | null;
    promptFull: string | null;
    title: string;
  };
  modelLandingSections?: Array<{
    title: string;
    body: string;
  }>;
  modelLandingSummary?: string;
  modelLinks: ExamplesModelLink[];
  modelPagesLabel: string;
  nextHref: ExamplesPaginationHref;
  nextLabel: string;
  nextOffsetStart: number;
  nextStepLinks: Array<{
    href: string;
    label: string;
  }>;
  pageLabel: string;
  pageOffsetEnd: number;
  previousHref: ExamplesPaginationHref;
  previousLabel: string;
  pricingLinkLabel: string;
  pricingPath: string;
  primaryModelLinks: ExamplesModelLink[];
  selectedEngine: string | null;
  showGallerySection: boolean;
  sort: ExampleSort;
  supportedOlderModelLinks: ExamplesModelLink[];
  supportedOlderVersionLabel: string;
  totalPages: number;
  usesCurrentAndSupportedBlocks: boolean;
};

export function ExamplesPageView({
  browseByModelLabel,
  breadcrumbJsonLd,
  currentModelPagesLabel,
  currentPage,
  displayTotalPages,
  engineFilterAllLabel,
  engineFilterOptions,
  faqBlock,
  faqJsonLd,
  galleryUiCopy,
  getEngineFilterHref,
  hasNextPage,
  hasPreviousPage,
  heroBody,
  heroLead,
  heroSubtitle,
  heroTitle,
  initialDesktopBatch,
  initialExamples,
  initialMobileBatch,
  isModelLanding,
  itemListJson,
  loadMoreLabel,
  locale,
  longDescription,
  mainVideo,
  mainVideoCopy,
  mainVideoFeature,
  modelLandingSections,
  modelLandingSummary,
  modelLinks,
  modelPagesLabel,
  nextHref,
  nextLabel,
  nextOffsetStart,
  nextStepLinks,
  pageLabel,
  pageOffsetEnd,
  previousHref,
  previousLabel,
  pricingLinkLabel,
  pricingPath,
  primaryModelLinks,
  selectedEngine,
  showGallerySection,
  sort,
  supportedOlderModelLinks,
  supportedOlderVersionLabel,
  totalPages,
  usesCurrentAndSupportedBlocks,
}: ExamplesPageViewProps) {
  return (
    <>
      <ExamplesEngineFilterNav
        browseByModelLabel={browseByModelLabel}
        engineFilterAllLabel={engineFilterAllLabel}
        engineFilterOptions={engineFilterOptions}
        getEngineFilterHref={getEngineFilterHref}
        selectedEngine={selectedEngine}
      />

      <div
        className={clsx(
          'container-page max-w-7xl',
          engineFilterOptions.length ? 'pb-[var(--section-padding-y)] pt-4 sm:pt-6' : 'section'
        )}
      >
        <div className="stack-gap-lg">
          <ExamplesIntroHero heroLead={heroLead} heroSubtitle={heroSubtitle} heroTitle={heroTitle} />

          {mainVideo && mainVideoFeature.contentUrl ? (
            <ExamplesMainVideoFeature
              aspectRatio={mainVideoFeature.aspectRatio}
              contentUrl={mainVideoFeature.contentUrl}
              copy={mainVideoCopy}
              durationSec={mainVideo.video.durationSec}
              engineLabel={mainVideo.card.engineLabel}
              exampleHref={mainVideo.card.href}
              hasAudio={mainVideo.video.hasAudio}
              heroLine={mainVideoFeature.heroLine}
              isPortrait={mainVideoFeature.isPortrait}
              locale={locale}
              mimeType={mainVideoFeature.mimeType}
              modelHref={mainVideo.card.modelHref ?? null}
              poster={mainVideoFeature.poster ?? null}
              promptFull={mainVideoFeature.promptFull}
              title={mainVideoFeature.title}
            />
          ) : null}

          <ExamplesModelLinksSection
            currentModelPagesLabel={currentModelPagesLabel}
            isModelLanding={isModelLanding}
            locale={locale}
            modelLinks={modelLinks}
            modelPagesLabel={modelPagesLabel}
            pricingLinkLabel={pricingLinkLabel}
            pricingPath={pricingPath}
            primaryModelLinks={primaryModelLinks}
            selectedEngine={selectedEngine}
            supportedOlderModelLinks={supportedOlderModelLinks}
            supportedOlderVersionLabel={supportedOlderVersionLabel}
            usesCurrentAndSupportedBlocks={usesCurrentAndSupportedBlocks}
          />

          <ExamplesModelLandingCardsSection sections={modelLandingSections} />

          <ExamplesGallerySection
            audioAvailableLabel={galleryUiCopy.audioAvailable}
            detailsCtaLabel={galleryUiCopy.detailsCta}
            engineFilter={selectedEngine?.toLowerCase() ?? null}
            initialDesktopBatch={initialDesktopBatch}
            initialExamples={initialExamples}
            initialMobileBatch={initialMobileBatch}
            initialOffset={nextOffsetStart}
            loadMoreLabel={loadMoreLabel}
            loadingLabel={galleryUiCopy.loading}
            locale={locale}
            noPreviewLabel={galleryUiCopy.noPreview}
            pageOffsetEnd={pageOffsetEnd}
            show={showGallerySection}
            sort={sort}
          />

          {isModelLanding && heroLead !== heroBody ? (
            <section className="mx-auto max-w-4xl text-sm leading-relaxed text-text-secondary/90">
              <p>{heroBody}</p>
            </section>
          ) : null}

          <ExamplesPaginationNav
            currentPage={currentPage}
            displayTotalPages={displayTotalPages}
            hasNextPage={hasNextPage}
            hasPreviousPage={hasPreviousPage}
            nextHref={nextHref}
            nextLabel={nextLabel}
            pageLabel={pageLabel}
            previousHref={previousHref}
            previousLabel={previousLabel}
            show={totalPages > 1}
          />

          <ExamplesSummarySection longDescription={longDescription} modelLandingSummary={modelLandingSummary} />

          <ExamplesNextStepsSection locale={locale} nextStepLinks={nextStepLinks} />

          <ExamplesFaqSection faqBlock={faqBlock} />
        </div>

        <ExamplesJsonLdScripts
          breadcrumbJsonLd={breadcrumbJsonLd}
          faqJsonLd={faqJsonLd}
          itemListJson={itemListJson}
        />
      </div>
    </>
  );
}
