import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import Head from 'next/head';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { resolveDictionary } from '@/lib/i18n/server';
import { PARTNER_BRAND_MAP } from '@/lib/brand-partners';
import { listFalEngines, getFalEngineBySlug, type FalEngineEntry } from '@/config/falEngines';
import type { AppLocale } from '@/i18n/locales';
import { locales, localePathnames, localeRegions } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import { resolveLocalesForEnglishPath } from '@/lib/seo/alternateLocales';
import { getEngineLocalized, type EngineLocalizedContent } from '@/lib/models/i18n';
import { buildOptimizedPosterUrl } from '@/lib/media-helpers';
import { normalizeEngineId } from '@/lib/engine-alias';
import { type ExampleGalleryVideo } from '@/components/examples/ExamplesGalleryGrid';
import { listExamples, getVideosByIds, type GalleryVideo } from '@/server/videos';
import { serializeJsonLd } from '../model-jsonld';

type PageParams = {
  params: {
    locale: AppLocale;
    slug: string;
  };
};

export const dynamicParams = false;
export const revalidate = 300;

const PREFERRED_MEDIA: Record<string, { hero: string | null; demo: string | null }> = {
  'sora-2': {
    hero: 'job_74677d4f-9f28-4e47-b230-64accef8e239',
    demo: 'job_7fbd6334-8535-438a-98a2-880205744b6b',
  },
  'sora-2-pro': {
    hero: 'job_4d97a93f-1582-4a50-bff1-72894c302164',
    demo: null,
  },
};

type SpecSection = { title: string; items: string[] };
type LocalizedFaqEntry = { question: string; answer: string };

type SoraCopy = {
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroBadge: string | null;
  heroDesc1: string | null;
  heroDesc2: string | null;
  primaryCta: string | null;
  primaryCtaHref: string | null;
  secondaryCta: string | null;
  secondaryCtaHref: string | null;
  whyTitle: string | null;
  heroHighlights: string[];
  bestUseCasesTitle: string | null;
  bestUseCases: string[];
  whatTitle: string | null;
  whatIntro1: string | null;
  whatIntro2: string | null;
  whatFlowTitle: string | null;
  whatFlowSteps: string[];
  specTitle: string | null;
  specNote: string | null;
  specSections: SpecSection[];
  specValueProp: string | null;
  microCta: string | null;
  galleryTitle: string | null;
  galleryIntro: string | null;
  gallerySceneCta: string | null;
  galleryAllCta: string | null;
  recreateLabel: string | null;
  promptTitle: string | null;
  promptIntro: string | null;
  promptPatternSteps: string[];
  promptSkeleton: string | null;
  promptSkeletonNote: string | null;
  imageTitle: string | null;
  imageIntro: string | null;
  imageFlow: string[];
  imageWhy: string[];
  multishotTitle: string | null;
  multishotIntro1: string | null;
  multishotIntro2: string | null;
  multishotTips: string[];
  demoTitle: string | null;
  demoPromptLabel: string | null;
  demoPrompt: string[];
  demoNotes: string[];
  tipsTitle: string | null;
  strengths: string[];
  boundaries: string[];
  tipsFooter: string | null;
  safetyTitle: string | null;
  safetyRules: string[];
  safetyInterpretation: string[];
  safetyNote: string | null;
  comparisonTitle: string | null;
  comparisonPoints: string[];
  comparisonCta: string | null;
  relatedTitle: string | null;
  relatedSubtitle: string | null;
  finalPara1: string | null;
  finalPara2: string | null;
  finalButton: string | null;
  faqTitle: string | null;
  faqs: LocalizedFaqEntry[];
};

