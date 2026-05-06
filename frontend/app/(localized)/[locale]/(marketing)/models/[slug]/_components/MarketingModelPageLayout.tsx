import { Link, type LocalizedLinkHref } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { localePathnames, localeRegions } from '@/i18n/locales';
import type { FalEngineEntry } from '@/config/falEngines';
import type { EngineLocalizedContent } from '@/lib/models/i18n';
import { getLocalizedModelMetaLabels } from '@/lib/ltx-localization';
import { dedupeAltsInList, getImageAlt, inferRenderTag } from '@/lib/image-alt';
import { getExamplesHref } from '@/lib/examples-links';
import type { ExampleGalleryVideo } from '@/components/examples/ExamplesGalleryGrid';
import { FAQSchema } from '@/components/seo/FAQSchema';
import { TextLink } from '@/components/ui/TextLink';
import { ResponsiveDetails } from '@/components/ui/ResponsiveDetails.client';
import { serializeJsonLd } from '../../model-jsonld';
import { ModelHeroSection } from './ModelHeroSection';
import { ModelPageToc } from './ModelPageToc';
import { ModelPromptingSection } from './ModelPromptingSection';
import { ModelPrepLinksSection } from './ModelPrepLinksSection';
import { ModelSpecsSection } from './ModelSpecsSection';
import { ModelTipsSection } from './ModelTipsSection';
import { ModelExamplesSection } from './ModelExamplesSection';
import {
  DEFAULT_DETAIL_COPY,
  DEFAULT_GENERIC_SAFETY,
  buildVideoBoundaries,
  getDefaultVideoTroubleshooting,
  type DetailCopy,
} from '../_lib/model-page-copy';
import { type FeaturedMedia } from '../_lib/model-page-media';
import { buildProductSchema, resolveProviderInfo } from '../_lib/model-page-schema';
import { resolveFocusVsConfig } from '../_lib/model-page-static';
import {
  buildCanonicalComparePath,
  CANONICAL_ONLY_COMPARE_SLUGS,
  COMPARE_BASE_PATH_MAP,
  COMPARE_EXCLUDED_SLUGS,
  getDefaultSecondaryModelHref,
  MODELS_BASE_PATH_MAP,
  resolveExamplesHrefFromRaw,
  resolveNonLocalizedHref,
  SITE,
  toAbsoluteUrl,
} from '../_lib/model-page-links';
import {
  FULL_BLEED_SECTION,
  GENERIC_TRUST_LINE,
  SECTION_BG_A,
  SECTION_BG_B,
  SECTION_PAD,
  SECTION_SCROLL_MARGIN,
  TIPS_CARD_LABELS,
  buildAutoHeroSpecChips,
  buildAutoSpecSections,
  buildSupportLine,
  buildEyebrow,
  isSupported,
  normalizeBestUseCaseItems,
  normalizeHeroSubtitle,
  normalizeHeroTitle,
  normalizeSecondaryCta,
  normalizeSpecNote,
  normalizeSpecTitle,
  resolveAudioPricingLabels,
  resolveCompareCopy,
  resolveHeroLimitsLine,
  resolveSectionLabels,
  resolveSpecRowLabel,
  resolveSpecStatusLabels,
  type KeySpecRow,
  type KeySpecValues,
  type LocalizedFaqEntry,
  type SoraCopy,
} from '../_lib/model-page-specs';

