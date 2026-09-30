import Link from 'next/link';
import Image from 'next/image';
import { BadgeDollarSign, FilePenLine, Scale } from 'lucide-react';
import { ExamplesGalleryGrid, type ExampleGalleryVideo } from '@/components/examples/ExamplesGalleryGrid';
import { EngineIcon } from '@/components/ui/EngineIcon';
import type { AppLocale } from '@/i18n/locales';
import { getMcpInternalLink } from '@/lib/mcp-internal-links';
import type { ExampleSort } from '@/server/videos';
import type { ExamplesNextStepLink } from '../_lib/examples-page-copy';
import { ENGINE_META } from '../_lib/examples-route-utils';
import styles from './examples-editorial.module.css';

type ExamplesIntroHeroProps = {
  heroLead: string;
  heroSubtitle: string;
  heroTitle: string;
};

type ExamplesFamilyIntroProps = {
  body: string;
  label: string;
  locale: AppLocale;
  title?: string;
};

type ExamplesNextStepsSectionProps = {
  locale: AppLocale;
  nextStepLinks: ExamplesNextStepLink[];
};

type ExamplesModelLink = {
  slug: string;
  label: string;
  href: string;
  engineId: string;
  brandId?: string;
};

type ExamplesModelLinksSectionProps = {
  currentModelPagesLabel: string;
  galleryExamples: ExampleGalleryVideo[];
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
      href: `${pricingPath}#ltx-2-5-fast-pricing`,
      title: locale === 'fr' ? 'Tarifs LTX 2.5' : locale === 'es' ? 'Precios de LTX 2.5' : 'LTX 2.5 pricing',
      body:
        locale === 'fr'
          ? 'Comparez les tarifs actuels LTX 2.5 Fast et Pro selon la durée, la résolution et les options audio.'
          : locale === 'es'
            ? 'Compara los precios actuales de LTX 2.5 Fast y Pro según duración, resolución y opciones de audio.'
            : 'Compare current LTX 2.5 Fast and Pro prices by duration, resolution and audio options.',
    };
  }
  if (normalized === 'kling') {
    return {
      href: `${pricingPath}#kling-o3-pro-pricing`,
      title: locale === 'fr' ? 'Tarifs Kling' : locale === 'es' ? 'Precios de Kling' : 'Kling pricing',
      body:
        locale === 'fr'
          ? 'Comparez Kling 3 et Kling 3.0 Omni selon vos images de départ, la durée et la résolution souhaitées.'
          : locale === 'es'
            ? 'Compara Kling 3 y Kling 3.0 Omni según tus imágenes de referencia, la duración y la resolución.'
            : 'Compare Kling 3 and Kling 3.0 Omni prices for your source images, duration and resolution.',
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
  familyLabel?: string;
  openingEnabled?: boolean;
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
    <section className={styles.hero}>
      <header className={styles.heroCopy}>
        <h1>{heroTitle}</h1>
        <p>{heroSubtitle || heroLead}</p>
      </header>
    </section>
  );
}

export function ExamplesFamilyIntro({ body, label, locale, title }: ExamplesFamilyIntroProps) {
  return (
    <section className={styles.familyIntro} aria-labelledby="examples-family-guide-title">
      <div className={styles.familyIntroHeading}>
        <span className={styles.eyebrow}>
          {locale === 'fr' ? 'Famille de modèles' : locale === 'es' ? 'Familia de modelos' : 'Model family'}
        </span>
        <h2 id="examples-family-guide-title">
          {title ?? (locale === 'fr'
            ? `Explorer la famille ${label}`
            : locale === 'es'
              ? `Explora la familia ${label}`
              : `Explore the ${label} family`)}
        </h2>
      </div>
      <p>{body}</p>
    </section>
  );
}

