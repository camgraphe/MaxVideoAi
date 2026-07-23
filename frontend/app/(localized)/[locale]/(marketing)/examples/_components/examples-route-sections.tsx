import Link from 'next/link';
import { ExamplesGalleryGrid, type ExampleGalleryVideo } from '@/components/examples/ExamplesGalleryGrid';
import type { AppLocale } from '@/i18n/locales';
import type { ExampleSort } from '@/server/videos';

type ExamplesIntroHeroProps = {
  heroLead: string;
  heroSubtitle: string;
  heroTitle: string;
};

type ExamplesNextStepsSectionProps = {
  locale: AppLocale;
  nextStepLinks: Array<{
    href: string;
    label: string;
  }>;
};

type ExamplesModelLink = {
  slug: string;
  label: string;
  href: string;
};

type ExamplesModelLinksSectionProps = {
  currentModelPagesLabel: string;
  isModelLanding: boolean;
  locale: AppLocale;
  modelLinks: ExamplesModelLink[];
  modelPagesLabel: string;
  pricingLinkLabel: string;
  pricingPath: string;
  primaryModelLinks: ExamplesModelLink[];
  selectedEngine: string | null;
  supportedOlderModelLinks: ExamplesModelLink[];
  supportedOlderVersionLabel: string;
  usesCurrentAndSupportedBlocks: boolean;
};

function resolveExamplesPricingCallout(selectedEngine: string | null, locale: AppLocale, pricingPath: string) {
  const normalized = selectedEngine?.toLowerCase() ?? '';
  if (normalized === 'ltx') {
    return {
      href: `${pricingPath}#ltx-2-3-fast-pricing`,
      title: locale === 'fr' ? 'Tarifs LTX 2.3' : locale === 'es' ? 'Precios de LTX 2.3' : 'LTX 2.3 pricing',
      body:
        locale === 'fr'
          ? 'Comparez les coûts LTX 2.3 Fast et Pro pour 8 s, 10 s, 1080p et les routes 4K.'
          : locale === 'es'
            ? 'Compara costes de LTX 2.3 Fast y Pro para 8 s, 10 s, 1080p y rutas 4K.'
            : 'Compare LTX 2.3 Fast and Pro costs for 8s, 10s, 1080p and 4K routes.',
    };
  }
  if (normalized === 'kling') {
    return {
      href: `${pricingPath}#kling-o3-pro-pricing`,
      title: locale === 'fr' ? 'Tarifs Kling' : locale === 'es' ? 'Precios de Kling' : 'Kling pricing',
      body:
        locale === 'fr'
          ? 'Comparez les prix Kling 3.0 Omni Standard, Pro et 4K avec les routes Kling 3 start-frame encore prises en charge.'
          : locale === 'es'
            ? 'Compara precios de Kling 3.0 Omni Standard, Pro y 4K con las rutas Kling 3 start-frame aún compatibles.'
            : 'Compare Kling 3.0 Omni Standard, Pro and 4K pricing with the supported Kling 3 start-frame routes.',
    };
  }
  return null;
}

type ExamplesModelLandingCardsSectionProps = {
  sections:
    | Array<{
        title: string;
        body: string;
      }>
    | undefined;
};

type ExamplesGallerySectionProps = {
  audioAvailableLabel: string;
  detailsCtaLabel: string;
  engineFilter: string | null;
  initialDesktopBatch: number;
  initialExamples: ExampleGalleryVideo[];
  initialMobileBatch: number;
  initialOffset: number;
  loadMoreLabel: string;
  loadingLabel: string;
  locale: string;
  noPreviewLabel: string;
  pageOffsetEnd: number;
  prioritizeFirstPoster: boolean;
  show: boolean;
  sort: ExampleSort;
};

type ExamplesPaginationHref = string | { pathname: '/examples'; query?: Record<string, string> };

type ExamplesPaginationNavProps = {
  currentPage: number;
  displayTotalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextHref: ExamplesPaginationHref;
  nextLabel: string;
  pageLabel: string;
  previousHref: ExamplesPaginationHref;
  previousLabel: string;
  show: boolean;
};