export function MarketingModelPageLayout({
  engine,
  backLabel,
  pricingLinkLabel,
  localizedContent,
  copy,
  isVideoEngine,
  isImageEngine,
  heroMedia,
  demoMedia,
  galleryVideos,
  galleryCtaHref,
  compareEngines,
  faqEntries,
  keySpecRows,
  keySpecValues,
  pricePerImageLabel,
  pricePerSecondLabel,
  engineSlug,
  locale,
  canonicalUrl,
  localizedCanonicalUrl,
  breadcrumb,
}: {
  engine: FalEngineEntry;
  backLabel: string;
  pricingLinkLabel: string;
  localizedContent: EngineLocalizedContent;
  copy: SoraCopy;
  isVideoEngine: boolean;
  isImageEngine: boolean;
  heroMedia: FeaturedMedia;
  demoMedia: FeaturedMedia | null;
  galleryVideos: ExampleGalleryVideo[];
  galleryCtaHref: string;
  compareEngines: FalEngineEntry[];
  faqEntries: LocalizedFaqEntry[];
  keySpecRows: KeySpecRow[];
  keySpecValues: KeySpecValues | null;
  pricePerImageLabel: string | null;
  pricePerSecondLabel: string | null;
  engineSlug: string;
  locale: AppLocale;
  canonicalUrl: string;
  localizedCanonicalUrl: string;
  breadcrumb: DetailCopy['breadcrumb'];
}) {
  const inLanguage = localeRegions[locale] ?? 'en-US';
  const resolvedBreadcrumb = breadcrumb ?? DEFAULT_DETAIL_COPY.breadcrumb;
  const canonical = canonicalUrl.replace(/\/+$/, '') || canonicalUrl;
  const localizedCanonical = localizedCanonicalUrl.replace(/\/+$/, '') || localizedCanonicalUrl;
  const localePathPrefix = localePathnames[locale] ? `/${localePathnames[locale].replace(/^\/+/, '')}` : '';
  const homePathname = localePathPrefix || '/';
  const localizedHomeUrl = homePathname === '/' ? `${SITE}/` : `${SITE}${homePathname}`;
  const localizedModelsSlug = (MODELS_BASE_PATH_MAP[locale] ?? 'models').replace(/^\/+/, '');
  const modelsPathname =
    homePathname === '/'
      ? `/${localizedModelsSlug}`
      : `${homePathname.replace(/\/+$/, '')}/${localizedModelsSlug}`.replace(/\/{2,}/g, '/');
  const localizedModelsUrl = `${SITE}${modelsPathname}`;
  const providerName = resolveProviderInfo(engine).name;
  const rawHeroTitle = copy.heroTitle ?? localizedContent.hero?.title ?? localizedContent.marketingName ?? 'Sora 2';
  const heroTitle = normalizeHeroTitle(rawHeroTitle, providerName);
  const rawHeroSubtitle = copy.heroSubtitle ?? localizedContent.hero?.intro ?? localizedContent.overview ?? '';
  const heroSubtitle = normalizeHeroSubtitle(rawHeroSubtitle, locale);
  const heroBadge = copy.heroBadge ?? localizedContent.hero?.badge ?? null;
  const heroDesc1 = copy.heroDesc1 ?? localizedContent.overview ?? localizedContent.seo.description ?? null;
  const heroDesc2 = copy.heroDesc2;
  const heroSpecChips = copy.heroSpecChips.length ? copy.heroSpecChips : buildAutoHeroSpecChips(keySpecValues, locale);
  const heroLimitsLine = isVideoEngine ? resolveHeroLimitsLine(locale) : null;
  const heroMetaLabels = getLocalizedModelMetaLabels(locale);
  const heroTrustLine =
    locale === 'en'
      ? (engine.modelSlug === 'seedance-2-0' ? copy.heroTrustLine : null) ?? GENERIC_TRUST_LINE
      : copy.heroTrustLine;
  const specTitle = normalizeSpecTitle(copy.specTitle, locale);
  const specNote = normalizeSpecNote(copy.specNote, locale);
  const showHeroDescriptions = heroSpecChips.length === 0;
  const heroPrice = isImageEngine
    ? keySpecValues?.pricePerImage ?? pricePerImageLabel ?? 'Data pending'
    : keySpecValues?.pricePerSecond ?? pricePerSecondLabel ?? 'Data pending';
  const heroDuration =
    typeof heroMedia.durationSec === 'number'
      ? `${heroMedia.durationSec}s`
      : keySpecValues?.maxDuration ?? 'Data pending';
  const heroFormat = heroMedia.aspectRatio ?? keySpecValues?.aspectRatios ?? 'Data pending';
  const heroResolution = keySpecValues?.maxResolution ?? 'Data pending';
  const heroOutputFormat = keySpecValues?.outputFormats ?? 'Data pending';
  const heroMetaLines = (
    isImageEngine
      ? [
          { label: heroMetaLabels.price, value: heroPrice },
          { label: resolveSpecRowLabel(locale, 'maxResolution', true), value: heroResolution },
          { label: heroMetaLabels.format, value: heroOutputFormat },
        ]
      : [
          { label: heroMetaLabels.price, value: heroPrice },
          { label: heroMetaLabels.duration, value: heroDuration },
          { label: heroMetaLabels.format, value: heroFormat },
        ]
  ).filter((line) => Boolean(line.value));
  const isEsLocale = locale === 'es';
  const modelsBase = (MODELS_BASE_PATH_MAP[locale] ?? 'models').replace(/^\/+|\/+$/g, '');
  const localizeModelsPath = (targetSlug?: string) => {
    const slugPart = targetSlug ? `/${targetSlug.replace(/^\/+/, '')}` : '';
    return `/${modelsBase}${slugPart}`.replace(/\/{2,}/g, '/');
  };
  const compareBase = (COMPARE_BASE_PATH_MAP[locale] ?? 'ai-video-engines').replace(/^\/+|\/+$/g, '');
  const localizeComparePath = (pairSlug: string, orderSlug?: string) => {
    return buildCanonicalComparePath({ compareBase, pairSlug, orderSlug });
  };
  const galleryEngineSlug = engineSlug;
  const examplesLinkHref = getExamplesHref(galleryEngineSlug) ?? { pathname: '/examples' };
  const pricingLinkHref = { pathname: '/pricing' };
  const primaryCta = copy.primaryCta ?? localizedContent.hero?.ctaPrimary?.label ?? 'Start generating';
  const primaryCtaHref = copy.primaryCtaHref ?? localizedContent.hero?.ctaPrimary?.href ?? '/app?engine=seedance-2-0';
  const secondaryCta = normalizeSecondaryCta(copy.secondaryCta);
  const secondaryCtaHref = copy.secondaryCtaHref ?? getDefaultSecondaryModelHref(engine.modelSlug);
  const audioBadgeLabel = resolveAudioPricingLabels(locale).on;
  const resolvedPrimaryCta = primaryCta;
  const normalizeCtaHref = (href?: string | null): LocalizedLinkHref | null => {
    if (!href) return null;
    const examplesHref = resolveExamplesHrefFromRaw(href);
    if (examplesHref) return examplesHref;
    const nonLocalizedHref = resolveNonLocalizedHref(href);
    if (nonLocalizedHref) return nonLocalizedHref;
    if (href.startsWith('/models')) {
      return localizeModelsPath(href.replace(/^\/models\/?/, ''));
    }
    return href;
  };
  const normalizedPrimaryCtaHref = normalizeCtaHref(primaryCtaHref) ?? primaryCtaHref;
  const localizedSecondaryCtaHref = normalizeCtaHref(secondaryCtaHref);
  const heroQuickLinkModels = new Set([
    'seedance-1-5-pro',
    'seedance-2-0',
    'seedance-2-0-fast',
    'kling-3-pro',
    'kling-3-standard',
    'kling-2-6-pro',
    'kling-2-5-turbo',
    'veo-3-1',
    'veo-3-1-fast',
    'veo-3-1-lite',
    'ltx-2-3-pro',
    'ltx-2-3-fast',
    'ltx-2',
    'ltx-2-fast',
  ]);
  const heroQuickLinks = heroQuickLinkModels.has(engine.modelSlug)
    ? (localizedContent.hero?.secondaryLinks ?? [])
        .slice(1)
        .flatMap((link) => {
          const label = typeof link?.label === 'string' ? link.label : null;
          const href = typeof link?.href === 'string' ? normalizeCtaHref(link.href) : null;
          return label && href ? [{ label, href }] : [];
        })
    : [];
  const heroHighlights = copy.heroHighlights;
  const bestUseCaseItems = copy.bestUseCaseItems.length
    ? copy.bestUseCaseItems
    : normalizeBestUseCaseItems(localizedContent.bestUseCases?.items ?? [], locale);
  const bestUseCases = bestUseCaseItems.map((item) => item.title);
  const heroEyebrow = copy.heroEyebrow ?? buildEyebrow(providerName);
  const heroSupportLine = copy.heroSupportLine ?? buildSupportLine(bestUseCases);
  const breadcrumbModelLabel = localizedContent.marketingName ?? engine.marketingName ?? heroTitle;
  const howToLatamTitle = copy.howToLatamTitle;
  const howToLatamSteps = copy.howToLatamSteps;
  const specSections = copy.specSections.length
    ? copy.specSections
    : isVideoEngine
      ? buildAutoSpecSections(keySpecValues, locale)
      : copy.specSections;
  const specSectionsToShow = isImageEngine ? specSections : specSections.slice(0, 2);
  const strengths = copy.strengths;
  const boundaries = copy.boundaries.length ? copy.boundaries : isVideoEngine ? buildVideoBoundaries(keySpecValues) : [];
  const supportsNativeAudio = Boolean(
    keySpecValues &&
      (isSupported(keySpecValues.audioOutput) || isSupported(keySpecValues.nativeAudioGeneration))
  );
  const troubleshootingTitle = isVideoEngine
    ? locale === 'fr'
      ? 'Problèmes fréquents → solutions rapides'
      : locale === 'es'
        ? 'Problemas comunes → soluciones rápidas'
        : 'Common problems → fast fixes'
    : null;
  const troubleshootingItems =
    copy.troubleshootingItems.length
      ? copy.troubleshootingItems
      : isVideoEngine
        ? getDefaultVideoTroubleshooting(locale, supportsNativeAudio)
        : [];
  const tipsCardLabels = TIPS_CARD_LABELS[locale] ?? TIPS_CARD_LABELS.en;
  const safetyRules = copy.safetyRules.length ? copy.safetyRules : DEFAULT_GENERIC_SAFETY;
  const safetyInterpretation = copy.safetyInterpretation;
  const relatedItems = copy.relatedItems;
  const isSoraPrompting = engine.modelSlug === 'sora-2' || engine.modelSlug === 'sora-2-pro';
  const useDemoMediaPrompt = Boolean(demoMedia?.prompt?.trim());
  const focusVsConfig = resolveFocusVsConfig(engine.modelSlug, locale);
  const faqList = faqEntries.map((entry) => ({
    question: entry.question,
    answer: entry.answer,
  }));
  const faqTitle = copy.faqTitle ?? 'FAQ';
  const faqJsonLdEntries = faqList.slice(0, 6);
  const prepLinksSection = (() => {
    const isNanoBananaFamily =
      engine.modelSlug === 'nano-banana' ||
      engine.modelSlug === 'nano-banana-pro' ||
      engine.modelSlug === 'nano-banana-2' ||
      engine.modelSlug === 'gpt-image-2';
    const isVideoPrepModel =
      engine.modelSlug === 'veo-3-1' ||
      engine.modelSlug === 'kling-3-pro' ||
      engine.modelSlug === 'happy-horse-1-0' ||
      engine.modelSlug === 'sora-2-pro' ||
      engine.modelSlug === 'ltx-2-3-pro' ||
      engine.modelSlug === 'ltx-2-3-fast';

    if (!isNanoBananaFamily && !isVideoPrepModel) {
      return null;
    }

    if (locale === 'fr') {
      return isNanoBananaFamily
        ? {
            eyebrow: 'Avant de générer',
            title: 'Préparez la référence avant l’edit',
            body: 'Si l’image a d’abord besoin d’une référence personnage réutilisable ou d’un meilleur angle, réglez ça avant Nano Banana.',
            links: [
              { href: '/tools/character-builder', label: 'Créer une référence personnage réutilisable' },
              { href: '/tools/angle', label: "Changer le point de vue avant l'edit" },
              { href: '/app/image', label: 'Ouvrir Image' },
            ],
          }
        : {
            eyebrow: 'Avant de générer',
            title: 'Préparez le frame avant la vidéo',
            body: 'Verrouillez le personnage, corrigez l’angle ou construisez l’image source avant de dépenser des crédits en motion.',
            links: [
              { href: '/tools/character-builder', label: 'Conserver le même personnage' },
              { href: '/tools/angle', label: 'Changer le point de vue avant la vidéo' },
              { href: '/app/image', label: "Construire l'image source dans Image" },
            ],
          };
    }

    if (locale === 'es') {
      return isNanoBananaFamily
        ? {
            eyebrow: 'Antes de generar',
            title: 'Prepara la referencia antes del edit',
            body: 'Si la imagen primero necesita una referencia de personaje reutilizable o un mejor ángulo, resuélvelo antes de Nano Banana.',
            links: [
              { href: '/tools/character-builder', label: 'Crear una referencia de personaje reutilizable' },
              { href: '/tools/angle', label: 'Cambiar el punto de vista antes del edit' },
              { href: '/app/image', label: 'Abrir Image' },
            ],
          }
        : {
            eyebrow: 'Antes de generar',
            title: 'Prepara el frame antes del video',
            body: 'Fija el personaje, corrige el ángulo o construye la imagen base antes de gastar créditos en motion.',
            links: [
              { href: '/tools/character-builder', label: 'Mantener el mismo personaje' },
              { href: '/tools/angle', label: 'Cambiar el punto de vista antes del video' },
              { href: '/app/image', label: 'Construir la imagen base en Image' },
            ],
          };
    }

    return isNanoBananaFamily
      ? {
          eyebrow: 'Before you generate',
          title: 'Build the reference before the edit',
          body: 'If the still needs a reusable character reference or a better viewpoint first, solve that before Nano Banana.',
          links: [
            { href: '/tools/character-builder', label: 'Build a reusable character reference' },
            { href: '/tools/angle', label: 'Change the viewpoint before the edit' },
            { href: '/app/image', label: 'Open Image' },
          ],
        }
      : {
          eyebrow: 'Before you generate',
          title: 'Prepare the frame before video',
          body: 'Lock the character, fix the viewpoint, or build the source still before you spend credits on motion.',
          links: [
            { href: '/tools/character-builder', label: 'Keep the character consistent' },
            { href: '/tools/angle', label: 'Change the viewpoint before video' },
            { href: '/app/image', label: 'Build the source still in Image' },
          ],
        };
  })();
  const sectionLabels = resolveSectionLabels(locale);
  const compareCopy = resolveCompareCopy(locale, heroTitle, supportsNativeAudio);
  const statusLabels = resolveSpecStatusLabels(locale);
  const mediaAltContexts = {
    hero: 'hero',
    demo: 'demo',
  };
  const pageDescription = heroDesc1 ?? heroSubtitle ?? localizedContent.seo.description ?? heroTitle;
  const heroPosterAbsolute = toAbsoluteUrl(heroMedia.posterUrl ?? localizedContent.seo.image ?? null);
  const hasKeySpecRows = keySpecRows.length > 0;
  const hasSpecs = specSections.length > 0 || hasKeySpecRows;
  const hideExamplesSection = ['nano-banana', 'nano-banana-pro', 'nano-banana-2', 'gpt-image-2'].includes(engine.modelSlug);
  const hasExamples = galleryVideos.length > 0 && !hideExamplesSection;
  const galleryPreviewAlts = dedupeAltsInList(
    galleryVideos.slice(0, 6).map((video, index) => ({
      id: video.id,
      alt: getImageAlt({
        kind: 'renderThumb',
        engine: video.engineLabel,
        label: video.promptFull ?? video.prompt,
        prompt: video.promptFull ?? video.prompt,
        locale,
      }),
      tag: inferRenderTag(video.promptFull ?? video.prompt, locale),
      index,
      locale,
    }))
  );
  const hasTextSection = true;
  const hasTipsSection =
    strengths.length > 0 || boundaries.length > 0 || troubleshootingItems.length > 0 || Boolean(copy.tipsTitle || copy.tipsIntro);
  const hasSafetySection = safetyRules.length > 0 || safetyInterpretation.length > 0 || Boolean(copy.safetyTitle);
  const hasFaqSection = faqList.length > 0;
  const hasCompareGrid = !isImageEngine && (relatedItems.length > 0 || compareEngines.length > 0);
  const hasCompareSection = Boolean(focusVsConfig) || hasCompareGrid;
  const textAnchorId = isImageEngine ? 'text-to-image' : 'text-to-video';
  const imageAnchorId = isImageEngine ? 'image-to-image' : 'image-to-video';
  const compareAnchorId = 'compare';
  const tocItems = [
    { id: 'specs', label: sectionLabels.specs, visible: hasSpecs },
    { id: textAnchorId, label: sectionLabels.examples, visible: hasExamples },
    { id: imageAnchorId, label: sectionLabels.prompting, visible: hasTextSection },
    { id: 'tips', label: sectionLabels.tips, visible: hasTipsSection },
    {
      id: compareAnchorId,
      label: sectionLabels.compare,
      visible: hasCompareSection,
    },
    { id: 'safety', label: sectionLabels.safety, visible: hasSafetySection },
    { id: 'faq', label: sectionLabels.faq, visible: hasFaqSection },
  ].filter((item) => item.visible);
  const productSchema = buildProductSchema({
    engine,
    canonical,
    description: pageDescription,
    heroTitle,
    heroPosterAbsolute,
  });
  const schemaPayloads = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: heroTitle,
      description: pageDescription,
      url: canonical,
      inLanguage,
    },
    productSchema,
    {
      '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: resolvedBreadcrumb.home,
            item: localizedHomeUrl,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: resolvedBreadcrumb.models,
            item: localizedModelsUrl,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: heroTitle,
            item: localizedCanonical,
          },
        ],
      },
  ].filter(Boolean) as object[];

  return (
    <>
      {schemaPayloads.map((schema, index) => (
        <script
          key={`schema-${index}`}
          id={`model-jsonld-${index}`}
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
        />
      ))}
      <main className="container-page model-page max-w-6xl pb-0 pt-5 sm:pt-7">
        <div className="stack-gap-lg gap-0">
          <ModelHeroSection
            modelsPathname={modelsPathname}
            backLabel={backLabel}
            localizeModelsPath={localizeModelsPath}
            resolvedBreadcrumb={resolvedBreadcrumb}
            breadcrumbModelLabel={breadcrumbModelLabel}
            heroEyebrow={heroEyebrow}
            heroTitle={heroTitle}
            heroSubtitle={heroSubtitle}
            heroSupportLine={heroSupportLine}
            heroSpecChips={heroSpecChips}
            heroBadge={heroBadge}
            heroLimitsLine={heroLimitsLine}
            showHeroDescriptions={showHeroDescriptions}
            heroDesc1={heroDesc1}
            heroDesc2={heroDesc2}
            resolvedPrimaryCta={resolvedPrimaryCta}
            normalizedPrimaryCtaHref={normalizedPrimaryCtaHref}
            secondaryCta={secondaryCta}
            localizedSecondaryCtaHref={localizedSecondaryCtaHref}
            heroQuickLinks={heroQuickLinks}
            pricingLinkHref={pricingLinkHref}
            pricingLinkLabel={pricingLinkLabel}
            heroTrustLine={heroTrustLine}
            isEsLocale={isEsLocale}
            howToLatamTitle={howToLatamTitle}
            howToLatamSteps={howToLatamSteps}
            heroMedia={heroMedia}
            locale={locale}
            audioBadgeLabel={audioBadgeLabel}
            heroMetaLines={heroMetaLines}
            mediaAltContexts={mediaAltContexts}
            bestUseCaseItems={bestUseCaseItems}
            bestUseCases={bestUseCases}
            bestUseCasesTitle={copy.bestUseCasesTitle}
            whyTitle={copy.whyTitle}
            heroHighlights={heroHighlights}
          />

        <ModelPageToc items={tocItems} />

        <ModelSpecsSection
          hasSpecs={hasSpecs}
          specTitle={specTitle}
          specNote={specNote}
          keySpecRows={keySpecRows}
          specSectionsToShow={specSectionsToShow}
          isImageEngine={isImageEngine}
          locale={locale}
          statusLabels={statusLabels}
        />

        {isImageEngine && copy.microCta ? (
          <div className="flex justify-center">
            <Link
              href={normalizedPrimaryCtaHref}
              className="text-sm font-semibold text-brand transition hover:text-brandHover"
            >
              {copy.microCta}
            </Link>
          </div>
        ) : null}


        <ModelExamplesSection
          hideExamplesSection={hideExamplesSection}
          textAnchorId={textAnchorId}
          copy={copy}
          galleryVideos={galleryVideos}
          galleryPreviewAlts={galleryPreviewAlts}
          locale={locale}
          examplesLinkHref={examplesLinkHref}
          galleryCtaHref={galleryCtaHref}
        />

        <ModelPromptingSection
          imageAnchorId={imageAnchorId}
          isVideoEngine={isVideoEngine}
          copy={copy}
          supportsNativeAudio={supportsNativeAudio}
          demoMedia={demoMedia}
          locale={locale}
          audioBadgeLabel={audioBadgeLabel}
          mediaAltContexts={mediaAltContexts}
          useDemoMediaPrompt={useDemoMediaPrompt}
        />

        <ModelPrepLinksSection prepLinksSection={prepLinksSection} locale={locale} />

        <ModelTipsSection
          hasTipsSection={hasTipsSection}
          copy={copy}
          strengths={strengths}
          troubleshootingItems={troubleshootingItems}
          boundaries={boundaries}
          tipsCardLabels={tipsCardLabels}
          troubleshootingTitle={troubleshootingTitle}
        />

        {hasCompareSection ? (
          <section
            id={compareAnchorId}
            className={`${FULL_BLEED_SECTION} ${SECTION_BG_B} ${SECTION_PAD} ${SECTION_SCROLL_MARGIN} stack-gap-lg`}
          >
            {focusVsConfig ? (
              <>
                <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">
                  {focusVsConfig.title}
                </h2>
                <TextLink
                  href={localizeModelsPath(focusVsConfig.ctaSlug)}
                  className="mx-auto text-sm font-semibold text-brand hover:text-brandHover"
                  linkComponent={Link}
                >
                  {focusVsConfig.ctaLabel}
                </TextLink>
                <div className="grid grid-gap-sm lg:grid-cols-2">
                  <div className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
                    <h3 className="text-base font-semibold text-text-primary">{focusVsConfig.leftTitle}</h3>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                      {focusVsConfig.leftItems.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
                    <h3 className="text-base font-semibold text-text-primary">{focusVsConfig.rightTitle}</h3>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                      {focusVsConfig.rightItems.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </>
            ) : null}
            {hasCompareGrid ? (
              <div className={focusVsConfig ? 'mt-10 stack-gap sm:mt-12' : 'stack-gap'}>
                <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">
                  {compareCopy.title}
                </h2>
                <p className="text-center text-base leading-relaxed text-text-secondary">
                  {compareCopy.introPrefix}
                  <strong>{compareCopy.introStrong}</strong>
                  {compareCopy.introSuffix}
                </p>
                <p className="text-center text-sm text-text-secondary">{compareCopy.subline}</p>
                <div className="grid grid-gap-sm md:grid-cols-3">
                  {(() => {
                    const hasRelatedItems = relatedItems.length > 0;
                    const compareCards = hasRelatedItems
                      ? relatedItems
                      : compareEngines.map((entry) => ({
                        brand: entry.brandId,
                        title: entry.marketingName ?? entry.engine.label,
                        modelSlug: entry.modelSlug,
                        description: entry.seo?.description ?? '',
                      }));
                    return compareCards;
                  })()
                    .filter((entry) => Boolean(entry.modelSlug))
                    .map((entry) => {
                      const label = entry.title ?? '';
                      const canCompare =
                        !COMPARE_EXCLUDED_SLUGS.has(engineSlug) && !COMPARE_EXCLUDED_SLUGS.has(entry.modelSlug ?? '');
                      const compareSlug = [engineSlug, entry.modelSlug].sort().join('-vs-');
                      const compareHref = canCompare
                        ? CANONICAL_ONLY_COMPARE_SLUGS.has(compareSlug)
                          ? localizeComparePath(compareSlug)
                          : localizeComparePath(compareSlug, engineSlug)
                        : localizeModelsPath(entry.modelSlug ?? '');
                      const ctaLabel = canCompare ? compareCopy.ctaCompare(label) : compareCopy.ctaExplore(label);
                      const description =
                        relatedItems.length > 0
                          ? entry.description || compareCopy.cardDescription(label)
                          : locale === 'en'
                            ? entry.description || compareCopy.cardDescription(label)
                            : compareCopy.cardDescription(label);
                      return (
                        <article
                          key={entry.modelSlug}
                          className="rounded-2xl border border-hairline bg-surface/90 p-4 shadow-card transition hover:-translate-y-1 hover:border-text-muted"
                        >
                          <div className="min-w-0">
                            <h3 className="text-lg font-semibold text-text-primary">
                              {heroTitle} vs {label}
                            </h3>
                          </div>
                          <p className="mt-2 text-sm text-text-secondary line-clamp-2">{description}</p>
                          <TextLink href={compareHref} className="mt-4 gap-1 text-sm" linkComponent={Link}>
                            {ctaLabel}
                          </TextLink>
                        </article>
                      );
                    })}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {copy.safetyTitle || safetyRules.length || safetyInterpretation.length ? (
          <section
            id="safety"
            className={`${FULL_BLEED_SECTION} ${SECTION_BG_B} ${SECTION_PAD} ${SECTION_SCROLL_MARGIN} stack-gap`}
          >
            <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">
              {copy.safetyTitle ?? 'Safety & people / likeness'}
            </h2>
            <div className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
              {safetyRules.length ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                  {safetyRules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              ) : null}
              {safetyInterpretation.length ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                  {safetyInterpretation.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </div>
            {copy.safetyNote ? <p className="text-sm text-text-secondary">{copy.safetyNote}</p> : null}
          </section>
        ) : null}

        {faqList.length ? (
          <section
            id="faq"
            className={`${FULL_BLEED_SECTION} ${isSoraPrompting ? SECTION_BG_A : SECTION_BG_B} ${SECTION_PAD} ${SECTION_SCROLL_MARGIN} stack-gap`}
          >
            {faqTitle ? (
              <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">{faqTitle}</h2>
            ) : null}
            <div className="stack-gap-sm">
              {faqList.map((entry) => (
                <ResponsiveDetails
                  openOnDesktop
                  key={entry.question}
                  className="rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card"
                  summaryClassName="cursor-pointer text-sm font-semibold text-text-primary"
                  summary={entry.question}
                >
                  <p className="mt-2 text-sm text-text-secondary">{entry.answer}</p>
                </ResponsiveDetails>
              ))}
            </div>
          </section>
        ) : null}
        <FAQSchema questions={faqJsonLdEntries} />
        </div>
      </main>
    </>
  );
}