export function ExamplesModelLinksSection({
  currentModelPagesLabel,
  galleryExamples,
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
  const posterFor = (href: string) => {
    const candidates = galleryExamples.filter(
      (video) => video.modelHref === href && video.rawPosterUrl && !video.rawPosterUrl.startsWith('/assets/frames/')
    );
    return (candidates.find((video) => video.aspectRatio === '16:9') ?? candidates[0])?.rawPosterUrl ?? null;
  };

  return (
    <section className={styles.modelSection} aria-labelledby="examples-model-pages-title">
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.eyebrow}>
            {locale === 'fr' ? 'Les modèles' : locale === 'es' ? 'Los modelos' : 'The models'}
          </span>
          <h2 id="examples-model-pages-title">{usesCurrentAndSupportedBlocks ? currentModelPagesLabel : modelPagesLabel}</h2>
        </div>
        <Link href={pricingPath} className={styles.pricingAction}>
          {pricingLinkLabel}<span aria-hidden="true"> ↗</span>
        </Link>
      </div>
      <div className={styles.modelGrid}>
        {primaryModelLinks.map((model, index) => {
          const poster = posterFor(model.href);
          return (
            <Link key={model.slug} href={model.href} className={`${styles.modelLink} ${poster ? '' : styles.modelLinkFallback}`}>
              {poster ? <Image src={poster} alt="" aria-hidden="true" fill sizes="(max-width: 767px) 50vw, (max-width: 1200px) 33vw, 25vw" quality={52} loading="lazy" className={styles.modelPoster} /> : null}
              {!poster ? <span className={styles.modelWordmark} aria-hidden="true">{model.label.split(' ').slice(-1)[0]}</span> : null}
              <span className={styles.modelIdentity} aria-hidden="true">
                <span className={styles.modelIcon}><EngineIcon engine={{ id: model.engineId, label: model.label, brandId: model.brandId }} size={30} framed={false} /></span>
                <span className={styles.modelIndex}>{String(index + 1).padStart(2, '0')}</span>
              </span>
              <span className={styles.modelBottom}>
                <span className={styles.modelName}>{model.label}</span>
                <span className={styles.linkArrow} aria-hidden="true">↗</span>
              </span>
            </Link>
          );
        })}
      </div>
      {supportedOlderModelLinks.length ? (
        <div className={styles.olderModels}>
          <span className={styles.eyebrow}>{supportedOlderVersionLabel}</span>
          {supportedOlderModelLinks.map((model) => (
            <Link key={model.slug} href={model.href} className={styles.textAction}>
              {model.label}<span aria-hidden="true"> ↗</span>
            </Link>
          ))}
        </div>
      ) : null}
      {pricingCallout ? (
        <div className={styles.pricingCallout}>
          <span>
            <strong>{pricingCallout.title}</strong>
            <span>{pricingCallout.body}</span>
          </span>
          <Link href={pricingCallout.href} className={styles.textAction}>
            {pricingLinkLabel}<span aria-hidden="true"> ↗</span>
          </Link>
        </div>
      ) : null}
    </section>
  );
}

export function ExamplesModelLandingCardsSection({ sections }: ExamplesModelLandingCardsSectionProps) {
  if (!sections?.length) return null;
  const guidanceIcons = [FilePenLine, Scale, BadgeDollarSign];

  return (
    <section className={styles.guidanceGrid}>
      {sections.map((section, index) => {
        const Icon = guidanceIcons[index] ?? FilePenLine;
        return (
          <article key={section.title} className={styles.guidanceItem}>
            <div className={styles.guidanceTop} aria-hidden="true">
              <span className={styles.guidanceIcon}><Icon size={21} strokeWidth={1.7} /></span>
              <span className={styles.guidanceIndex}>{String(index + 1).padStart(2, '0')}</span>
            </div>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </article>
        );
      })}
    </section>
  );
}