export function generateStaticParams() {
  const engines = listFalEngines();
  return locales.flatMap((locale) => engines.map((entry) => ({ locale, slug: entry.modelSlug })));
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://maxvideoai.com';
const MODELS_BASE_PATH_MAP = buildSlugMap('models');

function buildDetailSlugMap(slug: string) {
  return locales.reduce<Record<AppLocale, string>>((acc, locale) => {
    const base = MODELS_BASE_PATH_MAP[locale] ?? 'models';
    acc[locale] = `${base}/${slug}`;
    return acc;
  }, {} as Record<AppLocale, string>);
}

type DetailCopy = {
  backLabel: string;
  overviewTitle: string;
  overview: {
    brand: string;
    engineId: string;
    slug: string;
    logoPolicy: string;
    platformPrice: string;
  };
  logoPolicies: {
    logoAllowed: string;
    textOnly: string;
  };
  promptsTitle: string;
  faqTitle: string;
  buttons: {
    pricing: string;
    launch: string;
  };
  breadcrumb: {
    home: string;
    models: string;
  };
};

const DEFAULT_DETAIL_COPY: DetailCopy = {
  backLabel: '← Back to models',
  overviewTitle: 'Overview',
  overview: {
    brand: 'Brand',
    engineId: 'Engine ID',
    slug: 'Slug',
    logoPolicy: 'Logo policy',
    platformPrice: 'Live pricing updates inside the Generate workspace.',
  },
  logoPolicies: {
    logoAllowed: 'Logo usage permitted',
    textOnly: 'Text-only (wordmark)',
  },
  promptsTitle: 'Prompt ideas',
  faqTitle: 'FAQ',
  buttons: {
    pricing: 'Open Generate',
    launch: 'Launch workspace',
  },
  breadcrumb: {
    home: 'Home',
    models: 'Models',
  },
};

const MODEL_OG_IMAGE_MAP: Record<string, string> = {
  'sora-2':
    'https://videohub-uploads-us.s3.amazonaws.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/a5cbd8d3-33c7-47b5-8480-7f23aab89891-job_684c1b3d-2679-40d1-adb7-06151b3e8739.jpg',
  'sora-2-pro':
    'https://videohub-uploads-us.s3.amazonaws.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/a5cbd8d3-33c7-47b5-8480-7f23aab89891-job_684c1b3d-2679-40d1-adb7-06151b3e8739.jpg',
  'veo-3-1': '/hero/veo3.jpg',
  'veo-3-1-fast': '/hero/veo3.jpg',
  'pika-text-to-video': '/hero/pika-22.jpg',
  'minimax-hailuo-02-text': '/hero/minimax-video01.jpg',
};

function toAbsoluteUrl(url?: string | null): string {
  if (!url) return `${SITE}/og/price-before.png`;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `${SITE}${url}`;
  return `${SITE}/${url}`;
}

function buildSoraCopy(localized: EngineLocalizedContent, slug: string): SoraCopy {
  const custom = (localized.custom ?? {}) as Record<string, unknown>;
  const getString = (key: string): string | null => {
    const value = custom[key];
    return typeof value === 'string' && value.trim().length ? value : null;
  };
  const getStringArray = (key: string): string[] => {
    const value = custom[key];
    if (Array.isArray(value)) {
      return value.map((item) => (typeof item === 'string' ? item : '')).filter(Boolean);
    }
    return [];
  };
  const getFaqs = (): LocalizedFaqEntry[] => {
    const value = custom['faqs'];
    if (!Array.isArray(value)) return [];
    return value
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const obj = entry as Record<string, unknown>;
        const question = typeof obj.q === 'string' ? obj.q : typeof obj.question === 'string' ? obj.question : null;
        const answer = typeof obj.a === 'string' ? obj.a : typeof obj.answer === 'string' ? obj.answer : null;
        if (!question || !answer) return null;
        return { question, answer };
      })
      .filter((faq): faq is LocalizedFaqEntry => Boolean(faq));
  };
  const getSpecSections = (): SpecSection[] => {
    const value = custom['specSections'];
    if (!Array.isArray(value)) return [];
    return value
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const obj = entry as Record<string, unknown>;
        const title = typeof obj.title === 'string' ? obj.title : null;
        const itemsRaw = obj.items;
        const items = Array.isArray(itemsRaw)
          ? itemsRaw.map((item) => (typeof item === 'string' ? item : '')).filter(Boolean)
          : [];
        if (!title || !items.length) return null;
        return { title, items };
      })
      .filter((section): section is SpecSection => Boolean(section));
  };

  const bestUseCasesTitle = localized.bestUseCases?.title ?? getString('bestUseCasesTitle');
  const bestUseCases = localized.bestUseCases?.items ?? getStringArray('bestUseCases');

  return {
    heroTitle: localized.hero?.title ?? getString('heroTitle'),
    heroSubtitle: localized.hero?.intro ?? getString('heroSubtitle'),
    heroBadge: localized.hero?.badge ?? getString('heroBadge'),
    heroDesc1: getString('heroDesc1'),
    heroDesc2: getString('heroDesc2'),
    primaryCta: localized.hero?.ctaPrimary?.label ?? getString('primaryCta'),
    primaryCtaHref: localized.hero?.ctaPrimary?.href ?? `/app?engine=${slug}`,
    secondaryCta:
      (localized.hero?.secondaryLinks?.[0]?.label as string | undefined) ??
      getString('secondaryCta') ??
      localized.compareLink?.label ??
      null,
    secondaryCtaHref:
      (localized.hero?.secondaryLinks?.[0]?.href as string | undefined) ??
      localized.compareLink?.href ??
      (slug === 'sora-2' ? '/models/sora-2-pro' : '/models/sora-2'),
    whyTitle: getString('whyTitle'),
    heroHighlights: getStringArray('heroHighlights'),
    bestUseCasesTitle,
    bestUseCases,
    whatTitle: getString('whatTitle'),
    whatIntro1: getString('whatIntro1'),
    whatIntro2: getString('whatIntro2'),
    whatFlowTitle: getString('whatFlowTitle'),
    whatFlowSteps: getStringArray('whatFlowSteps'),
    specTitle: getString('specTitle'),
    specNote: getString('specNote'),
    specSections: getSpecSections(),
    specValueProp: getString('specValueProp'),
    microCta: getString('microCta'),
    galleryTitle: getString('galleryTitle'),
    galleryIntro: getString('galleryIntro'),
    gallerySceneCta: getString('gallerySceneCta'),
    galleryAllCta: getString('galleryAllCta'),
    recreateLabel: getString('recreateLabel'),
    promptTitle: getString('promptTitle'),
    promptIntro: getString('promptIntro'),
    promptPatternSteps: getStringArray('promptPatternSteps'),
    promptSkeleton: getString('promptSkeleton'),
    promptSkeletonNote: getString('promptSkeletonNote'),
    imageTitle: getString('imageTitle'),
    imageIntro: getString('imageIntro'),
    imageFlow: getStringArray('imageFlow'),
    imageWhy: getStringArray('imageWhy'),
    multishotTitle: getString('multishotTitle'),
    multishotIntro1: getString('multishotIntro1'),
    multishotIntro2: getString('multishotIntro2'),
    multishotTips: getStringArray('multishotTips'),
    demoTitle: getString('demoTitle'),
    demoPromptLabel: getString('demoPromptLabel'),
    demoPrompt: getStringArray('demoPrompt'),
    demoNotes: getStringArray('demoNotes'),
    tipsTitle: getString('tipsTitle'),
    strengths: getStringArray('strengths'),
    boundaries: getStringArray('boundaries'),
    tipsFooter: getString('tipsFooter'),
    safetyTitle: getString('safetyTitle'),
    safetyRules: getStringArray('safetyRules'),
    safetyInterpretation: getStringArray('safetyInterpretation'),
    safetyNote: getString('safetyNote'),
    comparisonTitle: getString('comparisonTitle'),
    comparisonPoints: getStringArray('comparisonPoints'),
    comparisonCta: getString('comparisonCta'),
    relatedTitle: getString('relatedTitle'),
    relatedSubtitle: getString('relatedSubtitle'),
    finalPara1: getString('finalPara1'),
    finalPara2: getString('finalPara2'),
    finalButton: getString('finalButton'),
    faqTitle: getString('faqTitle'),
    faqs: getFaqs(),
  };
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { slug, locale } = params;
  const engine = getFalEngineBySlug(slug);
  if (!engine) {
    return {
      title: 'Model not found - MaxVideo AI',
      robots: { index: false, follow: false },
    };
  }

  const localized = await getEngineLocalized(slug, locale);
  const detailSlugMap = buildDetailSlugMap(slug);
  const publishableLocales = Array.from(resolveLocalesForEnglishPath(`/models/${slug}`));
  const metadataUrls = buildMetadataUrls(locale, detailSlugMap, { availableLocales: publishableLocales });
  const canonical = metadataUrls.canonical.replace(/\/+$/, '') || metadataUrls.canonical;
  const fallbackTitle = engine.seo.title ?? `${engine.marketingName} — MaxVideo AI`;
  const title = localized.seo.title ?? fallbackTitle;
  const description =
    localized.seo.description ??
    engine.seo.description ??
    'Explore availability, prompts, pricing, and render policies for this model on MaxVideoAI.';
  const ogImagePath = localized.seo.image ?? MODEL_OG_IMAGE_MAP[slug] ?? engine.media?.imagePath ?? '/og/price-before.png';
  const ogImage = toAbsoluteUrl(ogImagePath);

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: metadataUrls.languages,
    },
    openGraph: {
      type: 'article',
      url: canonical,
      siteName: 'MaxVideo AI',
      title,
      description,
      locale: metadataUrls.ogLocale,
      alternateLocale: metadataUrls.alternateOg,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

type FeaturedMedia = {
  id: string | null;
  prompt: string | null;
  videoUrl: string | null;
  posterUrl: string | null;
  durationSec?: number | null;
  hasAudio?: boolean;
  href?: string | null;
  label?: string | null;
};

function formatPriceLabel(priceCents: number | null | undefined, currency: string | null | undefined): string | null {
  if (typeof priceCents !== 'number' || Number.isNaN(priceCents)) {
    return null;
  }
  const normalizedCurrency = typeof currency === 'string' && currency.length ? currency.toUpperCase() : 'USD';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: normalizedCurrency,
      maximumFractionDigits: 2,
    }).format(priceCents / 100);
  } catch {
    return `${normalizedCurrency} ${(priceCents / 100).toFixed(2)}`;
  }
}

function formatPromptExcerpt(prompt: string, maxWords = 22): string {
  const words = prompt.trim().split(/\s+/);
  if (words.length <= maxWords) return prompt.trim();
  return `${words.slice(0, maxWords).join(' ')}…`;
}

