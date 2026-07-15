import type { LocalizedLinkHref } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { localePathnames, localeRegions } from '@/i18n/locales';
import type { FalEngineEntry } from '@/config/falEngines';
import type { EngineCaps } from '@/types/engines';
import type { EngineLocalizedContent } from '@/lib/models/i18n';
import { getLocalizedModelMetaLabels } from '@/lib/ltx-localization';
import { dedupeAltsInList, getImageAlt, inferRenderTag } from '@/lib/image-alt';
import { getExamplesHref } from '@/lib/examples-links';
import type { ExampleGalleryVideo } from '@/components/examples/ExamplesGalleryGrid';
import { serializeJsonLd } from '../../model-jsonld';
import { ModelHeroSection } from './ModelHeroSection';
import { ModelDecisionHeroSection } from './ModelDecisionHeroSection';
import { ModelDecisionPricingCard } from './ModelDecisionPricingCard';
import { ModelPageContentSections } from './ModelPageContentSections';
import {
  DEFAULT_DETAIL_COPY,
  buildVideoBoundaries,
  getDefaultVideoTroubleshooting,
  getDefaultGenericSafety,
  type DetailCopy,
} from '../_lib/model-page-copy';
import { type FeaturedMedia } from '../_lib/model-page-media';
import { resolveProviderInfo } from '../_lib/model-page-schema';
import { resolveFocusVsConfig } from '../_lib/model-page-static';
import {
  buildCanonicalComparePath,
  COMPARE_BASE_PATH_MAP,
  getDefaultSecondaryModelHref,
  MODELS_BASE_PATH_MAP,
  resolveExamplesHrefFromRaw,
  resolveNonLocalizedHref,
  SITE,
  toAbsoluteUrl,
} from '../_lib/model-page-links';
import {
  GENERIC_TRUST_LINE,
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
import { buildModelPrepLinksSection } from '../_lib/model-page-prep-links';
import { buildModelPricingCallout } from '../_lib/model-page-pricing-callouts';
import { buildModelSchemaPayloads } from '../_lib/model-page-schema-payloads';
import { buildModelDecisionData } from '../_lib/model-page-decision-data';
import { buildDecisionTocItems, resolveDecisionTocOverviewLabel } from '../_lib/model-page-decision-toc';
import { parseModelPromptingContent } from '../_lib/model-page-prompting-content';
import { resolveModelPromptingDemoPromptSource } from '../_lib/model-page-prompting-prompt-source';
import { buildModelPromptingViewModel } from '../_lib/model-page-prompting-view-model';
import { getModelPageTemplateConfig } from '../_lib/model-page-template-registry';

export function MarketingModelPageLayout({
  engine,
  pricingEngine,
  backLabel,
  pricingLinkLabel,
  localizedContent,
  copy,
  isVideoEngine,
  isImageEngine,
  showBenchmarkLink,
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
  pricingEngine: EngineCaps;
  backLabel: string;
  pricingLinkLabel: string;
  localizedContent: EngineLocalizedContent;
  copy: SoraCopy;
  isVideoEngine: boolean;
  isImageEngine: boolean;
  showBenchmarkLink: boolean;
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
  const audioBadgeLabel =
    engine.modelSlug === 'minimax-hailuo-02-text'
      ? locale === 'fr'
        ? 'Silencieux'
        : locale === 'es'
          ? 'Sin audio'
          : 'Silent'
      : resolveAudioPricingLabels(locale).on;
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
  const safetyRules = copy.safetyRules.length ? copy.safetyRules : getDefaultGenericSafety(locale);
  const safetyInterpretation = copy.safetyInterpretation;
  const relatedItems = copy.relatedItems;
  const isSoraPrompting = engine.modelSlug === 'sora-2' || engine.modelSlug === 'sora-2-pro';
  const focusVsConfig = resolveFocusVsConfig(engine.modelSlug, locale);
  const faqList = faqEntries.map((entry) => ({
    question: entry.question,
    answer: entry.answer,
  }));
  const faqTitle = copy.faqTitle ?? 'FAQ';
  const faqJsonLdEntries = faqList.slice(0, 6);
  const prepLinksSection = buildModelPrepLinksSection(engine.modelSlug, locale);
  const pricingCallout = buildModelPricingCallout(engine.modelSlug, locale);
  const templateData = buildModelDecisionData({
    engine,
    locale,
    decisionContent: localizedContent.decision,
  });
  const templateConfig = templateData ? getModelPageTemplateConfig(engine.modelSlug) : null;
  const sectionLabels = resolveSectionLabels(locale);
  const compareCopy = resolveCompareCopy(locale, heroTitle, supportsNativeAudio);
  const statusLabels = resolveSpecStatusLabels(locale);
  const mediaAltContexts = { hero: 'hero', demo: 'demo' };
  const pageDescription = heroDesc1 ?? heroSubtitle ?? localizedContent.seo.description ?? heroTitle;
  const heroPosterAbsolute = toAbsoluteUrl(heroMedia.posterUrl ?? localizedContent.seo.image ?? null);
  const hasKeySpecRows = keySpecRows.length > 0;
  const hasSpecs = specSections.length > 0 || hasKeySpecRows;
  const hideExamplesSection = false;
  const hasFallbackGalleryCopy = Boolean(copy.galleryTitle || copy.galleryIntro || copy.galleryAllCta || copy.gallerySceneCta);
  const usesImageExampleFallback =
    engine.modelSlug === 'nano-banana-pro' ||
    engine.modelSlug === 'nano-banana' ||
    engine.modelSlug === 'nano-banana-2' ||
    engine.modelSlug === 'seedream' ||
    engine.modelSlug === 'gpt-image-2' ||
    engine.modelSlug === 'luma-uni-1' ||
    engine.modelSlug === 'luma-uni-1-max';
  const hasExamples = !hideExamplesSection && (galleryVideos.length > 0 || hasFallbackGalleryCopy || usesImageExampleFallback);
  const exampleAltLabel = locale === 'fr' ? 'exemple' : locale === 'es' ? 'ejemplo' : 'example';
  const galleryPreviewAlts = dedupeAltsInList(
    galleryVideos.slice(0, 6).map((video, index) => {
      const prompt = video.promptFull ?? video.prompt;
      const tag = inferRenderTag(prompt, locale);
      const label =
        engine.modelSlug === 'seedance-2-0' ||
        engine.modelSlug === 'minimax-hailuo-02-text' ||
        engine.modelSlug === 'wan-2-6' ||
        engine.modelSlug === 'pika-text-to-video'
          ? `${heroTitle} ${tag ? `${tag} ` : ''}${exampleAltLabel} ${index + 1}`
          : prompt;
      return {
        id: video.id,
        alt: getImageAlt({ kind: 'renderThumb', engine: video.engineLabel, label, prompt: label, locale }),
        tag,
        index,
        locale,
      };
    })
  );
  const hasTextSection = true;
  const hasTipsSection =
    strengths.length > 0 || boundaries.length > 0 || troubleshootingItems.length > 0 || Boolean(copy.tipsTitle || copy.tipsIntro);
  const hasSafetySection = safetyRules.length > 0 || safetyInterpretation.length > 0 || Boolean(copy.safetyTitle);
  const hasFaqSection = faqList.length > 0;
  const hasCompareGrid =
    (templateConfig?.sections.compare ?? true) &&
    !isImageEngine &&
    (relatedItems.length > 0 || compareEngines.length > 0);
  const hasCompareSection = !isImageEngine && (Boolean(focusVsConfig) || hasCompareGrid);
  const textAnchorId = isImageEngine ? 'text-to-image' : 'text-to-video';
  const imageAnchorId = templateData ? 'prompting' : isImageEngine ? 'image-to-image' : 'image-to-video';
  const promptingContent = parseModelPromptingContent(
    localizedContent.prompting,
    engine.modelSlug,
    locale,
    `content/models/${locale}/${engine.modelSlug}.json#prompting`,
  );
  const demoPromptSource = resolveModelPromptingDemoPromptSource({
    content: promptingContent,
    demoMedia,
    engineId: engine.id,
    locale,
  });
  const promptingViewModel = buildModelPromptingViewModel({
    content: promptingContent,
    locale,
    engineId: engine.id,
    modelSlug: engine.modelSlug,
    imageAnchorId,
    isVideoEngine,
    isImageEngine,
    supportsNativeAudio,
    demoPromptSource,
    demoMedia,
    defaultDemoPresentation: {
      audioBadgeLabel,
      altContext: mediaAltContexts.demo,
    },
    referenceWorkflows: templateData?.referenceWorkflows ?? [],
  });
  const compareAnchorId = 'compare';
  const tocItems = [
    { id: 'specs', label: sectionLabels.specs, visible: hasSpecs },
    { id: textAnchorId, label: sectionLabels.examples, visible: hasExamples },
    { id: imageAnchorId, label: sectionLabels.prompting, visible: hasTextSection },
    { id: 'tips', label: sectionLabels.tips, visible: hasTipsSection },
    { id: compareAnchorId, label: sectionLabels.compare, visible: hasCompareSection },
    { id: 'safety', label: sectionLabels.safety, visible: hasSafetySection },
    { id: 'faq', label: sectionLabels.faq, visible: hasFaqSection },
  ].filter((item) => item.visible);
  const decisionTocItems = buildDecisionTocItems({ locale, sectionLabels, textAnchorId, imageAnchorId, compareAnchorId, hasExamples, hasSpecs, hasTextSection, hasTipsSection, hasCompareSection, hasSafetySection, hasFaqSection });
  const decisionTocOverviewLabel = resolveDecisionTocOverviewLabel(locale);
  const schemaPayloads = buildModelSchemaPayloads({
    canonical,
    description: templateData?.meta.description ?? pageDescription,
    engine,
    heroPosterAbsolute,
    heroTitle,
    inLanguage,
    localizedCanonical,
    localizedHomeUrl,
    localizedModelsUrl,
    pageTitle: templateData?.meta.title,
    pricingEngine,
    resolvedBreadcrumb,
  });
  const legacyPricingCallout = !templateData && pricingCallout ? pricingCallout : null;
  const legacyMicroCta = !templateData && isImageEngine ? copy.microCta : null;

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
      <main className={['container-page model-page overflow-x-clip pb-0 pt-5 sm:pt-7', templateData ? 'max-w-[1400px]' : 'max-w-6xl'].join(' ')}>
        <div className={templateData ? 'space-y-5' : 'stack-gap-lg gap-0'}>
          {templateData ? (
            <>
              <ModelDecisionHeroSection decision={templateData} localizeModelsPath={localizeModelsPath} resolvedBreadcrumb={resolvedBreadcrumb} breadcrumbModelLabel={breadcrumbModelLabel} heroMedia={heroMedia} locale={locale} audioBadgeLabel={audioBadgeLabel} mediaAltContext={mediaAltContexts.hero} />
              <ModelDecisionPricingCard pricing={templateData.pricing} />
            </>
          ) : (
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
          )}
          <ModelPageContentSections
            isDecision={Boolean(templateData)}
            tocProps={{ items: templateData ? decisionTocItems : tocItems, variant: templateData ? 'pill' : 'default', overviewLabel: decisionTocOverviewLabel }}
            specsProps={{ hasSpecs, specTitle, specNote, keySpecRows, specSectionsToShow, isImageEngine, locale, statusLabels, showBenchmarkLink }}
            pricingCallout={legacyPricingCallout}
            microCta={legacyMicroCta}
            microCtaHref={normalizedPrimaryCtaHref}
            examplesProps={{
              hideExamplesSection,
              textAnchorId,
              copy,
              galleryVideos,
              galleryPreviewAlts,
              engineSlug: engine.id,
              fallbackImageUrl: heroMedia.posterUrl ?? localizedContent.seo.image ?? null,
              isImageEngine: usesImageExampleFallback,
              locale,
              examplesLinkHref,
              galleryCtaHref,
            }}
            decisionCards={templateData?.decisionCards ?? null}
            promptingProps={{ viewModel: promptingViewModel }}
            prepLinksProps={{ prepLinksSection, locale }}
            tipsProps={{ hasTipsSection, copy, locale, modelName: heroTitle, strengths, troubleshootingItems, boundaries, tipsCardLabels, troubleshootingTitle }}
            compareProps={{ hasCompareSection, compareAnchorId, focusVsConfig, localizeModelsPath, hasCompareGrid, compareCopy, relatedItems, compareEngines, engineSlug, localizeComparePath, locale, heroTitle }}
            safetyFaqProps={{ copy, modelName: heroTitle, safetyRules, safetyInterpretation, faqList, faqTitle, locale, isSoraPrompting, faqJsonLdEntries }}
          />
        </div>
      </main>
    </>
  );
}