export function ExamplesGallerySection({
  familyLabel,
  openingEnabled,
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
  if (!show) return <p className="py-12 text-center text-sm text-text-secondary">{locale==='fr'?'Aucune vidéo disponible dans cette galerie.':locale==='es'?'No hay vídeos disponibles en esta galería.':'No videos are available in this gallery yet.'}</p>;

  return (
    <section id="gallery" className="min-w-0">
      <ExamplesGalleryGrid
        familyLabel={familyLabel}
        openingEnabled={openingEnabled}
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
            prefetch={false}
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
            prefetch={false}
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
    <section className={styles.summary}>
      <p>{modelLandingSummary ?? longDescription}</p>
    </section>
  );
}

export function ExamplesNextStepsSection({ locale, nextStepLinks }: ExamplesNextStepsSectionProps) {
  const mcpLink = getMcpInternalLink(locale, 'examples');
  const comparisonLinks = nextStepLinks.filter(
    (item): item is ExamplesNextStepLink & { comparison: readonly [string, string] } => Boolean(item.comparison)
  );
  const resourceLinks = nextStepLinks.filter((item) => !item.comparison);
  const hasMatchups = comparisonLinks.length > 1;
  return (
    <section className={styles.nextSteps}>
      <div className={styles.sectionHeading}>
        <span className={styles.eyebrow}>
          {locale === 'fr' ? 'Continuer' : locale === 'es' ? 'Continuar' : 'Keep exploring'}
        </span>
        <h2>{hasMatchups
          ? locale === 'fr' ? 'Les duels de modèles' : locale === 'es' ? 'Duelos de modelos' : 'Model matchups'
          : locale === 'fr' ? 'Aller plus loin' : locale === 'es' ? 'Siguientes pasos' : 'Next steps'}</h2>
      </div>
      {comparisonLinks.length ? (
        <div className={styles.comparisonGrid}>
          {comparisonLinks.map((item) => {
            const [leftId, rightId] = item.comparison;
            const left = ENGINE_META.get(leftId);
            const right = ENGINE_META.get(rightId);
            return (
              <Link key={item.href} href={item.href} className={styles.comparisonCard}>
                <span className={styles.comparisonEmblems} aria-hidden="true">
                  <span className={styles.comparisonLogo}><EngineIcon engine={{ id: leftId, label: left?.label ?? leftId, brandId: left?.brandId }} size={36} framed={false} /></span>
                  <span className={styles.comparisonVs}>VS</span>
                  <span className={styles.comparisonLogo}><EngineIcon engine={{ id: rightId, label: right?.label ?? rightId, brandId: right?.brandId }} size={36} framed={false} /></span>
                </span>
                <span className={styles.comparisonBottom}>
                  <span>{item.label}</span>
                  <span className={styles.comparisonArrow} aria-hidden="true">↗</span>
                </span>
              </Link>
            );
          })}
        </div>
      ) : null}
      <div className={styles.resourceGrid}>
        {resourceLinks.map((item) => {
          const model = item.modelSlug ? ENGINE_META.get(item.modelSlug) : null;
          return <Link key={item.href} href={item.href} className={styles.resourceLink}>
            <span className={styles.resourceIdentity}>
              {item.modelSlug ? <span className={styles.resourceLogo} aria-hidden="true">
                <EngineIcon engine={{ id: model?.id ?? item.modelSlug, label: model?.label ?? item.label, brandId: model?.brandId }} size={24} framed={false} />
              </span> : null}
              <span>{item.label}</span>
            </span>
            <span aria-hidden="true">↗</span>
          </Link>;
        })}
        {mcpLink ? (
          <Link href={mcpLink.href} className={styles.resourceLink}>
            <span>{mcpLink.label}</span><span aria-hidden="true">↗</span>
          </Link>
        ) : null}
      </div>
    </section>
  );
}

export function ExamplesFaqSection({ faqBlock }: ExamplesFaqSectionProps) {
  if (!faqBlock.items.length) return null;

  return (
    <section className={styles.faq}>
      <div className={styles.sectionHeading}>
        <span className={styles.eyebrow}>FAQ</span>
        <h2>{faqBlock.title}</h2>
      </div>
      <div className={styles.faqList}>
        {faqBlock.items.map((item) => (
          <details key={item.question} className={styles.faqItem}>
            <summary>{item.question}<span aria-hidden="true">+</span></summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