type ExamplesSummarySectionProps = {
  longDescription: string;
  modelLandingSummary?: string;
};

type ExamplesFaqSectionProps = {
  faqBlock: {
    title: string;
    items: Array<{
      question: string;
      answer: string;
    }>;
  };
};

export function ExamplesIntroHero({ heroLead, heroSubtitle, heroTitle }: ExamplesIntroHeroProps) {
  return (
    <section className="halo-hero stack-gap-sm text-center sm:stack-gap-md">
      <header className="mx-auto max-w-3xl stack-gap-sm text-center">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-5xl">{heroTitle}</h1>
        <p className="text-base leading-relaxed text-text-secondary">{heroSubtitle}</p>
        <p className="mx-auto max-w-2xl text-sm leading-relaxed text-text-secondary/90">{heroLead}</p>
      </header>
    </section>
  );
}

export function ExamplesModelLinksSection({
  currentModelPagesLabel,
  isModelLanding,
  locale,
  modelLinks,
  modelPagesLabel,
  pricingLinkLabel,
  pricingPath,
  primaryModelLinks,
  selectedEngine,
  supportedOlderModelLinks,
  supportedOlderVersionLabel,
  usesCurrentAndSupportedBlocks,
}: ExamplesModelLinksSectionProps) {
  if (!isModelLanding || !selectedEngine || !modelLinks.length) return null;
  const pricingCallout = resolveExamplesPricingCallout(selectedEngine, locale, pricingPath);

  return (
    <section className="mx-auto max-w-5xl">
      <div className="flex flex-col items-center gap-3 text-sm text-text-secondary">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">
            {usesCurrentAndSupportedBlocks ? currentModelPagesLabel : modelPagesLabel}
          </span>
          {primaryModelLinks.map((model) => (
            <Link key={model.slug} href={model.href} className="font-semibold text-brand hover:text-brandHover">
              {model.label}
            </Link>
          ))}
          <Link href={pricingPath} className="font-semibold text-brand hover:text-brandHover">
            {pricingLinkLabel}
          </Link>
        </div>
        {supportedOlderModelLinks.length ? (
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">
              {supportedOlderVersionLabel}
            </span>
            {supportedOlderModelLinks.map((model) => (
              <Link key={model.slug} href={model.href} className="font-semibold text-brand hover:text-brandHover">
                {model.label}
              </Link>
            ))}
          </div>
        ) : null}
        {pricingCallout ? (
          <div className="flex w-full flex-col gap-2 rounded-[10px] border border-hairline bg-surface/75 px-4 py-3 text-left shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <span>
              <span className="block text-sm font-semibold text-text-primary">{pricingCallout.title}</span>
              <span className="mt-1 block text-xs leading-5 text-text-secondary">{pricingCallout.body}</span>
            </span>
            <Link href={pricingCallout.href} className="shrink-0 text-sm font-semibold text-brand hover:text-brandHover">
              {pricingLinkLabel}
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function ExamplesModelLandingCardsSection({ sections }: ExamplesModelLandingCardsSectionProps) {
  if (!sections?.length) return null;

  return (
    <section className="grid gap-3 md:grid-cols-3">
      {sections.map((section) => (
        <article
          key={section.title}
          className="rounded-[20px] border border-hairline/80 bg-surface/85 px-4 py-4 text-left shadow-sm"
        >
          <div className="min-w-0">
            <h2 className="text-sm font-semibold leading-tight text-text-primary">{section.title}</h2>
            <p
              className="mt-2 text-xs leading-relaxed text-text-secondary/90"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {section.body}
            </p>
          </div>
        </article>
      ))}
    </section>
  );
}

export function ExamplesGallerySection({
  audioAvailableLabel,
  detailsCtaLabel,
  engineFilter,
  initialDesktopBatch,
  initialExamples,
  initialMobileBatch,
  initialOffset,
  loadMoreLabel,
  loadingLabel,
  locale,
  noPreviewLabel,
  pageOffsetEnd,
  prioritizeFirstPoster,
  show,
  sort,
}: ExamplesGallerySectionProps) {
  if (!show) return null;

  return (
    <section className="overflow-hidden rounded-[12px] border border-hairline bg-surface/80 shadow-card">
      <ExamplesGalleryGrid
        detailsCtaLabel={detailsCtaLabel}
        initialExamples={initialExamples}
        loadMoreLabel={loadMoreLabel}
        loadingLabel={loadingLabel}
        noPreviewLabel={noPreviewLabel}
        prioritizeFirstPoster={prioritizeFirstPoster}
        audioAvailableLabel={audioAvailableLabel}
        initialDesktopBatch={initialDesktopBatch}
        initialMobileBatch={initialMobileBatch}
        sort={sort}
        engineFilter={engineFilter}
        initialOffset={initialOffset}
        pageOffsetEnd={pageOffsetEnd}
        locale={locale}
      />
    </section>
  );
}

export function ExamplesPaginationNav({
  currentPage,
  displayTotalPages,
  hasNextPage,
  hasPreviousPage,
  nextHref,
  nextLabel,
  pageLabel,
  previousHref,
  previousLabel,
  show,
}: ExamplesPaginationNavProps) {
  if (!show) return null;

  return (
    <nav className="flex flex-col items-center justify-between gap-4 rounded-[24px] border border-hairline bg-surface/70 px-4 py-4 text-sm text-text-secondary sm:flex-row">
      <div>
        {hasPreviousPage ? (
          <Link
            href={previousHref}
            rel="prev"
            className="inline-flex items-center rounded-full border border-hairline px-3 py-1 font-medium text-text-primary transition hover:border-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            ← {previousLabel}
          </Link>
        ) : (
          <span className="inline-flex items-center rounded-full border border-dashed border-hairline px-3 py-1 text-text-muted">
            ← {previousLabel}
          </span>
        )}
      </div>
      <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">
        {pageLabel} {currentPage} / {displayTotalPages}
      </span>
      <div>
        {hasNextPage ? (
          <Link
            href={nextHref}
            rel="next"
            className="inline-flex items-center rounded-full border border-hairline px-3 py-1 font-medium text-text-primary transition hover:border-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {nextLabel} →
          </Link>
        ) : (
          <span className="inline-flex items-center rounded-full border border-dashed border-hairline px-3 py-1 text-text-muted">
            {nextLabel} →
          </span>
        )}
      </div>
    </nav>
  );
}

export function ExamplesSummarySection({ longDescription, modelLandingSummary }: ExamplesSummarySectionProps) {
  return (
    <section className="max-w-4xl text-sm leading-relaxed text-text-secondary/90">
      <p>{modelLandingSummary ?? longDescription}</p>
    </section>
  );
}

export function ExamplesNextStepsSection({ locale, nextStepLinks }: ExamplesNextStepsSectionProps) {
  return (
    <section className="rounded-[16px] border border-hairline bg-surface/80 px-5 py-5 shadow-card">
      <h2 className="text-lg font-semibold text-text-primary">
        {locale === 'fr' ? 'Aller plus loin' : locale === 'es' ? 'Siguientes pasos' : 'Next steps'}
      </h2>
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        {nextStepLinks.map((item) => (
          <Link key={item.label} href={item.href} className="font-semibold text-brand hover:text-brandHover">
            {item.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

export function ExamplesFaqSection({ faqBlock }: ExamplesFaqSectionProps) {
  if (!faqBlock.items.length) return null;

  return (
    <section className="rounded-[16px] border border-hairline bg-surface/80 px-5 py-5 shadow-card">
      <h2 className="text-lg font-semibold text-text-primary">{faqBlock.title}</h2>
      <div className="mt-4 space-y-3">
        {faqBlock.items.map((item) => (
          <details key={item.question} className="rounded-lg border border-hairline bg-surface px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-text-primary">{item.question}</summary>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