function toGalleryCard(
  video: GalleryVideo,
  brandId?: string,
  fallbackLabel?: string,
  iconId?: string,
  fromPath?: string
): ExampleGalleryVideo {
  const promptExcerpt = formatPromptExcerpt(video.promptExcerpt || video.prompt || 'MaxVideoAI render');
  const videoHrefBase = `/video/${encodeURIComponent(video.id)}`;
  const videoHref = fromPath ? `${videoHrefBase}?from=${encodeURIComponent(fromPath)}` : videoHrefBase;
  return {
    id: video.id,
    href: videoHref,
    engineLabel: video.engineLabel || fallbackLabel || 'Sora 2',
    engineIconId: iconId ?? 'sora-2',
    engineBrandId: brandId,
    priceLabel: formatPriceLabel(video.finalPriceCents ?? null, video.currency ?? null),
    prompt: promptExcerpt,
    aspectRatio: video.aspectRatio ?? null,
    durationSec: video.durationSec,
    hasAudio: video.hasAudio,
    optimizedPosterUrl: buildOptimizedPosterUrl(video.thumbUrl),
    rawPosterUrl: video.thumbUrl ?? null,
    videoUrl: video.videoUrl ?? null,
    recreateHref: `/app?engine=sora-2&from=${encodeURIComponent(video.id)}`,
  };
}

function toFeaturedMedia(entry?: ExampleGalleryVideo | null): FeaturedMedia | null {
  if (!entry) return null;
  return {
    id: entry.id,
    prompt: entry.prompt,
    videoUrl: entry.videoUrl ?? null,
    posterUrl: entry.optimizedPosterUrl ?? entry.rawPosterUrl ?? null,
    durationSec: entry.durationSec,
    hasAudio: entry.hasAudio,
    href: entry.href,
    label: entry.engineLabel,
  };
}

function isLandscape(aspect: string | null | undefined): boolean {
  if (!aspect) return true;
  const [w, h] = aspect.split(':').map(Number);
  if (!Number.isFinite(w) || !Number.isFinite(h) || h === 0) return true;
  return w / h >= 1;
}

function pickHeroMedia(cards: ExampleGalleryVideo[], preferredId: string | null, fallback: FeaturedMedia): FeaturedMedia {
  const preferred = preferredId ? cards.find((card) => card.id === preferredId) : null;
  if (preferred) {
    return toFeaturedMedia(preferred) ?? fallback;
  }
  const playable = cards.find((card) => Boolean(card.videoUrl)) ?? cards[0];
  return toFeaturedMedia(playable) ?? fallback;
}

function pickDemoMedia(
  cards: ExampleGalleryVideo[],
  heroId: string | null,
  preferredId: string | null,
  fallback: FeaturedMedia | null
): FeaturedMedia | null {
  const preferred =
    preferredId && preferredId !== heroId
      ? cards.find((card) => card.id === preferredId && Boolean(card.videoUrl))
      : null;
  if (preferred) {
    const resolved = toFeaturedMedia(preferred);
    if (resolved) return resolved;
  }
  const candidate =
    cards.find((card) => card.id !== heroId && Boolean(card.videoUrl) && isLandscape(card.aspectRatio)) ??
    cards.find((card) => card.id !== heroId);
  const resolved = toFeaturedMedia(candidate);
  if (resolved) return resolved;
  if (fallback && (!heroId || fallback.id !== heroId)) {
    return fallback;
  }
  return null;
}

async function renderSoraModelPage({
  engine,
  backLabel,
  localizedContent,
  locale,
  breadcrumb,
}: {
  engine: FalEngineEntry;
  backLabel: string;
  localizedContent: EngineLocalizedContent;
  locale: AppLocale;
  breadcrumb: DetailCopy['breadcrumb'];
}) {
  const detailSlugMap = buildDetailSlugMap(engine.modelSlug);
  const publishableLocales = Array.from(resolveLocalesForEnglishPath(`/models/${engine.modelSlug}`));
  const metadataUrls = buildMetadataUrls(locale, detailSlugMap, { availableLocales: publishableLocales });
  const canonicalUrl = metadataUrls.canonical.replace(/\/+$/, '') || metadataUrls.canonical;
  const copy = buildSoraCopy(localizedContent, engine.modelSlug);
  const backPath = (() => {
    try {
      const url = new URL(canonicalUrl);
      return url.pathname || `/models/${engine.modelSlug}`;
    } catch {
      return `/models/${engine.modelSlug}`;
    }
  })();
  let examples: GalleryVideo[] = [];
  try {
    examples = await listExamples('date-desc', 60);
  } catch (error) {
    console.warn('[models/sora-2] failed to load examples', error);
  }
  const normalizedSlug = normalizeEngineId(engine.modelSlug) ?? engine.modelSlug;
  const allowedEngineIds = new Set([
    normalizedSlug,
    engine.modelSlug,
    engine.id,
    ...(engine.modelSlug === 'sora-2-pro' ? ['sora-2', 'sora2'] : []),
    ...(engine.modelSlug === 'sora-2' ? ['sora-2', 'sora2'] : []),
  ].map((id) => (id ? id.toString().trim().toLowerCase() : '')).filter(Boolean));
  const soraExamples = examples.filter((video) => {
    const normalized = normalizeEngineId(video.engineId)?.trim().toLowerCase();
    return normalized ? allowedEngineIds.has(normalized) : false;
  });
  const validatedMap = await getVideosByIds(soraExamples.map((video) => video.id));
  const galleryVideos = soraExamples
    .filter((video) => validatedMap.has(video.id))
    .map((video) =>
      toGalleryCard(
        video,
        engine.brandId,
        localizedContent.marketingName ?? engine.marketingName,
        engine.modelSlug,
        backPath
      )
    );

  const fallbackMedia: FeaturedMedia = {
    id: `${engine.modelSlug}-hero-fallback`,
    prompt: `${localizedContent.marketingName ?? engine.marketingName} demo clip from MaxVideoAI`,
    videoUrl: engine.media?.videoUrl ?? engine.demoUrl ?? null,
    posterUrl: buildOptimizedPosterUrl(engine.media?.imagePath) ?? engine.media?.imagePath ?? null,
    durationSec: null,
    hasAudio: true,
    href: null,
    label: localizedContent.marketingName ?? engine.marketingName ?? 'Sora',
  };

  const preferredIds = PREFERRED_MEDIA[engine.modelSlug] ?? { hero: null, demo: null };
  const heroMedia = pickHeroMedia(galleryVideos, preferredIds.hero, fallbackMedia);
  const demoMedia = pickDemoMedia(galleryVideos, heroMedia?.id ?? null, preferredIds.demo, fallbackMedia);
  const galleryCtaHref = heroMedia?.id
    ? `/app?engine=${engine.modelSlug}&from=${encodeURIComponent(heroMedia.id)}`
    : `/app?engine=${engine.modelSlug}`;
  const relatedEngines = listFalEngines()
    .filter((entry) => entry.modelSlug !== engine.modelSlug)
    .sort((a, b) => (a.family === engine.family ? -1 : 0) - (b.family === engine.family ? -1 : 0))
    .slice(0, 3);
  const faqEntries = localizedContent.faqs.length ? localizedContent.faqs : copy.faqs;

  return (
    <Sora2PageLayout
      backLabel={backLabel}
      localizedContent={localizedContent}
      copy={copy}
      heroMedia={heroMedia}
      demoMedia={demoMedia}
      galleryVideos={galleryVideos}
    galleryCtaHref={galleryCtaHref}
    relatedEngines={relatedEngines}
    faqEntries={faqEntries}
    locale={locale}
    canonicalUrl={canonicalUrl}
    breadcrumb={breadcrumb}
  />
  );
}

