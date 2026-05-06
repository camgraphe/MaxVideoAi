import Image from 'next/image';
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
import { ButtonLink } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { TextLink } from '@/components/ui/TextLink';
import { UIIcon } from '@/components/ui/UIIcon';
import { BackLink } from '@/components/video/BackLink';
import { SoraPromptingTabs } from '@/components/marketing/SoraPromptingTabs.client';
import { ResponsiveDetails } from '@/components/ui/ResponsiveDetails.client';
import { SpecDetailsGrid } from '@/components/marketing/SpecDetailsGrid.client';
import { Check } from 'lucide-react';
import { serializeJsonLd } from '../../model-jsonld';
import { MediaPreview } from './MediaPreview';
import {
  DEFAULT_DETAIL_COPY,
  DEFAULT_GENERIC_SAFETY,
  buildVideoBoundaries,
  getDefaultVideoTroubleshooting,
  type DetailCopy,
} from '../_lib/model-page-copy';
import { type FeaturedMedia } from '../_lib/model-page-media';
import { buildProductSchema, resolveProviderInfo } from '../_lib/model-page-schema';
import { PREP_LINK_VISUALS, resolveFocusVsConfig } from '../_lib/model-page-static';
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
  BEST_USE_CASE_ICON_MAP,
  FULL_BLEED_CONTENT,
  FULL_BLEED_SECTION,
  GENERIC_TRUST_LINE,
  HERO_AUTOPLAY_DELAY_MS,
  HERO_BG,
  HERO_SPEC_ICON_MAP,
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
  localizeSpecStatus,
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
          <div className="stack-gap-xs">
            <nav className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
              <BackLink
                href={modelsPathname}
                label={backLabel}
                className="font-semibold text-brand hover:text-brandHover"
              />
              <span aria-hidden className="text-text-muted">
                /
              </span>
              <Link href={localizeModelsPath()} className="font-semibold text-text-secondary hover:text-text-primary">
                {resolvedBreadcrumb.models}
              </Link>
              <span aria-hidden className="text-text-muted">
                /
              </span>
              <span className="font-semibold text-text-muted">{breadcrumbModelLabel}</span>
            </nav>

            <section className={`${FULL_BLEED_SECTION} ${HERO_BG} stack-gap rounded-3xl bg-surface/80 p-6 sm:p-8`}>
              <div className="stack-gap-lg">
            <div className="stack-gap-sm text-center">
              {heroEyebrow ? (
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">
                  {heroEyebrow}
                </p>
              ) : null}
              <h1 className="text-3xl font-semibold text-text-primary sm:text-5xl">
                {heroTitle}
              </h1>
              {heroSubtitle ? (
                <p className="text-base leading-relaxed text-text-secondary sm:text-lg">
                  {heroSubtitle}
                </p>
              ) : null}
              {heroSupportLine ? (
                <p className="text-sm font-medium text-text-secondary">
                  {heroSupportLine}
                </p>
              ) : null}
              {heroSpecChips.length ? (
                <div className="flex flex-wrap justify-center gap-2">
                  {heroSpecChips.map((chip, index) => {
                    const Icon = chip.icon ? HERO_SPEC_ICON_MAP[chip.icon] : null;
                    return (
                      <Chip
                        key={`${chip.label}-${index}`}
                        variant="outline"
                        className="!border-accent-alt/40 !bg-accent-alt px-3 py-1 text-[11px] font-semibold normal-case tracking-normal !text-on-accent-alt shadow-card"
                      >
                        {Icon ? <UIIcon icon={Icon} size={14} className="text-on-accent-alt" /> : null}
                        <span>{chip.label}</span>
                      </Chip>
                    );
                  })}
                </div>
              ) : heroBadge ? (
                <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-hairline bg-surface/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-micro text-text-secondary shadow-card">
                  {heroBadge.split('·').map((chunk, index, arr) => (
                    <span key={`${chunk}-${index}`} className="flex items-center gap-2">
                      <span>{chunk.trim()}</span>
                      {index < arr.length - 1 ? <span aria-hidden>·</span> : null}
                    </span>
                  ))}
                </div>
              ) : null}
              {heroLimitsLine ? (
                <p className="mx-auto max-w-2xl text-xs font-medium leading-5 text-text-muted">
                  {heroLimitsLine}
                </p>
              ) : null}
              {showHeroDescriptions && heroDesc1 ? (
                <p className="text-base leading-relaxed text-text-secondary">{heroDesc1}</p>
              ) : null}
              {showHeroDescriptions && heroDesc2 ? (
                <p className="text-base leading-relaxed text-text-secondary">{heroDesc2}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              {resolvedPrimaryCta ? (
                <ButtonLink
                  href={normalizedPrimaryCtaHref}
                  size="lg"
                  className="shadow-card"
                  linkComponent={Link}
                >
                  {resolvedPrimaryCta}
                </ButtonLink>
              ) : null}
              {secondaryCta && localizedSecondaryCtaHref ? (
                <ButtonLink
                  href={localizedSecondaryCtaHref}
                  variant="outline"
                  size="lg"
                  linkComponent={Link}
                >
                  {secondaryCta}
                </ButtonLink>
              ) : null}
            </div>
            {heroQuickLinks.length ? (
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
                {heroQuickLinks.map((item) => (
                  <Link key={`${item.label}-${String(item.href)}`} href={item.href} className="font-semibold text-brand hover:text-brandHover">
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}
            {!heroSpecChips.length ? (
              <div className="flex flex-wrap justify-center gap-4 text-sm">
                <Link href={pricingLinkHref} className="font-semibold text-brand hover:text-brandHover">
                  {pricingLinkLabel}
                </Link>
              </div>
            ) : null}
            {heroTrustLine ? (
              <p className="text-center text-xs font-semibold text-text-muted">{heroTrustLine}</p>
            ) : null}
            {isEsLocale && howToLatamTitle && howToLatamSteps.length ? (
              <section className="rounded-2xl border border-hairline bg-surface/70 p-5 shadow-card">
                <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">{howToLatamTitle}</h2>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-text-secondary">
                  {howToLatamSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </section>
            ) : null}
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
              <div className="flex justify-center">
                <div className="w-full max-w-5xl">
                  <MediaPreview
                    media={heroMedia}
                    label={heroTitle}
                    locale={locale}
                    audioBadgeLabel={audioBadgeLabel}
                    hideLabel
                    hidePrompt
                    metaLines={heroMetaLines}
                    altContext={mediaAltContexts.hero}
                    autoPlayDelayMs={HERO_AUTOPLAY_DELAY_MS}
                    waitForLcp
                    showPlayButton={false}
                    priority
                    fetchPriority="high"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-4">
                {bestUseCaseItems.length || bestUseCases.length ? (
                  <div className="space-y-1.5 rounded-2xl border border-hairline bg-surface/80 p-3 shadow-card">
                    {copy.bestUseCasesTitle ? (
                      <p className="text-xs font-semibold text-text-primary">{copy.bestUseCasesTitle}</p>
                    ) : null}
                    {bestUseCaseItems.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {bestUseCaseItems.map((item, index) => {
                          const Icon = item.icon ? BEST_USE_CASE_ICON_MAP[item.icon] : null;
                          const chip = (
                            <Chip
                              variant="outline"
                              className="px-2.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-text-secondary"
                            >
                              {Icon ? <UIIcon icon={Icon} size={14} className="text-text-muted" /> : null}
                              <span>{item.title}</span>
                            </Chip>
                          );
                          if (!item.href) {
                            return <span key={`${item.title}-${index}`}>{chip}</span>;
                          }
                          return (
                            <Link
                              key={`${item.title}-${index}`}
                              href={item.href}
                              className="inline-flex rounded-full transition hover:border-brand/35 hover:text-brandHover focus:outline-none focus:ring-2 focus:ring-brand/35"
                            >
                              {chip}
                            </Link>
                          );
                        })}
                      </div>
                    ) : (
                      <ul className="grid gap-1 text-xs text-text-secondary sm:grid-cols-2 lg:grid-cols-1">
                        {bestUseCases.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
                {copy.whyTitle || heroHighlights.length ? (
                  <div className="stack-gap-sm rounded-2xl border border-hairline bg-bg px-3 py-2.5">
                    {copy.whyTitle ? <p className="text-xs font-semibold text-text-primary">{copy.whyTitle}</p> : null}
                    {heroHighlights.length ? (
                      <ul className="grid gap-1.5 text-xs text-text-secondary sm:grid-cols-2 lg:grid-cols-1">
                        {heroHighlights.map((item) => {
                          const [title, detail] = item.split('||');
                          const trimmedTitle = title?.trim();
                          const trimmedDetail = detail?.trim();
                          return (
                            <li key={item} className="flex items-start gap-2">
                              <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-text-muted" aria-hidden />
                              {trimmedDetail ? (
                                <span>
                                  <strong className="font-semibold">{trimmedTitle}</strong>
                                  {trimmedDetail ? ` (${trimmedDetail})` : null}
                                </span>
                              ) : (
                                <span>{item}</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
              </div>
            </section>
          </div>

        {tocItems.length ? (
          <nav
            className={`${FULL_BLEED_SECTION} sticky top-[calc(var(--header-height)-8px)] z-30 border-b border-hairline bg-surface before:bg-surface`}
            aria-label="Model page sections"
          >
            <div className="mx-auto w-full max-w-6xl px-6 sm:px-8">
              <div className="flex flex-wrap justify-center gap-2 py-2">
                {tocItems.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="inline-flex items-center rounded-full border border-hairline bg-surface/90 px-3 py-1 text-xs font-semibold text-text-secondary transition hover:border-text-muted hover:text-text-primary"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          </nav>
        ) : null}

        {hasSpecs ? (
          <section
            id="specs"
            className={`${FULL_BLEED_SECTION} ${SECTION_BG_B} ${SECTION_PAD} ${SECTION_SCROLL_MARGIN} stack-gap`}
          >
            {specTitle ? (
              <h2 className="mt-2 text-center text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">
                {specTitle}
              </h2>
            ) : null}
            {specNote ? (
              <blockquote className="rounded-2xl border border-hairline bg-surface-2 px-4 py-3 text-center text-sm text-text-secondary">
                {specNote}
              </blockquote>
            ) : null}
            {keySpecRows.length ? (
              <div className="mx-auto grid max-w-5xl grid-cols-2 gap-x-3 gap-y-1.5 border-t border-hairline/70 pt-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {keySpecRows.map((row, index) => (
                  <div
                    key={row.id}
                    className={`flex items-start gap-2 border-hairline/70 py-1.5 pr-1 ${
                      index < keySpecRows.length - 1 ? 'border-b' : ''
                    }`}
                  >
                    <span className="mt-[3px] inline-flex h-1.5 w-1.5 rounded-full bg-text-muted/60" aria-hidden />
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-micro text-text-muted">
                        {row.label}
                      </span>
                      <span className="text-[13px] font-semibold leading-snug text-text-primary">
                        {row.valueLines?.length ? (
                          <span className="flex flex-col gap-1">
                            {row.valueLines.map((line) => (
                              <span key={line}>{localizeSpecStatus(line, locale)}</span>
                            ))}
                          </span>
                        ) : isSupported(row.value) ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <UIIcon icon={Check} size={14} className="text-emerald-600" />
                            <span className="sr-only">{statusLabels.supported}</span>
                          </span>
                        ) : (
                          localizeSpecStatus(row.value, locale)
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {specSectionsToShow.length ? (
              isImageEngine ? (
                <div className="grid grid-gap-sm sm:grid-cols-2">
                  {specSectionsToShow.map((section) => (
                    <article
                      key={section.title}
                      className="space-y-2 rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card"
                    >
                      <h3 className="text-lg font-semibold text-text-primary">{section.title}</h3>
                      {section.intro ? (
                        <p className="text-sm text-text-secondary">{section.intro}</p>
                      ) : null}
                      <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                        {section.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              ) : (
                <SpecDetailsGrid sections={specSectionsToShow} />
              )
            ) : null}
          </section>
        ) : null}

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


        {!hideExamplesSection ? (
          <section
            id={textAnchorId}
            className={`${FULL_BLEED_SECTION} ${SECTION_BG_A} ${SECTION_PAD} ${SECTION_SCROLL_MARGIN}`}
          >
            <div className={`${FULL_BLEED_CONTENT} px-6 sm:px-8`}>
              {copy.galleryTitle ? (
                <h2 className="mt-0 text-center text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">
                  {copy.galleryTitle}
                </h2>
              ) : null}
              {galleryVideos.length ? (
                <>
                  {copy.galleryIntro ? (
                    <p className="mt-2 text-center text-base leading-relaxed text-text-secondary">{copy.galleryIntro}</p>
                  ) : null}
                  <div className="mt-4 stack-gap">
                    <div className="overflow-x-auto pb-2">
                      <div className="flex min-w-full gap-4">
                        {galleryVideos.slice(0, 6).map((video) => (
                          <article
                            key={video.id}
                            className="flex w-80 shrink-0 flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-card"
                          >
                            <Link href={video.href} className="group relative block aspect-video bg-placeholder">
                              {video.optimizedPosterUrl || video.rawPosterUrl ? (
                                <Image
                                  src={video.optimizedPosterUrl ?? video.rawPosterUrl ?? ''}
                                  alt={
                                    galleryPreviewAlts.get(video.id) ??
                                    getImageAlt({
                                      kind: 'renderThumb',
                                      engine: video.engineLabel,
                                      label: video.prompt,
                                      prompt: video.prompt,
                                      locale,
                                    })
                                  }
                                  fill
                                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                                  sizes="320px"
                                  quality={70}
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-skeleton text-xs font-semibold text-text-muted">
                                  No preview
                                </div>
                              )}
                            </Link>
                            <div className="space-y-1 px-4 py-3">
                              <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">
                                {video.engineLabel} · {video.durationSec}s
                              </p>
                              {video.recreateHref && copy.recreateLabel ? (
                                <TextLink href={video.recreateHref} className="text-[11px]" linkComponent={Link}>
                                  {copy.recreateLabel}
                                </TextLink>
                              ) : null}
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  </div>
                  {copy.galleryAllCta ? (
                    <p className="mt-4 text-center text-base leading-relaxed text-text-secondary">
                      <Link href={examplesLinkHref} className="font-semibold text-brand hover:text-brandHover">
                        {copy.galleryAllCta}
                      </Link>
                    </p>
                  ) : null}
                </>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-hairline bg-surface/60 px-4 py-4 text-sm text-text-secondary">
                  {copy.galleryIntro ?? 'Sora 2 examples will appear here soon.'}{' '}
                  {copy.galleryAllCta ? (
                    <Link href={examplesLinkHref} className="font-semibold text-brand hover:text-brandHover">
                      {copy.galleryAllCta}
                    </Link>
                  ) : null}
                </div>
              )}
              {copy.gallerySceneCta ? (
                <div className="mt-6">
                  <ButtonLink
                    href={galleryCtaHref}
                    size="lg"
                    className="shadow-card"
                    linkComponent={Link}
                  >
                    {copy.gallerySceneCta}
                  </ButtonLink>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <section
          id={imageAnchorId}
          className={`${FULL_BLEED_SECTION} ${SECTION_BG_B} ${SECTION_PAD} ${SECTION_SCROLL_MARGIN} stack-gap`}
        >
          {isVideoEngine ? (
            <div className="stack-gap-lg">
                <SoraPromptingTabs
                  title={copy.promptingTitle ?? undefined}
                  intro={copy.promptingIntro ?? undefined}
                  tip={copy.promptingTip ?? undefined}
                  guideLabel={copy.promptingGuideLabel ?? undefined}
                  guideUrl={copy.promptingGuideUrl ?? undefined}
                  mode="video"
                  supportsAudio={supportsNativeAudio}
                  tabs={copy.promptingTabs.length ? copy.promptingTabs : undefined}
                  globalPrinciples={copy.promptingGlobalPrinciples}
                  engineWhy={copy.promptingEngineWhy}
                  tabNotes={copy.promptingTabNotes}
                />
              {copy.demoTitle || copy.demoPrompt.length ? (
                <div className="stack-gap-lg">
                  {copy.demoTitle ? (
                    <h2 className="mt-2 text-center text-2xl font-semibold text-text-primary sm:mt-0 sm:text-3xl">
                      {copy.demoTitle}
                    </h2>
                  ) : null}
                  <div className="mx-auto w-full max-w-5xl">
                    {demoMedia ? (
                      <MediaPreview
                        media={demoMedia}
                        label={copy.demoTitle ?? 'Sora 2 demo'}
                        locale={locale}
                        audioBadgeLabel={audioBadgeLabel}
                        altContext={mediaAltContexts.demo}
                        hideLabel
                        promptLabel={useDemoMediaPrompt ? undefined : copy.demoPromptLabel ?? undefined}
                        promptLines={useDemoMediaPrompt ? [] : copy.demoPrompt}
                      />
                    ) : (
                      <div className="flex h-full min-h-[280px] items-center justify-center rounded-xl border border-dashed border-hairline bg-bg text-sm text-text-secondary">
                        {copy.galleryIntro ?? (locale === 'fr' ? 'Aperçu de démonstration.' : locale === 'es' ? 'Vista previa de demostración.' : 'Demo preview.')}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="stack-gap-lg">
              <SoraPromptingTabs
                title={copy.promptingTitle ?? undefined}
                intro={copy.promptingIntro ?? undefined}
                tip={copy.promptingTip ?? undefined}
                guideLabel={copy.promptingGuideLabel ?? undefined}
                guideUrl={copy.promptingGuideUrl ?? undefined}
                mode="image"
                supportsAudio={supportsNativeAudio}
                tabs={copy.promptingTabs.length ? copy.promptingTabs : undefined}
                globalPrinciples={copy.promptingGlobalPrinciples}
                engineWhy={copy.promptingEngineWhy}
                tabNotes={copy.promptingTabNotes}
              />
            </div>
          )}
        </section>

        {prepLinksSection ? (
          <section
            className={`${FULL_BLEED_SECTION} ${SECTION_BG_A} ${SECTION_PAD} ${SECTION_SCROLL_MARGIN} stack-gap`}
          >
            <div className="rounded-[28px] border border-hairline bg-surface/85 p-5 shadow-card sm:p-6">
              <div className="mx-auto max-w-3xl text-center">
                <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">
                  {prepLinksSection.eyebrow}
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-text-primary sm:text-3xl">
                  {prepLinksSection.title}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-text-secondary sm:text-base">
                  {prepLinksSection.body}
                </p>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {prepLinksSection.links.map((item) => {
                  const visual = PREP_LINK_VISUALS[item.href as keyof typeof PREP_LINK_VISUALS];
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="group overflow-hidden rounded-2xl border border-hairline bg-bg shadow-card transition hover:-translate-y-0.5 hover:border-text-muted"
                    >
                      {visual ? (
                        <div className="relative aspect-[16/10] overflow-hidden bg-placeholder">
                          <Image
                            src={visual.imageSrc}
                            alt={visual.alt[locale] ?? visual.alt.en}
                            fill
                            className="object-cover transition duration-300 group-hover:scale-[1.02]"
                            sizes="(max-width: 768px) 100vw, 33vw"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
                        </div>
                      ) : null}
                      <div className="space-y-2 px-4 py-4">
                        <h3 className="text-base font-semibold text-text-primary">{item.label}</h3>
                        {visual ? (
                          <p className="text-sm leading-relaxed text-text-secondary">
                            {visual.summary[locale] ?? visual.summary.en}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        {hasTipsSection ? (
          <section id="tips" className={`${FULL_BLEED_SECTION} ${SECTION_BG_A} ${SECTION_PAD} ${SECTION_SCROLL_MARGIN} stack-gap-lg`}>
            <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">
              {copy.tipsTitle ?? 'Tips & Limitations'}
            </h2>
            {copy.tipsIntro ? (
              <p className="text-center text-base leading-relaxed text-text-secondary">{copy.tipsIntro}</p>
            ) : null}
            {(() => {
              const tipsCardCount =
                (strengths.length ? 1 : 0) +
                (troubleshootingItems.length ? 1 : 0) +
                (boundaries.length ? 1 : 0);
              const gridClass =
                tipsCardCount === 1
                  ? 'mx-auto grid w-full max-w-3xl grid-gap-sm'
                  : tipsCardCount === 2
                  ? 'mx-auto grid w-full max-w-4xl grid-gap-sm lg:grid-cols-2'
                  : 'mx-auto grid w-full max-w-5xl grid-gap-sm lg:grid-cols-3';
              return (
                <div className={gridClass}>
              {strengths.length ? (
                <div className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
                  <h3 className="text-base font-semibold text-text-primary">{tipsCardLabels.strengths}</h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                    {strengths.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {troubleshootingItems.length ? (
                <div className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
                  <h3 className="text-base font-semibold text-text-primary">
                    {troubleshootingTitle ?? 'Common problems → fast fixes'}
                  </h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                    {troubleshootingItems.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {boundaries.length ? (
                <div className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
                  <h3 className="text-base font-semibold text-text-primary">{tipsCardLabels.boundaries}</h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                    {boundaries.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
                </div>
              );
            })()}
          </section>
        ) : null}

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