function Sora2PageLayout({
  backLabel,
  localizedContent,
  copy,
  heroMedia,
  demoMedia,
  galleryVideos,
  galleryCtaHref,
  relatedEngines,
  faqEntries,
  locale,
  canonicalUrl,
  breadcrumb,
}: {
  backLabel: string;
  localizedContent: EngineLocalizedContent;
  copy: SoraCopy;
  heroMedia: FeaturedMedia;
  demoMedia: FeaturedMedia | null;
  galleryVideos: ExampleGalleryVideo[];
  galleryCtaHref: string;
  relatedEngines: FalEngineEntry[];
  faqEntries: LocalizedFaqEntry[];
  locale: AppLocale;
  canonicalUrl: string;
  breadcrumb: DetailCopy['breadcrumb'];
}) {
  const inLanguage = localeRegions[locale] ?? 'en-US';
  const resolvedBreadcrumb = breadcrumb ?? DEFAULT_DETAIL_COPY.breadcrumb;
  const canonical = canonicalUrl.replace(/\/+$/, '') || canonicalUrl;
  const localePathPrefix = localePathnames[locale] ? `/${localePathnames[locale].replace(/^\/+/, '')}` : '';
  const homePathname = localePathPrefix || '/';
  const localizedHomeUrl = homePathname === '/' ? `${SITE}/` : `${SITE}${homePathname}`;
  const localizedModelsSlug = (MODELS_BASE_PATH_MAP[locale] ?? 'models').replace(/^\/+/, '');
  const modelsPathname =
    homePathname === '/'
      ? `/${localizedModelsSlug}`
      : `${homePathname.replace(/\/+$/, '')}/${localizedModelsSlug}`.replace(/\/{2,}/g, '/');
  const localizedModelsUrl = `${SITE}${modelsPathname}`;
  const heroTitle = copy.heroTitle ?? localizedContent.hero?.title ?? localizedContent.marketingName ?? 'Sora 2';
  const heroSubtitle = copy.heroSubtitle ?? localizedContent.hero?.intro ?? localizedContent.overview ?? '';
  const heroBadge = copy.heroBadge ?? localizedContent.hero?.badge ?? null;
  const heroDesc1 = copy.heroDesc1 ?? localizedContent.overview ?? localizedContent.seo.description ?? null;
  const heroDesc2 = copy.heroDesc2;
  const primaryCta = copy.primaryCta ?? localizedContent.hero?.ctaPrimary?.label ?? 'Start generating';
  const primaryCtaHref = copy.primaryCtaHref ?? localizedContent.hero?.ctaPrimary?.href ?? '/app?engine=sora-2';
  const secondaryCta = copy.secondaryCta;
  const secondaryCtaHref = copy.secondaryCtaHref ?? '/models/sora-2-pro';
  const heroPosterPreload = heroMedia.posterUrl ? buildOptimizedPosterUrl(heroMedia.posterUrl) ?? heroMedia.posterUrl : null;

  const heroHighlights = copy.heroHighlights;
  const bestUseCasesTitle = copy.bestUseCasesTitle ?? localizedContent.bestUseCases?.title ?? null;
  const bestUseCases = copy.bestUseCases.length ? copy.bestUseCases : localizedContent.bestUseCases?.items ?? [];
  const whatFlowSteps = copy.whatFlowSteps;
  const specSections = copy.specSections;
  const promptPatternSteps = copy.promptPatternSteps.length
    ? copy.promptPatternSteps
    : localizedContent.promptStructure?.steps ?? [];
  const imageToVideoSteps = copy.imageFlow;
  const imageToVideoUseCases = copy.imageWhy;
  const miniFilmTips = copy.multishotTips;
  const strengths = copy.strengths;
  const boundaries = copy.boundaries;
  const safetyRules = copy.safetyRules;
  const safetyInterpretation = copy.safetyInterpretation;
  const comparisonPoints = copy.comparisonPoints;
  const faqTitle = copy.faqTitle ?? 'FAQ';
  const faqList = faqEntries.map((entry) => ({
    question: entry.question,
    answer: entry.answer,
  }));
  const pageDescription = heroDesc1 ?? heroSubtitle ?? localizedContent.seo.description ?? heroTitle;
  const heroPosterAbsolute = toAbsoluteUrl(heroMedia.posterUrl ?? localizedContent.seo.image ?? null);
  const heroVideoAbsolute = heroMedia.videoUrl ? toAbsoluteUrl(heroMedia.videoUrl) : null;
  const durationIso = heroMedia.durationSec ? `PT${Math.round(heroMedia.durationSec)}S` : undefined;
  const schemaPayloads = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: heroTitle,
      description: pageDescription,
      url: canonical,
      inLanguage,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: heroTitle,
      description: pageDescription,
      image: heroPosterAbsolute,
      brand: {
        '@type': 'Organization',
        name: 'MaxVideoAI',
        url: SITE,
      },
      offers: {
        '@type': 'Offer',
        url: canonical,
        availability: 'https://schema.org/InStock',
      },
    },
    heroVideoAbsolute
      ? {
          '@context': 'https://schema.org',
          '@type': 'VideoObject',
          name: heroTitle,
          description: heroMedia.prompt ?? pageDescription,
          thumbnailUrl: heroPosterAbsolute ? [heroPosterAbsolute] : undefined,
          contentUrl: heroVideoAbsolute,
          uploadDate: new Date().toISOString(),
          duration: durationIso,
          inLanguage,
        }
      : null,
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
          item: canonical,
        },
      ],
    },
    faqList.length
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqList.map((entry) => ({
            '@type': 'Question',
            name: entry.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: entry.answer,
            },
          })),
        }
      : null,
  ].filter(Boolean) as object[];

  return (
    <>
      <Head>
        {heroPosterPreload ? <link rel="preload" as="image" href={heroPosterPreload} fetchPriority="high" /> : null}
        {schemaPayloads.map((schema, index) => (
          <script
            key={`schema-${index}`}
            type="application/ld+json"
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
          />
        ))}
      </Head>
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-14 sm:px-6 lg:px-8">
        <Link href="/models" className="text-sm font-semibold text-accent hover:text-accentSoft">
          {backLabel}
        </Link>

        <section className="mt-6 space-y-4 rounded-3xl border border-hairline bg-white/80 p-6 shadow-card sm:p-8">
          <div className="space-y-6">
            <div className="space-y-3 text-center">
              <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">
                {heroTitle}
              </h1>
              <p className="text-lg font-semibold text-text-primary">
                {heroSubtitle}
              </p>
              {heroBadge ? (
                <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-hairline bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-micro text-text-secondary shadow-card">
                  {heroBadge.split('·').map((chunk, index, arr) => (
                    <span key={`${chunk}-${index}`} className="flex items-center gap-2">
                      <span>{chunk.trim()}</span>
                      {index < arr.length - 1 ? <span aria-hidden>·</span> : null}
                    </span>
                  ))}
                </div>
              ) : null}
              {heroDesc1 ? <p className="text-base text-text-secondary">{heroDesc1}</p> : null}
              {heroDesc2 ? <p className="text-base text-text-secondary">{heroDesc2}</p> : null}
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href={primaryCtaHref}
                className="inline-flex items-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-accentSoft"
              >
                {primaryCta}
              </Link>
              {secondaryCta && secondaryCtaHref ? (
                <Link
                  href={secondaryCtaHref}
                  className="inline-flex items-center rounded-full border border-hairline px-5 py-2 text-sm font-semibold text-text-primary transition hover:border-accent hover:text-accent"
                >
                  {secondaryCta}
                </Link>
              ) : null}
            </div>
            <div className="flex justify-center">
              <div className="w-full max-w-5xl">
                <MediaPreview media={heroMedia} label={heroTitle} />
              </div>
            </div>
            <div className="space-y-3 rounded-2xl border border-hairline bg-bg px-4 py-3">
              {copy.whyTitle ? <p className="text-sm font-semibold text-text-primary">{copy.whyTitle}</p> : null}
              {heroHighlights.length ? (
                <ul className="grid gap-2 text-sm text-text-secondary sm:grid-cols-2">
                  {heroHighlights.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {bestUseCases.length ? (
              <div className="space-y-2 rounded-2xl border border-hairline bg-white/80 p-4 shadow-card">
                {copy.bestUseCasesTitle ? (
                  <p className="text-sm font-semibold text-text-primary">{copy.bestUseCasesTitle}</p>
                ) : null}
                <ul className="grid gap-1 text-sm text-text-secondary sm:grid-cols-2">
                  {bestUseCases.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        <section className="mt-14 space-y-4">
          {copy.whatTitle ? <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:mt-0">{copy.whatTitle}</h2> : null}
          {copy.whatIntro1 ? <p className="text-base text-text-secondary">{copy.whatIntro1}</p> : null}
          {copy.whatIntro2 ? <p className="text-base text-text-secondary">{copy.whatIntro2}</p> : null}
          {whatFlowSteps.length ? (
            <>
              {copy.whatFlowTitle ? (
                <p className="text-base font-semibold text-text-primary">{copy.whatFlowTitle}</p>
              ) : null}
              <ol className="space-y-2 rounded-2xl border border-hairline bg-white/70 p-4 text-sm text-text-secondary">
                {whatFlowSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </>
          ) : null}
        </section>

        {specSections.length ? (
          <section className="mt-14 space-y-4">
            {copy.specTitle ? <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:mt-0">{copy.specTitle}</h2> : null}
            {copy.specNote ? (
              <blockquote className="rounded-2xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-text-secondary">
                {copy.specNote}
              </blockquote>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              {specSections.map((section) => (
                <article
                  key={section.title}
                  className="space-y-2 rounded-2xl border border-hairline bg-white/80 p-4 shadow-card"
                >
                  <h3 className="text-lg font-semibold text-text-primary">{section.title}</h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            {copy.specValueProp ? (
              <p className="text-sm font-semibold text-text-primary">{copy.specValueProp}</p>
            ) : null}
          </section>
        ) : null}

        {copy.microCta ? (
          <div className="mt-10 flex justify-center">
            <Link
              href={primaryCtaHref}
              className="text-sm font-semibold text-accent transition hover:text-accentSoft"
            >
              {copy.microCta}
            </Link>
          </div>
        ) : null}

        <section className="mt-14 space-y-4">
          {copy.galleryTitle ? <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:mt-0">{copy.galleryTitle}</h2> : null}
          {copy.galleryIntro ? <p className="text-base text-text-secondary">{copy.galleryIntro}</p> : null}
          {copy.galleryAllCta ? (
            <p className="text-base text-text-secondary">
              <Link href="/examples?engine=sora-2" className="font-semibold text-accent hover:text-accentSoft">
                {copy.galleryAllCta}
              </Link>
            </p>
          ) : null}
          {galleryVideos.length ? (
            <div className="mt-6 space-y-4">
              <div className="overflow-x-auto pb-2">
                <div className="flex min-w-full gap-4">
                  {galleryVideos.slice(0, 6).map((video) => (
                    <article
                      key={video.id}
                      className="flex w-64 shrink-0 flex-col overflow-hidden rounded-2xl border border-hairline bg-white shadow-card"
                    >
                      <Link href={video.href} className="group relative block aspect-video bg-neutral-100">
                        {video.optimizedPosterUrl || video.rawPosterUrl ? (
                          <Image
                            src={video.optimizedPosterUrl ?? video.rawPosterUrl ?? ''}
                            alt={
                              video.prompt
                                ? `MaxVideoAI ${video.engineLabel} example – ${video.prompt}`
                                : `MaxVideoAI ${video.engineLabel} example`
                            }
                            fill
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                            sizes="256px"
                            quality={70}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-neutral-200 text-xs font-semibold text-text-muted">
                            No preview
                          </div>
                        )}
                      </Link>
                      <div className="space-y-1 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">
                          {video.engineLabel} · {video.durationSec}s
                        </p>
                        <p className="text-sm font-semibold leading-snug text-text-primary line-clamp-2">{video.prompt}</p>
                        {video.recreateHref && copy.recreateLabel ? (
                          <Link
                            href={video.recreateHref}
                            className="inline-flex items-center text-[11px] font-semibold text-accent transition hover:text-accentSoft"
                          >
                            {copy.recreateLabel}
                          </Link>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-hairline bg-white/60 px-4 py-4 text-sm text-text-secondary">
              {copy.galleryIntro ?? 'Sora 2 examples will appear here soon.'}{' '}
              {copy.galleryAllCta ? (
                <Link href="/examples?engine=sora-2" className="font-semibold text-accent hover:text-accentSoft">
                  {copy.galleryAllCta}
                </Link>
              ) : null}
            </div>
          )}
          <div className="mt-4">
            <Link
              href={galleryCtaHref}
              className="inline-flex items-center rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-neutral-800"
            >
              {copy.gallerySceneCta ?? 'Open this scene in Generate →'}
            </Link>
          </div>
        </section>

        <section className="mt-14 space-y-4">
          {copy.promptTitle ? <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:mt-0">{copy.promptTitle}</h2> : null}
          {copy.promptIntro ? <p className="text-base text-text-secondary">{copy.promptIntro}</p> : null}
          <div className="space-y-3 rounded-2xl border border-hairline bg-white/80 p-4 shadow-card">
            {promptPatternSteps.length ? (
              <div className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  {promptPatternSteps.map((step, index) => (
                    <div key={step} className="flex items-start gap-3 rounded-xl bg-bg px-3 py-2 text-sm text-text-secondary">
                      <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-[11px] font-semibold text-accent">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {copy.promptSkeleton || copy.promptSkeletonNote ? (
              <div className="rounded-xl border border-dashed border-hairline bg-bg px-4 py-3 text-sm text-text-secondary">
                {copy.promptSkeleton ? <p className="mt-2 italic">{copy.promptSkeleton}</p> : null}
                {copy.promptSkeletonNote ? <p className="mt-2">{copy.promptSkeletonNote}</p> : null}
              </div>
            ) : null}
          </div>
        </section>

        <section className="mt-14 space-y-4">
          {copy.imageTitle ? <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:mt-0">{copy.imageTitle}</h2> : null}
          {copy.imageIntro ? <p className="text-base text-text-secondary">{copy.imageIntro}</p> : null}
          <div className="grid gap-4 lg:grid-cols-2">
            {imageToVideoSteps.length ? (
              <div className="space-y-3 rounded-2xl border border-hairline bg-white/80 p-4 shadow-card">
                <ol className="list-decimal space-y-2 pl-5 text-sm text-text-secondary">
                  {imageToVideoSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            ) : null}
            {imageToVideoUseCases.length ? (
              <div className="space-y-3 rounded-2xl border border-hairline bg-white/80 p-4 shadow-card">
                <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                  {imageToVideoUseCases.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        <section className="mt-14 space-y-4">
          {copy.multishotTitle ? <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:mt-0">{copy.multishotTitle}</h2> : null}
          {copy.multishotIntro1 ? <p className="text-base text-text-secondary">{copy.multishotIntro1}</p> : null}
          {copy.multishotIntro2 ? <p className="text-base text-text-secondary">{copy.multishotIntro2}</p> : null}
          <div className="space-y-3 rounded-2xl border border-hairline bg-white/80 p-4 shadow-card">
            <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
              {miniFilmTips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
        </section>

        {copy.demoTitle || copy.demoPrompt.length || copy.demoNotes.length ? (
          <section className="mt-14 space-y-6">
            {copy.demoTitle ? <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:mt-0">{copy.demoTitle}</h2> : null}
            <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
              <div className="space-y-4 rounded-2xl border border-hairline bg-white/80 p-4 shadow-card">
                {copy.demoPromptLabel ? (
                  <p className="text-sm font-semibold text-text-primary">{copy.demoPromptLabel}</p>
                ) : null}
                {copy.demoPrompt.length ? (
                  <div className="rounded-xl border border-dashed border-hairline bg-bg px-4 py-3 text-sm text-text-secondary">
                    {copy.demoPrompt.map((line) => (
                      <p key={line} className="mt-2 first:mt-0">
                        {line}
                      </p>
                    ))}
                  </div>
                ) : null}
                {copy.demoNotes.length ? (
                  <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                    {copy.demoNotes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="rounded-2xl border border-hairline bg-white/80 p-3 shadow-card">
                {demoMedia ? (
                  <MediaPreview media={demoMedia} label={copy.demoTitle ?? 'Sora 2 demo'} />
                ) : (
                  <div className="flex h-full min-h-[280px] items-center justify-center rounded-xl border border-dashed border-hairline bg-bg text-sm text-text-secondary">
                    {copy.galleryIntro ?? 'Demo clip coming soon.'}
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {copy.tipsTitle || strengths.length || boundaries.length ? (
          <section className="mt-14 space-y-6">
            {copy.tipsTitle ? <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:mt-0">{copy.tipsTitle}</h2> : null}
            <div className="grid gap-4 lg:grid-cols-2">
              {strengths.length ? (
                <div className="space-y-3 rounded-2xl border border-hairline bg-white/80 p-4 shadow-card">
                  <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                    {strengths.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {boundaries.length ? (
                <div className="space-y-3 rounded-2xl border border-hairline bg-white/80 p-4 shadow-card">
                  <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                    {boundaries.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            {copy.tipsFooter ? <p className="text-sm text-text-secondary">{copy.tipsFooter}</p> : null}
          </section>
        ) : null}

        {copy.safetyTitle || safetyRules.length ? (
          <section className="mt-14 space-y-4">
            {copy.safetyTitle ? <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:mt-0">{copy.safetyTitle}</h2> : null}
            <div className="space-y-3 rounded-2xl border border-hairline bg-white/80 p-4 shadow-card">
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

        {copy.comparisonTitle || comparisonPoints.length ? (
          <section className="mt-14 space-y-4">
            {copy.comparisonTitle ? (
              <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:mt-0">{copy.comparisonTitle}</h2>
            ) : null}
            <div className="space-y-3 rounded-2xl border border-hairline bg-white/80 p-4 shadow-card">
              {comparisonPoints.length ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                  {comparisonPoints.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
              {copy.comparisonCta ? (
                <Link
                  href={secondaryCtaHref}
                  className="inline-flex items-center rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-neutral-800"
                >
                  {copy.comparisonCta}
                </Link>
              ) : null}
            </div>
          </section>
        ) : null}

        {faqList.length ? (
          <section className="mt-14 space-y-4">
            {faqTitle ? <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:mt-0">{faqTitle}</h2> : null}
            <div className="grid gap-3 md:grid-cols-2">
              {faqList.map((entry) => (
                <article
                  key={entry.question}
                  className="rounded-2xl border border-hairline bg-white/80 p-4 shadow-card"
                >
                  <h3 className="text-sm font-semibold text-text-primary">{entry.question}</h3>
                  <p className="mt-2 text-sm text-text-secondary">{entry.answer}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {relatedEngines.length ? (
          <section className="mt-14 space-y-4">
            <h2 className="text-2xl font-semibold text-text-primary">
              {copy.relatedTitle ?? 'Explore other models'}
            </h2>
            {copy.relatedSubtitle ? <p className="text-sm text-text-secondary">{copy.relatedSubtitle}</p> : null}
            <div className="grid gap-4 md:grid-cols-3">
              {relatedEngines.map((entry) => (
                <article
                  key={entry.modelSlug}
                  className="rounded-2xl border border-hairline bg-white/90 p-4 shadow-card transition hover:-translate-y-1 hover:border-accent/60"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">{entry.brandId}</p>
                  <h3 className="mt-2 text-lg font-semibold text-text-primary">
                    {entry.marketingName ?? entry.engine.label}
                  </h3>
                  <p className="mt-2 text-sm text-text-secondary line-clamp-3">
                    {entry.seo?.description ?? localizedContent.overview ?? ''}
                  </p>
                  <Link
                    href={{ pathname: '/models/[slug]', params: { slug: entry.modelSlug } }}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent transition hover:text-accentSoft"
                  >
                    {copy.comparisonCta ?? 'View model →'}
                  </Link>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-14 space-y-3 rounded-3xl border border-hairline bg-white/90 px-6 py-6 text-text-primary shadow-card sm:px-8">
          {copy.finalPara1 ? <p className="text-base text-text-secondary">{copy.finalPara1}</p> : null}
          {copy.finalPara2 ? <p className="text-base text-text-secondary">{copy.finalPara2}</p> : null}
          <Link
            href={primaryCtaHref}
            className="inline-flex w-fit items-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-accentSoft"
          >
            {copy.finalButton ?? primaryCta}
          </Link>
        </section>
      </main>
    </>
  );
}

function MediaPreview({ media, label }: { media: FeaturedMedia; label: string }) {
  const posterSrc = media.posterUrl ?? null;
  return (
    <figure className="group relative overflow-hidden rounded-[22px] border border-hairline bg-white shadow-card">
      <div className="relative w-full overflow-hidden rounded-t-[22px] bg-neutral-100">
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <div className="absolute inset-0">
            {media.videoUrl ? (
              <video
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                poster={posterSrc ?? undefined}
              >
                <source src={media.videoUrl} type="video/mp4" />
              </video>
            ) : posterSrc ? (
              <Image
                src={posterSrc}
                alt={media.prompt ? `Sora 2 preview – ${media.prompt}` : label}
                fill
                className="h-full w-full object-cover"
                sizes="(max-width: 768px) 100vw, 720px"
                quality={80}
                loading="eager"
                fetchPriority="high"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-neutral-50 text-sm font-semibold text-text-muted">
                Sora 2 preview
              </div>
            )}
            {media.hasAudio ? (
              <span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-micro text-white">
                Audio on
              </span>
            ) : null}
            {media.durationSec ? (
              <span className="absolute right-3 top-3 rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-micro text-text-primary shadow-card">
                {media.durationSec}s
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <figcaption className="space-y-1 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{label}</p>
        {media.prompt ? <p className="text-sm font-semibold leading-snug text-text-primary">{media.prompt}</p> : null}
        {media.href ? (
          <Link
            href={media.href}
            className="inline-flex items-center text-xs font-semibold text-accent transition hover:text-accentSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            View render →
          </Link>
        ) : null}
      </figcaption>
    </figure>
  );
}

export default async function ModelDetailPage({ params }: PageParams) {
  const { slug, locale: routeLocale } = params;
  const engine = getFalEngineBySlug(slug);
  if (!engine) {
    notFound();
  }

  if (slug === 'sora-2' || slug === 'sora-2-pro') {
    const activeLocale = routeLocale ?? 'en';
    const { dictionary } = await resolveDictionary();
    const detailCopy: DetailCopy = {
      ...DEFAULT_DETAIL_COPY,
      ...(dictionary.models.detail ?? {}),
      breadcrumb: { ...DEFAULT_DETAIL_COPY.breadcrumb, ...(dictionary.models.detail?.breadcrumb ?? {}) },
    };
    const localizedContent = await getEngineLocalized(slug, activeLocale);
    return await renderSoraModelPage({
      engine,
      backLabel: detailCopy.backLabel,
      localizedContent,
      locale: activeLocale,
      breadcrumb: detailCopy.breadcrumb,
    });
  }

  const { dictionary } = await resolveDictionary();
  const activeLocale = routeLocale ?? 'en';
  if (process.env.NODE_ENV === 'development') {
    console.info('[models/page] locale debug', { slug, routeLocale, activeLocale });
  }
  const localizedContent = await getEngineLocalized(slug, activeLocale);
  const detailSlugMap = buildDetailSlugMap(slug);
  const publishableLocales = Array.from(resolveLocalesForEnglishPath(`/models/${slug}`));
  const metadataUrls = buildMetadataUrls(activeLocale, detailSlugMap, { availableLocales: publishableLocales });
  const allEngines = listFalEngines();
  const rankEngine = (entry: FalEngineEntry) => (entry.family === engine.family ? 0 : 1);
  type RelatedCopyContent = { title?: string; subtitle?: string; cta?: string };
  const relatedContent = (dictionary.models as typeof dictionary.models & { related?: RelatedCopyContent }).related ?? {};
  const relatedEngines = allEngines
    .filter((entry) => entry.modelSlug !== slug)
    .sort((a, b) => {
      const familyDiff = rankEngine(a) - rankEngine(b);
      if (familyDiff !== 0) {
        return familyDiff;
      }
      return (a.marketingName ?? a.engine.label).localeCompare(b.marketingName ?? b.engine.label);
    })
    .slice(0, 3);
  const relatedCopy = {
    title: relatedContent.title ?? 'Explore other engines',
    subtitle:
      relatedContent.subtitle ?? 'Compare price tiers, latency, and prompt presets across the rest of the catalog.',
    cta: relatedContent.cta ?? 'View model →',
  };

  const detailCopy: DetailCopy = {
    ...DEFAULT_DETAIL_COPY,
    ...(dictionary.models.detail ?? {}),
    overview: {
      ...DEFAULT_DETAIL_COPY.overview,
      ...(dictionary.models.detail?.overview ?? {}),
    },
    logoPolicies: {
      ...DEFAULT_DETAIL_COPY.logoPolicies,
      ...(dictionary.models.detail?.logoPolicies ?? {}),
    },
    buttons: {
      ...DEFAULT_DETAIL_COPY.buttons,
      ...(dictionary.models.detail?.buttons ?? {}),
    },
    breadcrumb: {
      ...DEFAULT_DETAIL_COPY.breadcrumb,
      ...(dictionary.models.detail?.breadcrumb ?? {}),
    },
  };

  const marketingName = localizedContent.marketingName ?? engine.marketingName;
  const versionLabel = localizedContent.versionLabel ?? engine.versionLabel;
  const seoDescription = localizedContent.seo.description ?? engine.seo.description ?? null;
  const overviewSummary = localizedContent.overview ?? seoDescription;
  const heroContent = localizedContent.hero;
  const introText = heroContent?.intro ?? overviewSummary;
  const bestUseCases = localizedContent.bestUseCases;
  const technicalOverview = localizedContent.technicalOverview ?? [];
  const technicalOverviewTitle = localizedContent.technicalOverviewTitle ?? 'Technical overview';
  const promptStructure = localizedContent.promptStructure;
  const tips = localizedContent.tips;
  const compareLink = localizedContent.compareLink;
  const heroPrimaryCta = heroContent?.ctaPrimary;
  const secondaryCtas = heroContent?.secondaryLinks ?? [];
  const brand = PARTNER_BRAND_MAP.get(engine.brandId);
  const showSoraSeo = engine.modelSlug.startsWith('sora-2');
  const promptEntries =
    localizedContent.prompts.length > 0
      ? localizedContent.prompts
      : engine.prompts.map(({ title, prompt, notes }) => ({ title, prompt, notes }));
  const faqEntries =
    localizedContent.faqs.length > 0
      ? localizedContent.faqs
      : (engine.faqs ?? []).map(({ question, answer }) => ({ question, answer }));
  const pricingNotes = localizedContent.pricingNotes ?? null;
  const canonicalUrl = metadataUrls.canonical.replace(/\/+$/, '') || metadataUrls.canonical;
  const breadcrumbTitleBase = localizedContent.seo.title ?? marketingName ?? slug;
  const breadcrumbTitle = breadcrumbTitleBase.replace(/ —.*$/, '');
  const localePathPrefix = localePathnames[activeLocale] ? `/${localePathnames[activeLocale].replace(/^\/+/, '')}` : '';
  const homePathname = localePathPrefix || '/';
  const localizedHomeUrl = homePathname === '/' ? `${SITE}/` : `${SITE}${homePathname}`;
  const localizedModelsSlug = (MODELS_BASE_PATH_MAP[activeLocale] ?? 'models').replace(/^\/+/, '');
  const modelsPathname =
    homePathname === '/'
      ? `/${localizedModelsSlug}`
      : `${homePathname.replace(/\/+$/, '')}/${localizedModelsSlug}`.replace(/\/{2,}/g, '/');
  const localizedModelsUrl = `${SITE}${modelsPathname}`;
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: detailCopy.breadcrumb.home,
        item: localizedHomeUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: detailCopy.breadcrumb.models,
        item: localizedModelsUrl,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: breadcrumbTitle,
        item: canonicalUrl,
      },
    ],
  };
  const platformPriceInfo = detailCopy.overview.platformPrice
    ? {
        label: detailCopy.overview.platformPrice,
        href: '/generate',
      }
    : null;

  const soraSoftwareSchema = showSoraSeo
    ? {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'OpenAI Sora 2 via MaxVideo AI',
        applicationCategory: 'VideoGenerationApplication',
        operatingSystem: 'Web',
        provider: {
          '@type': 'Organization',
          name: 'MaxVideo AI',
          url: 'https://maxvideoai.com',
        },
        description: seoDescription ?? undefined,
        isAccessibleForFree: false,
      }
    : null;
  const schemaPayloads = [showSoraSeo && soraSoftwareSchema, breadcrumbLd].filter(Boolean) as object[];
  const heroPosterSrc = localizedContent.seo.image ?? engine.media?.imagePath ?? null;
  const heroPosterPreload = heroPosterSrc ? buildOptimizedPosterUrl(heroPosterSrc) ?? heroPosterSrc : null;

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      {heroPosterPreload ? (
        <Head>
          <link rel="preload" as="image" href={heroPosterPreload} fetchPriority="high" />
        </Head>
      ) : null}
      {schemaPayloads.map((schema, index) => (
        <script
          key={`schema-${index}`}
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
        />
      ))}
      <Link href="/models" className="text-sm font-semibold text-accent hover:text-accentSoft">
        {detailCopy.backLabel}
      </Link>
      <header className="mt-6 space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          {brand && engine.logoPolicy === 'logoAllowed' ? (
            <span className="flex items-center">
              <Image src={brand.assets.light.svg} alt={`${marketingName} logo`} width={140} height={32} className="h-9 w-auto dark:hidden" />
              <Image src={brand.assets.dark.svg} alt={`${marketingName} logo`} width={140} height={32} className="hidden h-9 w-auto dark:inline-flex" />
            </span>
          ) : null}
          <div>
            <h2 className="text-3xl font-semibold text-text-primary sm:text-4xl">
              {heroContent?.title ?? marketingName}
            </h2>
            {versionLabel ? (
              <p className="text-sm uppercase tracking-micro text-text-muted">{versionLabel}</p>
            ) : null}
          </div>
          
        </div>
      {introText ? <p className="text-sm text-text-secondary">{introText}</p> : null}
      </header>

      {(heroPrimaryCta?.label || secondaryCtas.length) ? (
        <div className="mt-6 flex flex-wrap gap-3">
          {heroPrimaryCta?.label && heroPrimaryCta.href ? (
            <Link
              href={heroPrimaryCta.href}
              className="inline-flex items-center rounded-pill bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-accentSoft"
            >
              {heroPrimaryCta.label}
            </Link>
          ) : null}
          {secondaryCtas
            .filter((cta): cta is { label: string; href: string } => Boolean(cta.label && cta.href))
            .map((cta) => (
              <Link
                key={`${cta.href}-${cta.label}`}
                href={cta.href!}
                className="inline-flex items-center rounded-pill border border-hairline px-5 py-2 text-sm font-semibold text-text-primary transition hover:border-accent hover:text-accent"
              >
                {cta.label}
              </Link>
            ))}
        </div>
      ) : null}

      {bestUseCases?.items && bestUseCases.items.length ? (
        <section className="mt-10 rounded-card border border-hairline bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold text-text-primary">
            {bestUseCases.title ?? 'Best use cases'}
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-text-secondary">
            {bestUseCases.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {technicalOverview.length ? (
        <section className="mt-10 rounded-card border border-hairline bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold text-text-primary">{technicalOverviewTitle}</h2>
          <div className="mt-4 grid gap-4 text-sm text-text-secondary sm:grid-cols-2">
            {technicalOverview.map((entry, index) => (
              <article key={`${entry.label ?? index}-${entry.body}`} className="space-y-1">
                {entry.label ? <strong className="block text-text-primary">{entry.label}</strong> : null}
                {entry.body ? <p>{entry.body}</p> : null}
                {entry.link?.href && entry.link?.label ? (
                  <a
                    href={entry.link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-accent hover:text-accentSoft"
                  >
                    {entry.link.label}
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {promptStructure ? (
        <section className="mt-10 rounded-card border border-hairline bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold text-text-primary">{promptStructure.title ?? 'Prompt structure'}</h2>
          {promptStructure.quote ? (
            <blockquote className="mt-3 border-l-2 border-accent pl-3 text-sm text-text-secondary italic">
              {promptStructure.quote}
            </blockquote>
          ) : null}
          {promptStructure.description ? (
            <p className="mt-3 text-sm text-text-secondary">{promptStructure.description}</p>
          ) : null}
          {promptStructure.steps && promptStructure.steps.length ? (
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-text-secondary">
              {promptStructure.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {tips?.items && tips.items.length ? (
        <section className="mt-10 rounded-card border border-hairline bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold text-text-primary">{tips.title ?? 'Tips & tricks'}</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-text-secondary">
            {tips.items.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {compareLink?.href && compareLink.label ? (
        <p className="mt-6 text-sm text-text-secondary">
          {compareLink.before ?? ''}
          <Link href={compareLink.href} className="font-semibold text-accent hover:text-accentSoft">
            {compareLink.label}
          </Link>
          {compareLink.after ?? ''}
        </p>
      ) : null}

      <section className="mt-10 space-y-4">
        <div className="rounded-card border border-hairline bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold text-text-primary">{detailCopy.overviewTitle}</h2>
          <dl className="mt-4 grid gap-3 text-sm text-text-secondary sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-micro text-text-muted">{detailCopy.overview.brand}</dt>
              <dd>{brand ? brand.label : engine.brandId}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-micro text-text-muted">{detailCopy.overview.engineId}</dt>
              <dd>{engine.id}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-micro text-text-muted">{detailCopy.overview.slug}</dt>
              <dd>/models/{engine.modelSlug}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-micro text-text-muted">{detailCopy.overview.logoPolicy}</dt>
              <dd>{detailCopy.logoPolicies[engine.logoPolicy as keyof DetailCopy['logoPolicies']] ?? detailCopy.logoPolicies.textOnly}</dd>
            </div>
            {platformPriceInfo ? (
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-micro text-text-muted">{detailCopy.overview.platformPrice}</dt>
                <dd>
                  <Link href={platformPriceInfo.href} className="text-sm font-semibold text-accent hover:text-accentSoft">
                    {platformPriceInfo.label}
                  </Link>
                </dd>
              </div>
            ) : null}
          </dl>
          {pricingNotes ? <p className="mt-3 text-xs text-text-muted">{pricingNotes}</p> : null}
        </div>
      </section>

      {promptEntries.length > 0 && (
        <section className="mt-10 space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">{detailCopy.promptsTitle}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {promptEntries.map((entry) => (
              <article key={entry.title} className="rounded-card border border-hairline bg-white p-4 text-sm text-text-secondary shadow-card">
                <h3 className="text-sm font-semibold text-text-primary">{entry.title}</h3>
                <p className="mt-1 text-sm text-text-secondary">{entry.prompt}</p>
                {entry.notes ? <p className="mt-2 text-xs text-text-muted">{entry.notes}</p> : null}
              </article>
            ))}
          </div>
        </section>
      )}

      {faqEntries.length > 0 && (
        <section className="mt-10 space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">{detailCopy.faqTitle}</h2>
          <div className="space-y-3 text-sm text-text-secondary">
            {faqEntries.map(({ question, answer }) => (
              <article key={question} className="rounded-card border border-hairline bg-white p-4 shadow-card">
                <h3 className="text-sm font-semibold text-text-primary">{question}</h3>
                <p className="mt-1 text-sm text-text-secondary">{answer}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {relatedEngines.length ? (
        <section className="mt-12">
          <div className="mb-6 space-y-2">
            <h2 className="text-xl font-semibold text-text-primary">{relatedCopy.title}</h2>
            <p className="text-sm text-text-secondary">{relatedCopy.subtitle}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {relatedEngines.map((candidate) => {
              const label = candidate.marketingName ?? candidate.engine.label;
              return (
                <article key={candidate.modelSlug} className="rounded-2xl border border-hairline bg-white/90 p-5 shadow-card">
                  <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{candidate.brandId}</p>
                  <h3 className="mt-2 text-lg font-semibold text-text-primary">{label}</h3>
                  <p className="mt-2 text-sm text-text-secondary">
                    {candidate.seo?.description ?? 'Latency, pricing, and prompt guides are documented on the detail page.'}
                  </p>
                  <Link
                    href={{ pathname: '/models/[slug]', params: { slug: candidate.modelSlug } }}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent transition hover:text-accentSoft"
                  >
                    {relatedCopy.cta} <span aria-hidden>→</span>
                  </Link>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <footer className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/generate"
          className="inline-flex items-center rounded-pill border border-hairline px-4 py-2 text-sm font-semibold text-text-primary transition hover:border-accent hover:text-accent"
        >
          {detailCopy.buttons.pricing}
        </Link>
        <Link
          href="/app"
          className="inline-flex items-center rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-accentSoft"
        >
          {detailCopy.buttons.launch}
        </Link>
      </footer>
    </div>
  );
}
