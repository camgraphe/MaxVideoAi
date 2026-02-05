import { Link, type LocalizedLinkHref } from '@/i18n/navigation';
import Image from 'next/image';
import Head from 'next/head';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { resolveDictionary } from '@/lib/i18n/server';
import { PARTNER_BRAND_MAP } from '@/lib/brand-partners';
import { listFalEngines, getFalEngineBySlug, type FalEngineEntry } from '@/config/falEngines';
import { locales, localePathnames, localeRegions, type AppLocale } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { resolveLocalesForEnglishPath } from '@/lib/seo/alternateLocales';
import { getEngineLocalized, type EngineLocalizedContent } from '@/lib/models/i18n';
import { buildOptimizedPosterUrl } from '@/lib/media-helpers';
import { normalizeEngineId } from '@/lib/engine-alias';
import type { EngineCaps } from '@/types/engines';
import { type ExampleGalleryVideo } from '@/components/examples/ExamplesGalleryGrid';
import { listExamples, getVideosByIds, type GalleryVideo } from '@/server/videos';
import { FAQSchema } from '@/components/seo/FAQSchema';
import { computePricingSnapshot } from '@/lib/pricing';
import { applyEnginePricingOverride } from '@/lib/pricing-definition';
import { listEnginePricingOverrides } from '@/server/engine-settings';
import { serializeJsonLd } from '../model-jsonld';
import { ButtonLink } from '@/components/ui/Button';
import { TextLink } from '@/components/ui/TextLink';
import { BackLink } from '@/components/video/BackLink';
import { getExamplesHref } from '@/lib/examples-links';

type PageParams = {
  params: {
    locale: AppLocale;
    slug: string;
  };
};

function buildCanonicalComparePath({
  compareBase,
  pairSlug,
  orderSlug,
}: {
  compareBase: string;
  pairSlug: string;
  orderSlug?: string;
}): string {
  const sanitizedBase = compareBase.replace(/^\/+|\/+$/g, '');
  const normalizedPair = pairSlug ? pairSlug.replace(/^\/+/, '') : '';
  if (!normalizedPair) {
    return `/${sanitizedBase}`.replace(/\/{2,}/g, '/');
  }
  const parts = normalizedPair
    .split('-vs-')
    .map((part) => part.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean);
  let canonicalPair = normalizedPair;
  let orderParam = '';
  if (parts.length === 2) {
    const sorted = [...parts].sort();
    canonicalPair = `${sorted[0]}-vs-${sorted[1]}`;
    if (orderSlug && sorted.includes(orderSlug) && orderSlug !== sorted[0]) {
      orderParam = `?order=${encodeURIComponent(orderSlug)}`;
    }
  } else if (orderSlug) {
    orderParam = `?order=${encodeURIComponent(orderSlug)}`;
  }
  return `/${sanitizedBase}/${canonicalPair}${orderParam}`.replace(/\/{2,}/g, '/');
}

const LOCALE_PREFIX_PATTERN = /^\/(fr|es)(?=\/)/i;
const NON_LOCALIZED_PREFIXES = [
  '/app',
  '/dashboard',
  '/jobs',
  '/billing',
  '/settings',
  '/generate',
  '/login',
  '/auth',
  '/video',
];

function stripLocalePrefix(pathname: string): string {
  return pathname.replace(LOCALE_PREFIX_PATTERN, '');
}

function resolveExamplesHrefFromRaw(rawHref?: string | null): LocalizedLinkHref | null {
  if (!rawHref) return null;
  let pathname = rawHref;
  let search = '';
  try {
    const url = new URL(rawHref, SITE);
    pathname = url.pathname || rawHref;
    search = url.search || '';
  } catch {
    const [pathPart, queryPart] = rawHref.split('?');
    pathname = pathPart || rawHref;
    search = queryPart ? `?${queryPart}` : '';
  }
  const normalizedPath = stripLocalePrefix(pathname);
  if (!normalizedPath.startsWith('/examples')) {
    return null;
  }
  const segments = normalizedPath.split('/').filter(Boolean);
  const modelSlug = segments[1];
  const params = new URLSearchParams(search);
  const engineSlug = params.get('engine');
  const candidate = modelSlug || engineSlug;
  return candidate ? getExamplesHref(candidate) : { pathname: '/examples' };
}

function resolveNonLocalizedHref(rawHref?: string | null): string | null {
  if (!rawHref) return null;
  let pathname = rawHref;
  let search = '';
  let hash = '';
  try {
    const url = new URL(rawHref, SITE);
    pathname = url.pathname || rawHref;
    search = url.search || '';
    hash = url.hash || '';
  } catch {
    const [pathPart, hashPart] = rawHref.split('#');
    const [pathOnly, queryPart] = pathPart.split('?');
    pathname = pathOnly || rawHref;
    search = queryPart ? `?${queryPart}` : '';
    hash = hashPart ? `#${hashPart}` : '';
  }
  const normalizedPath = stripLocalePrefix(pathname);
  if (!NON_LOCALIZED_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))) {
    return null;
  }
  return `${normalizedPath}${search}${hash}`;
}

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
  'veo-3-1': {
    hero: 'job_a3e088db-b1e2-430f-83b3-2efce518c282',
    demo: 'job_8547a19e-ebad-4376-8889-1d88355c0f52',
  },
  'veo-3-1-fast': {
    hero: 'job_4db2339c-000a-4b81-a68c-9314dd7940b2',
    demo: 'job_e34e8979-9056-4564-bbfd-27e8d886fa26',
  },
  'pika-text-to-video': {
    hero: 'job_af053cfc-3164-4e25-9f5a-8a89f006617e',
    demo: 'job_f5992c71-a197-482f-8d0f-028f261ed27b',
  },
  'wan-2-5': {
    hero: 'job_4b882003-b595-4d4e-b62c-1ae22f002bcf',
    demo: 'job_f77a31c6-1549-471a-8fb1-1eb44c523390',
  },
  'kling-2-5-turbo': {
    hero: null,
    demo: 'job_b8db408a-7b09-4268-ad10-48e9cb8fc4a7',
  },
};

type SpecSection = { title: string; items: string[] };
type LocalizedFaqEntry = { question: string; answer: string };
type QuickStartBlock = { title: string; subtitle?: string | null; steps: string[] };

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
  quickStartTitle: string | null;
  quickStartBlocks: QuickStartBlock[];
  howToLatamTitle: string | null;
  howToLatamSteps: string[];
  specTitle: string | null;
  specNote: string | null;
  specSections: SpecSection[];
  specValueProp: string | null;
  quickPricingTitle: string | null;
  quickPricingItems: string[];
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
  troubleshootingTitle: string | null;
  troubleshootingItems: string[];
  tipsFooter: string | null;
  safetyTitle: string | null;
  safetyRules: string[];
  safetyInterpretation: string[];
  safetyNote: string | null;
  comparisonTitle: string | null;
  comparisonPoints: string[];
  comparisonCta: string | null;
  relatedCtaSora2: string | null;
  relatedCtaSora2Pro: string | null;
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
const PROVIDER_INFO_MAP: Record<string, { name: string; url: string }> = {
  openai: { name: 'OpenAI', url: 'https://openai.com' },
  'google-veo': { name: 'Google DeepMind', url: 'https://deepmind.google/technologies/veo/' },
  pika: { name: 'Pika Labs', url: 'https://pika.art' },
  minimax: { name: 'MiniMax', url: 'https://www.minimaxi.com' },
  kling: { name: 'Kling by Kuaishou', url: 'https://www.kuaishou.com/en' },
  wan: { name: 'Wan AI', url: 'https://www.wan-ai.com' },
  lightricks: { name: 'Lightricks', url: 'https://www.lightricks.com' },
};
const AVAILABILITY_SCHEMA_MAP: Record<string, string> = {
  available: 'https://schema.org/InStock',
  limited: 'https://schema.org/LimitedAvailability',
  waitlist: 'https://schema.org/PreOrder',
  paused: 'https://schema.org/Discontinued',
};

function resolveProviderInfo(engine: FalEngineEntry) {
  const fallback = PARTNER_BRAND_MAP.get(engine.brandId);
  const override = PROVIDER_INFO_MAP[engine.brandId];
  return {
    name: override?.name ?? fallback?.label ?? engine.brandId,
    url: override?.url ?? fallback?.availabilityLink ?? SITE,
  };
}

function buildOfferSchema(canonical: string, engine: FalEngineEntry) {
  return {
    '@type': 'Offer',
    url: canonical,
    priceCurrency: 'USD',
    price: '0',
    availability: AVAILABILITY_SCHEMA_MAP[engine.availability] ?? AVAILABILITY_SCHEMA_MAP.limited,
    description: 'Pay-as-you-go pricing (varies by provider and duration).',
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      price: 0,
      priceCurrency: 'USD',
      referenceQuantity: {
        '@type': 'QuantitativeValue',
        value: 1,
        unitCode: 'SEC',
      },
    },
  };
}

function buildProductSchema({
  engine,
  canonical,
  description,
  heroTitle,
  heroPosterAbsolute,
}: {
  engine: FalEngineEntry;
  canonical: string;
  description: string;
  heroTitle: string;
  heroPosterAbsolute: string | null;
}) {
  const provider = resolveProviderInfo(engine);
  const offer = buildOfferSchema(canonical, engine);
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: heroTitle,
    description,
    category: 'AI Video Generator',
    url: canonical,
    image: heroPosterAbsolute ? [heroPosterAbsolute] : undefined,
    brand: {
      '@type': 'Brand',
      name: provider.name,
      url: provider.url,
    },
    manufacturer: {
      '@type': 'Organization',
      name: provider.name,
      url: provider.url,
    },
    offers: offer,
  };
}

function buildSoftwareSchema({
  engine,
  canonical,
  description,
  heroTitle,
}: {
  engine: FalEngineEntry;
  canonical: string;
  description: string;
  heroTitle: string;
}) {
  const provider = resolveProviderInfo(engine);
  const offer = buildOfferSchema(canonical, engine);
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: heroTitle,
    description,
    applicationCategory: 'VideoGenerationApplication',
    operatingSystem: 'Web',
    url: canonical,
    provider: {
      '@type': 'Organization',
      name: provider.name,
      url: provider.url,
    },
    offers: offer,
  };
}
const MODELS_BASE_PATH_MAP = buildSlugMap('models');
const COMPARE_BASE_PATH_MAP = buildSlugMap('compare');
const COMPARE_EXCLUDED_SLUGS = new Set(['nano-banana', 'nano-banana-pro']);

function buildDetailSlugMap(slug: string) {
  return locales.reduce<Record<AppLocale, string>>((acc, locale) => {
    const base = MODELS_BASE_PATH_MAP[locale] ?? 'models';
    acc[locale] = `${base}/${slug}`;
    return acc;
  }, {} as Record<AppLocale, string>);
}

const PRICING_SECTION_TITLES = {
  en: 'Pricing',
  fr: 'Tarifs',
  es: 'Precios',
} as const;

const PRICING_SECTION_MATCH = new Set(['pricing', 'tarifs', 'precios']);
const PRICING_EXTRA_MARKERS = ['exemples rapides', 'quick examples', 'ejemplos rápidos'];

function formatPerSecond(locale: AppLocale, currency: string, amount: number) {
  const region = localeRegions[locale] ?? 'en-US';
  return new Intl.NumberFormat(region, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatCurrency(locale: AppLocale, currency: string, amount: number) {
  const region = localeRegions[locale] ?? 'en-US';
  return new Intl.NumberFormat(region, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatPricingLine(locale: AppLocale, amountLabel: string, resolution: string) {
  const spacer = locale === 'en' ? 'at' : 'en';
  return `${amountLabel}/s ${spacer} ${resolution}`;
}

function selectPricingResolutions(resolutions: string[]): string[] {
  const preferred = ['720p', '1080p', '4k', '1440p', '768p', '512p'];
  const byKey = new Map(resolutions.map((value) => [value.toLowerCase(), value]));
  const ordered: string[] = [];
  preferred.forEach((key) => {
    const match = byKey.get(key);
    if (match) ordered.push(match);
  });
  resolutions.forEach((value) => {
    if (!ordered.includes(value)) ordered.push(value);
  });
  return ordered.slice(0, 3);
}

function parseDurationValue(raw: number | string | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return Math.round(raw);
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return Math.round(numeric);
  }
  return null;
}

function selectQuickDurations(engine: EngineCaps): number[] {
  const durationField = engine.inputSchema?.optional?.find((field) =>
    field.id === 'duration_seconds' || field.id === 'duration'
  );
  const values = new Set<number>();

  if (Array.isArray(durationField?.values)) {
    durationField.values.forEach((value) => {
      const parsed = parseDurationValue(value);
      if (parsed) values.add(parsed);
    });
  }

  if (!values.size) {
    const minRaw = typeof durationField?.min === 'number' ? durationField.min : 1;
    const maxRaw = typeof durationField?.max === 'number' ? durationField.max : engine.maxDurationSec ?? minRaw;
    const min = Math.max(1, Math.round(minRaw));
    const max = Math.max(min, Math.round(maxRaw));
    const mid = Math.round((min + max) / 2);
    values.add(min);
    values.add(mid);
    values.add(max);
  }

  const sorted = Array.from(values).filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (sorted.length <= 3) return sorted;

  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const mid = sorted[Math.floor(sorted.length / 2)];
  return Array.from(new Set([min, mid, max]));
}

function resolveDefaultResolution(engine: EngineCaps): string | null {
  const resolutionField = engine.inputSchema?.optional?.find((field) => field.id === 'resolution');
  const defaultValue = typeof resolutionField?.default === 'string' ? resolutionField.default : null;
  const allowedValues = Array.isArray(resolutionField?.values) ? resolutionField.values : [];
  if (defaultValue && (!allowedValues.length || allowedValues.includes(defaultValue))) {
    return defaultValue;
  }
  const fallback = (engine.resolutions ?? []).find((value) => value && value !== 'auto');
  return fallback ?? null;
}

async function buildPricingItems(engine: EngineCaps, locale: AppLocale): Promise<string[]> {
  const hasVideoMode = engine.modes?.some((mode) => ['t2v', 'i2v', 'r2v'].includes(mode));
  if (!hasVideoMode) return [];
  const resolutions = (engine.resolutions ?? []).filter((value) => value && value !== 'auto');
  if (!resolutions.length) return [];

  const targetResolutions = selectPricingResolutions(resolutions);
  const requestedDuration = 5;
  const items: string[] = [];

  for (const resolution of targetResolutions) {
    try {
      const snapshot = await computePricingSnapshot({
        engine,
        durationSec: requestedDuration,
        resolution,
        membershipTier: 'member',
      });
      const seconds = typeof snapshot.base.seconds === 'number' ? snapshot.base.seconds : requestedDuration;
      const perSecond = seconds > 0 ? snapshot.totalCents / seconds / 100 : snapshot.totalCents / 100;
      const amountLabel = formatPerSecond(locale, snapshot.currency ?? 'USD', perSecond);
      items.push(formatPricingLine(locale, amountLabel, resolution));
    } catch {
      // ignore pricing failures for marketing surface
    }
  }

  return items;
}

async function buildQuickPricingItems(engine: EngineCaps, locale: AppLocale): Promise<string[]> {
  const durations = selectQuickDurations(engine);
  const resolution = resolveDefaultResolution(engine);
  if (!durations.length || !resolution) return [];
  const items: string[] = [];

  for (const durationSec of durations) {
    try {
      const snapshot = await computePricingSnapshot({
        engine,
        durationSec,
        resolution,
        membershipTier: 'member',
      });
      const amountLabel = formatCurrency(locale, snapshot.currency ?? 'USD', snapshot.totalCents / 100);
      items.push(`${durationSec}s: ${amountLabel}`);
    } catch {
      // ignore pricing failures for marketing surface
    }
  }

  return items;
}

function extractPricingExtras(items: string[]): string[] {
  const index = items.findIndex((item) => {
    const normalized = item.trim().toLowerCase();
    return PRICING_EXTRA_MARKERS.some((marker) => normalized.startsWith(marker));
  });
  if (index < 0) return [];
  return items.slice(index);
}

function applyPricingSection(sections: SpecSection[], locale: AppLocale, pricingItems: string[]): SpecSection[] {
  if (!pricingItems.length) return sections;
  const title = PRICING_SECTION_TITLES[locale] ?? PRICING_SECTION_TITLES.en;
  const index = sections.findIndex((section) =>
    PRICING_SECTION_MATCH.has(section.title.trim().toLowerCase())
  );
  if (index < 0) {
    return [...sections, { title, items: pricingItems }];
  }
  const next = [...sections];
  const extras = extractPricingExtras(next[index].items);
  next[index] = { ...next[index], items: extras.length ? [...pricingItems, ...extras] : pricingItems };
  return next;
}

type DetailCopy = {
  backLabel: string;
  examplesLinkLabel: string;
  pricingLinkLabel: string;
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
  examplesLinkLabel: 'See examples',
  pricingLinkLabel: 'Compare pricing',
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
  const getQuickStartBlocks = (): QuickStartBlock[] => {
    const value = custom['quickStartBlocks'];
    if (!Array.isArray(value)) return [];
    return value.reduce<QuickStartBlock[]>((blocks, entry) => {
      if (!entry || typeof entry !== 'object') return blocks;
      const obj = entry as Record<string, unknown>;
      const title = typeof obj.title === 'string' ? obj.title : null;
      const subtitle = typeof obj.subtitle === 'string' ? obj.subtitle : null;
      const stepsRaw = obj.steps;
      const steps = Array.isArray(stepsRaw)
        ? stepsRaw.map((item) => (typeof item === 'string' ? item : '')).filter(Boolean)
        : [];
      if (!title || !steps.length) return blocks;
      blocks.push({ title, subtitle, steps });
      return blocks;
    }, []);
  };

  const fallbackSpecSections = (): SpecSection[] => {
    if (!localized.technicalOverview || !localized.technicalOverview.length) return [];
    const items = localized.technicalOverview
      .map((entry) => {
        if (!entry?.body) return entry?.label ?? null;
        if (entry.label) return `${entry.label}: ${entry.body}`;
        return entry.body;
      })
      .filter((item): item is string => Boolean(item && item.trim().length));
    if (!items.length) return [];
    return [
      {
        title: localized.technicalOverviewTitle ?? 'Specs',
        items,
      },
    ];
  };

  const bestUseCasesTitle = localized.bestUseCases?.title ?? getString('bestUseCasesTitle') ?? 'Best use cases';
  const bestUseCases = localized.bestUseCases?.items ?? getStringArray('bestUseCases');
  const heroHighlights = getStringArray('heroHighlights').length
    ? getStringArray('heroHighlights')
    : (bestUseCases ?? []).slice(0, 4);
  const specSections = (() => {
    const sections = getSpecSections();
    if (sections.length) return sections;
    return fallbackSpecSections();
  })();
  const specTitle = getString('specTitle') ?? localized.technicalOverviewTitle ?? 'Specs';
  const specNote = getString('specNote') ?? localized.pricingNotes ?? null;
  const promptTitle = getString('promptTitle') ?? localized.promptStructure?.title ?? 'Prompt ideas';
  const promptIntro = getString('promptIntro') ?? localized.promptStructure?.description ?? null;
  const promptPatternSteps =
    getStringArray('promptPatternSteps').length > 0
      ? getStringArray('promptPatternSteps')
      : localized.promptStructure?.steps ?? [];
  const promptSkeleton = getString('promptSkeleton') ?? localized.promptStructure?.quote ?? null;
  const promptSkeletonNote = getString('promptSkeletonNote') ?? localized.promptStructure?.description ?? null;

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
    heroHighlights,
    bestUseCasesTitle,
    bestUseCases,
    whatTitle: getString('whatTitle'),
    whatIntro1: getString('whatIntro1'),
    whatIntro2: getString('whatIntro2'),
    whatFlowTitle: getString('whatFlowTitle'),
    whatFlowSteps: getStringArray('whatFlowSteps'),
    quickStartTitle: getString('quickStartTitle'),
    quickStartBlocks: getQuickStartBlocks(),
    howToLatamTitle: getString('howToLatamTitle'),
    howToLatamSteps: getStringArray('howToLatamSteps'),
    specTitle,
    specNote,
    specSections,
    specValueProp: getString('specValueProp'),
    quickPricingTitle: getString('quickPricingTitle'),
    quickPricingItems: getStringArray('quickPricingItems'),
    microCta: getString('microCta'),
    galleryTitle: getString('galleryTitle'),
    galleryIntro: getString('galleryIntro'),
    gallerySceneCta: getString('gallerySceneCta'),
    galleryAllCta: getString('galleryAllCta'),
    recreateLabel: getString('recreateLabel'),
    promptTitle,
    promptIntro,
    promptPatternSteps,
    promptSkeleton,
    promptSkeletonNote,
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
    troubleshootingTitle: getString('troubleshootingTitle'),
    troubleshootingItems: getStringArray('troubleshootingItems'),
    tipsFooter: getString('tipsFooter'),
    safetyTitle: getString('safetyTitle'),
    safetyRules: getStringArray('safetyRules'),
    safetyInterpretation: getStringArray('safetyInterpretation'),
    safetyNote: getString('safetyNote'),
    comparisonTitle: getString('comparisonTitle'),
    comparisonPoints: getStringArray('comparisonPoints'),
    comparisonCta: getString('comparisonCta'),
    relatedCtaSora2: getString('relatedCtaSora2'),
    relatedCtaSora2Pro: getString('relatedCtaSora2Pro'),
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
  const fallbackTitle = engine.seo.title ?? `${engine.marketingName} — MaxVideo AI`;
  const title = localized.seo.title ?? fallbackTitle;
  const description =
    localized.seo.description ??
    engine.seo.description ??
    'Explore availability, prompts, pricing, and render policies for this model on MaxVideoAI.';
  const ogImagePath = localized.seo.image ?? MODEL_OG_IMAGE_MAP[slug] ?? engine.media?.imagePath ?? '/og/price-before.png';
  return buildSeoMetadata({
    locale,
    title,
    description,
    slugMap: detailSlugMap,
    englishPath: `/models/${slug}`,
    availableLocales: publishableLocales,
    image: ogImagePath,
    imageAlt: title,
    ogType: 'article',
    robots: {
      index: true,
      follow: true,
    },
  });
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
  aspectRatio?: string | null;
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
  engineSlug = 'sora-2',
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
    recreateHref: `/app?engine=${encodeURIComponent(engineSlug)}&from=${encodeURIComponent(video.id)}`,
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
    aspectRatio: entry.aspectRatio,
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
  detailCopy,
  localizedContent,
  locale,
}: {
  engine: FalEngineEntry;
  detailCopy: DetailCopy;
  localizedContent: EngineLocalizedContent;
  locale: AppLocale;
}) {
  const detailSlugMap = buildDetailSlugMap(engine.modelSlug);
  const publishableLocales = Array.from(resolveLocalesForEnglishPath(`/models/${engine.modelSlug}`));
  const metadataUrls = buildMetadataUrls(locale, detailSlugMap, {
    englishPath: `/models/${engine.modelSlug}`,
    availableLocales: publishableLocales,
  });
  const canonicalRaw = metadataUrls.canonical;
  const canonicalUrl = canonicalRaw.replace(/\/+$/, '') || canonicalRaw;
  const localizedCanonicalUrl = canonicalUrl;
  const copy = buildSoraCopy(localizedContent, engine.modelSlug);
  const enginePricingOverrides = await listEnginePricingOverrides();
  const pricingEngine = applyEnginePricingOverride(
    engine.engine,
    enginePricingOverrides[engine.engine.id]
  );
  const pricingItems = await buildPricingItems(pricingEngine, locale);
  const computedQuickPricingItems = await buildQuickPricingItems(pricingEngine, locale);
  const quickPricingItems = computedQuickPricingItems.length ? computedQuickPricingItems : copy.quickPricingItems;
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
  let galleryVideos = soraExamples
    .filter((video) => validatedMap.has(video.id))
    .map((video) =>
      toGalleryCard(
        video,
        engine.brandId,
        localizedContent.marketingName ?? engine.marketingName,
        engine.modelSlug,
        engine.modelSlug,
        backPath
      )
    );

  const preferredIds = PREFERRED_MEDIA[engine.modelSlug] ?? { hero: null, demo: null };
  const preferredList = [preferredIds.hero, preferredIds.demo].filter((id): id is string => Boolean(id));
  const missingPreferred = preferredList.filter((id) => !galleryVideos.some((video) => video.id === id));
  if (missingPreferred.length) {
    const preferredMap = await getVideosByIds(missingPreferred);
    for (const id of preferredList) {
      if (!preferredMap.has(id) || galleryVideos.some((video) => video.id === id)) continue;
      const video = preferredMap.get(id)!;
      galleryVideos = [
        ...galleryVideos,
        toGalleryCard(
          video,
          engine.brandId,
          localizedContent.marketingName ?? engine.marketingName,
          engine.modelSlug,
          engine.modelSlug,
          backPath
        ),
      ];
    }
  }

  const fallbackMedia: FeaturedMedia = {
    id: `${engine.modelSlug}-hero-fallback`,
    prompt:
      engine.type === 'image'
        ? `${localizedContent.marketingName ?? engine.marketingName} demo still from MaxVideoAI`
        : `${localizedContent.marketingName ?? engine.marketingName} demo clip from MaxVideoAI`,
    videoUrl: engine.type === 'image' ? null : engine.media?.videoUrl ?? engine.demoUrl ?? null,
    posterUrl: buildOptimizedPosterUrl(engine.media?.imagePath) ?? engine.media?.imagePath ?? null,
    durationSec: null,
    hasAudio: engine.type === 'image' ? false : true,
    href: null,
    label: localizedContent.marketingName ?? engine.marketingName ?? 'Sora',
  };

  const heroMedia = pickHeroMedia(galleryVideos, preferredIds.hero, fallbackMedia);
  const demoMedia = pickDemoMedia(galleryVideos, heroMedia?.id ?? null, preferredIds.demo, fallbackMedia);
  if (engine.modelSlug === 'minimax-hailuo-02-text' && demoMedia) {
    demoMedia.prompt =
      'A cinematic 10-second shot in 16:9. At night, the camera flies smoothly through a modern city full of soft neon lights and warm windows, then glides towards a single bright window high on a building. Without cutting, the camera passes through the glass into a cozy creator studio with a large desk and an ultra-wide monitor glowing in the dark. The room is lit by the screen and a warm desk lamp. The camera continues to push in until the monitor fills most of the frame. On the screen there is a clean AI video workspace UI (generic, no real logos) showing four small video previews playing at the same time: one realistic city street shot, one colourful animation, one product hero shot and one abstract motion-graphics scene. The overall style is cinematic, with smooth camera motion, gentle depth of field and rich contrast.';
  }
  const isImageEngine = engine.type === 'image';
  const galleryCtaHref = heroMedia?.id
    ? `${isImageEngine ? '/app/image' : '/app'}?engine=${engine.modelSlug}&from=${encodeURIComponent(heroMedia.id)}`
    : `${isImageEngine ? '/app/image' : '/app'}?engine=${engine.modelSlug}`;
  const relatedEngines = listFalEngines()
    .filter((entry) => entry.modelSlug !== engine.modelSlug)
    .sort((a, b) => (a.family === engine.family ? -1 : 0) - (b.family === engine.family ? -1 : 0))
    .slice(0, 3);
  const faqEntries = localizedContent.faqs.length ? localizedContent.faqs : copy.faqs;

  return (
    <Sora2PageLayout
      backLabel={detailCopy.backLabel}
      examplesLinkLabel={detailCopy.examplesLinkLabel}
      pricingLinkLabel={detailCopy.pricingLinkLabel}
      localizedContent={localizedContent}
      copy={copy}
      engine={engine}
      heroMedia={heroMedia}
      demoMedia={demoMedia}
      galleryVideos={galleryVideos}
      galleryCtaHref={galleryCtaHref}
      relatedEngines={relatedEngines}
      faqEntries={faqEntries}
      engineSlug={engine.modelSlug}
      locale={locale}
      canonicalUrl={canonicalUrl}
      localizedCanonicalUrl={localizedCanonicalUrl}
      breadcrumb={detailCopy.breadcrumb}
      pricingItems={pricingItems}
      quickPricingItems={quickPricingItems}
    />
  );
}

function Sora2PageLayout({
  engine,
  backLabel,
  examplesLinkLabel,
  pricingLinkLabel,
  localizedContent,
  copy,
  heroMedia,
  demoMedia,
  galleryVideos,
  galleryCtaHref,
  relatedEngines,
  faqEntries,
  engineSlug,
  locale,
  canonicalUrl,
  localizedCanonicalUrl,
  breadcrumb,
  pricingItems,
  quickPricingItems,
}: {
  engine: FalEngineEntry;
  backLabel: string;
  examplesLinkLabel: string;
  pricingLinkLabel: string;
  localizedContent: EngineLocalizedContent;
  copy: SoraCopy;
  heroMedia: FeaturedMedia;
  demoMedia: FeaturedMedia | null;
  galleryVideos: ExampleGalleryVideo[];
  galleryCtaHref: string;
  relatedEngines: FalEngineEntry[];
  faqEntries: LocalizedFaqEntry[];
  engineSlug: string;
  locale: AppLocale;
  canonicalUrl: string;
  localizedCanonicalUrl: string;
  breadcrumb: DetailCopy['breadcrumb'];
  pricingItems: string[];
  quickPricingItems: string[];
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
  const heroTitle = copy.heroTitle ?? localizedContent.hero?.title ?? localizedContent.marketingName ?? 'Sora 2';
  const heroSubtitle = copy.heroSubtitle ?? localizedContent.hero?.intro ?? localizedContent.overview ?? '';
  const heroBadge = copy.heroBadge ?? localizedContent.hero?.badge ?? null;
  const heroDesc1 = copy.heroDesc1 ?? localizedContent.overview ?? localizedContent.seo.description ?? null;
  const heroDesc2 = copy.heroDesc2;
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
  const primaryCtaHref = copy.primaryCtaHref ?? localizedContent.hero?.ctaPrimary?.href ?? '/app?engine=sora-2';
  const secondaryCta = copy.secondaryCta;
  const secondaryCtaHref = copy.secondaryCtaHref ?? '/models/sora-2-pro';
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
  const heroPosterPreload = heroMedia.posterUrl ? buildOptimizedPosterUrl(heroMedia.posterUrl) ?? heroMedia.posterUrl : null;

  const heroHighlights = copy.heroHighlights;
  const bestUseCases = copy.bestUseCases.length ? copy.bestUseCases : localizedContent.bestUseCases?.items ?? [];
  const whatFlowSteps = copy.whatFlowSteps;
  const quickStartTitle = copy.quickStartTitle;
  const quickStartBlocks = copy.quickStartBlocks;
  const breadcrumbModelLabel = localizedContent.marketingName ?? engine.marketingName ?? heroTitle;
  const howToLatamTitle = copy.howToLatamTitle;
  const howToLatamSteps = copy.howToLatamSteps;
  const specSections = applyPricingSection(copy.specSections, locale, pricingItems);
  const quickPricingTitle = copy.quickPricingTitle;
  const promptPatternSteps = copy.promptPatternSteps.length
    ? copy.promptPatternSteps
    : localizedContent.promptStructure?.steps ?? [];
  const imageToVideoSteps = copy.imageFlow;
  const imageToVideoUseCases = copy.imageWhy;
  const miniFilmTips = copy.multishotTips;
  const strengths = copy.strengths;
  const boundaries = copy.boundaries;
  const troubleshootingTitle = copy.troubleshootingTitle;
  const troubleshootingItems = copy.troubleshootingItems;
  const safetyRules = copy.safetyRules;
  const safetyInterpretation = copy.safetyInterpretation;
  const comparisonPoints = copy.comparisonPoints;
  const relatedCtaSora2 = copy.relatedCtaSora2;
  const relatedCtaSora2Pro = copy.relatedCtaSora2Pro;
  const faqTitle = copy.faqTitle ?? 'FAQ';
  const faqList = faqEntries.map((entry) => ({
    question: entry.question,
    answer: entry.answer,
  }));
  const faqJsonLdEntries = faqList.slice(0, 6);
  const pageDescription = heroDesc1 ?? heroSubtitle ?? localizedContent.seo.description ?? heroTitle;
  const heroPosterAbsolute = toAbsoluteUrl(heroMedia.posterUrl ?? localizedContent.seo.image ?? null);
  const heroVideoAbsolute = heroMedia.videoUrl ? toAbsoluteUrl(heroMedia.videoUrl) : null;
  const durationIso = heroMedia.durationSec ? `PT${Math.round(heroMedia.durationSec)}S` : undefined;
  const hasSpecs = specSections.length > 0;
  const hasExamples = galleryVideos.length > 0;
  const hasTextSection = promptPatternSteps.length > 0 || Boolean(copy.promptSkeleton || copy.promptSkeletonNote);
  const hasImageSection = imageToVideoSteps.length > 0 || imageToVideoUseCases.length > 0;
  const hasTipsSection = strengths.length > 0 || boundaries.length > 0 || Boolean(copy.tipsTitle);
  const hasSafetySection = safetyRules.length > 0 || safetyInterpretation.length > 0 || Boolean(copy.safetyTitle);
  const hasFaqSection = faqList.length > 0;
  const isImageEngine = engine.type === 'image';
  const textAnchorId = isImageEngine ? 'text-to-image' : 'text-to-video';
  const imageAnchorId = isImageEngine ? 'image-to-image' : 'image-to-video';
  const tocItems = [
    { id: 'specs', label: 'Specs', visible: hasSpecs },
    { id: 'examples', label: 'Examples', visible: hasExamples },
    { id: textAnchorId, label: isImageEngine ? 'Text to Image' : 'Text to Video', visible: hasTextSection },
    { id: imageAnchorId, label: isImageEngine ? 'Image to Image' : 'Image to Video', visible: hasImageSection },
    { id: 'tips', label: 'Tips', visible: hasTipsSection },
    { id: 'safety', label: 'Safety', visible: hasSafetySection },
    { id: 'faq', label: 'FAQ', visible: hasFaqSection },
  ].filter((item) => item.visible);
  const productSchema = buildProductSchema({
    engine,
    canonical,
    description: pageDescription,
    heroTitle,
    heroPosterAbsolute,
  });
  const softwareSchema = buildSoftwareSchema({ engine, canonical, description: pageDescription, heroTitle });
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
    softwareSchema,
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
            item: localizedCanonical,
          },
        ],
      },
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
      <main className="container-page max-w-6xl section">
        <div className="stack-gap-lg">
          <div className="stack-gap-sm">
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

            <section className="stack-gap rounded-3xl border border-hairline bg-surface/80 p-6 shadow-card sm:p-8">
          <div className="stack-gap-lg">
            <div className="stack-gap-sm text-center">
              <h1 className="text-3xl font-semibold text-text-primary sm:text-5xl">
                {heroTitle}
              </h1>
              <h2 className="text-lg font-semibold text-text-primary">
                {heroSubtitle}
              </h2>
              {heroBadge ? (
                <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-hairline bg-surface/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-micro text-text-secondary shadow-card">
                  {heroBadge.split('·').map((chunk, index, arr) => (
                    <span key={`${chunk}-${index}`} className="flex items-center gap-2">
                      <span>{chunk.trim()}</span>
                      {index < arr.length - 1 ? <span aria-hidden>·</span> : null}
                    </span>
                  ))}
                </div>
              ) : null}
              {heroDesc1 ? <p className="text-base leading-relaxed text-text-secondary">{heroDesc1}</p> : null}
              {heroDesc2 ? <p className="text-base leading-relaxed text-text-secondary">{heroDesc2}</p> : null}
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              <ButtonLink
                href={normalizedPrimaryCtaHref}
                size="lg"
                className="shadow-card"
                linkComponent={Link}
              >
                {primaryCta}
              </ButtonLink>
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
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <Link href={examplesLinkHref} className="font-semibold text-brand hover:text-brandHover">
                {examplesLinkLabel}
              </Link>
              <Link href={pricingLinkHref} className="font-semibold text-brand hover:text-brandHover">
                {pricingLinkLabel}
              </Link>
            </div>
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
            <div className="flex justify-center">
              <div className="w-full max-w-5xl">
                <MediaPreview media={heroMedia} label={heroTitle} />
              </div>
            </div>
            <div className="stack-gap-sm rounded-2xl border border-hairline bg-bg px-4 py-3">
              {copy.whyTitle ? <p className="text-sm font-semibold text-text-primary">{copy.whyTitle}</p> : null}
              {heroHighlights.length ? (
                <ul className="grid gap-2 text-sm text-text-secondary sm:grid-cols-2">
                  {heroHighlights.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-text-muted" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {bestUseCases.length ? (
              <div className="space-y-2 rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
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
          </div>

        {tocItems.length ? (
          <nav
            className="rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card"
            aria-label="Model page navigation"
          >
            <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Jump to section</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {tocItems.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="inline-flex items-center rounded-full border border-hairline px-3 py-1 text-sm font-semibold text-text-secondary transition hover:border-text-muted hover:text-text-primary"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </nav>
        ) : null}

        <section id="examples" className="stack-gap">
          {copy.whatTitle ? <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">{copy.whatTitle}</h2> : null}
          {copy.whatIntro1 ? <p className="text-base leading-relaxed text-text-secondary">{copy.whatIntro1}</p> : null}
          {copy.whatIntro2 ? <p className="text-base leading-relaxed text-text-secondary">{copy.whatIntro2}</p> : null}
          {quickStartTitle && quickStartBlocks.length ? (
            <div className="stack-gap rounded-2xl border border-hairline bg-surface/70 p-4 shadow-card">
              <h3 className="text-base font-semibold text-text-primary">{quickStartTitle}</h3>
              <div className="stack-gap">
                {quickStartBlocks.map((block) => (
                  <div key={block.title} className="space-y-2">
                    <p className="text-sm font-semibold text-text-primary">
                      {block.title}
                      {block.subtitle ? <span className="text-text-secondary"> — {block.subtitle}</span> : null}
                    </p>
                    <ol className="list-decimal space-y-1 pl-5 text-sm text-text-secondary">
                      {block.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {whatFlowSteps.length ? (
            <>
              {copy.whatFlowTitle ? (
                <p className="text-base font-semibold text-text-primary">{copy.whatFlowTitle}</p>
              ) : null}
              <ol className="space-y-2 rounded-2xl border border-hairline bg-surface/70 p-4 text-sm text-text-secondary">
                {whatFlowSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </>
          ) : null}
        </section>

        {specSections.length ? (
          <section id="specs" className="stack-gap">
            {copy.specTitle ? <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">{copy.specTitle}</h2> : null}
            {copy.specNote ? (
              <blockquote className="rounded-2xl border border-hairline bg-surface-2 px-4 py-3 text-sm text-text-secondary">
                {copy.specNote}
              </blockquote>
            ) : null}
            <div className="grid grid-gap-sm md:grid-cols-2">
              {specSections.map((section) => (
                <article
                  key={section.title}
                  className="space-y-2 rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card"
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
          <div className="flex justify-center">
            <Link
              href={normalizedPrimaryCtaHref}
              className="text-sm font-semibold text-brand transition hover:text-brandHover"
            >
              {copy.microCta}
            </Link>
          </div>
        ) : null}

        {quickPricingTitle && quickPricingItems.length ? (
          <section className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-5 shadow-card">
            <h3 className="text-lg font-semibold text-text-primary">{quickPricingTitle}</h3>
            <ul className="space-y-1 text-sm text-text-secondary">
              {quickPricingItems.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section id={textAnchorId} className="stack-gap">
          {copy.galleryTitle ? <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">{copy.galleryTitle}</h2> : null}
          {galleryVideos.length ? (
            <>
              {copy.galleryIntro ? <p className="text-base leading-relaxed text-text-secondary">{copy.galleryIntro}</p> : null}
              {copy.galleryAllCta ? (
                <p className="text-base leading-relaxed text-text-secondary">
                  <Link href={examplesLinkHref} className="font-semibold text-brand hover:text-brandHover">
                    {copy.galleryAllCta}
                  </Link>
                </p>
              ) : null}
              <div className="stack-gap">
                <div className="overflow-x-auto pb-2">
                  <div className="flex min-w-full gap-4">
                    {galleryVideos.slice(0, 6).map((video) => (
                      <article
                        key={video.id}
                        className="flex w-64 shrink-0 flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-card"
                      >
                        <Link href={video.href} className="group relative block aspect-video bg-placeholder">
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
                            <div className="flex h-full w-full items-center justify-center bg-skeleton text-xs font-semibold text-text-muted">
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
          <div className="mt-4">
            <ButtonLink
              href={galleryCtaHref}
              size="lg"
              className="shadow-card"
              linkComponent={Link}
            >
              {copy.gallerySceneCta ?? (isImageEngine ? 'Open this still in the Image lab →' : 'Open this scene in Generate →')}
            </ButtonLink>
          </div>
        </section>

        <section id={imageAnchorId} className="stack-gap">
          {copy.promptTitle ? <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">{copy.promptTitle}</h2> : null}
          {copy.promptIntro ? <p className="text-base leading-relaxed text-text-secondary">{copy.promptIntro}</p> : null}
          <div className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
            {promptPatternSteps.length ? (
              <div className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  {promptPatternSteps.map((step, index) => (
                    <div key={step} className="flex items-start gap-4 rounded-xl bg-bg px-3 py-2 text-sm text-text-secondary">
                      <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-surface-2 text-[11px] font-semibold text-text-primary">
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

        <section className="stack-gap">
          {copy.imageTitle ? <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">{copy.imageTitle}</h2> : null}
          {copy.imageIntro ? <p className="text-base leading-relaxed text-text-secondary">{copy.imageIntro}</p> : null}
          <div className="grid grid-gap-sm lg:grid-cols-2">
            {imageToVideoSteps.length ? (
              <div className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
                <ol className="list-decimal space-y-2 pl-5 text-sm text-text-secondary">
                  {imageToVideoSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            ) : null}
            {imageToVideoUseCases.length ? (
              <div className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
                <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                  {imageToVideoUseCases.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        <section className="stack-gap">
          {copy.multishotTitle ? <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">{copy.multishotTitle}</h2> : null}
          {copy.multishotIntro1 ? <p className="text-base leading-relaxed text-text-secondary">{copy.multishotIntro1}</p> : null}
          {copy.multishotIntro2 ? <p className="text-base leading-relaxed text-text-secondary">{copy.multishotIntro2}</p> : null}
          <div className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
            <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
              {miniFilmTips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
        </section>

      {copy.demoTitle || copy.demoPrompt.length || copy.demoNotes.length ? (
        <section className="stack-gap-lg">
          {copy.demoTitle ? <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">{copy.demoTitle}</h2> : null}
          <div className="grid grid-gap lg:grid-cols-2 lg:items-start">
            <div className="rounded-2xl border border-hairline bg-surface/80 p-3 shadow-card lg:order-2">
              {demoMedia ? (
                <MediaPreview media={demoMedia} label={copy.demoTitle ?? 'Sora 2 demo'} />
              ) : (
                <div className="flex h-full min-h-[280px] items-center justify-center rounded-xl border border-dashed border-hairline bg-bg text-sm text-text-secondary">
                  {copy.galleryIntro ?? 'Demo clip coming soon.'}
                </div>
              )}
            </div>
            <div className="stack-gap rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card lg:order-1">
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
          </div>
        </section>
      ) : null}

        {copy.tipsTitle || strengths.length || boundaries.length ? (
          <section id="tips" className="stack-gap-lg">
            {copy.tipsTitle ? <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">{copy.tipsTitle}</h2> : null}
            <div className="grid grid-gap-sm lg:grid-cols-2">
              {strengths.length ? (
                <div className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
                  <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                    {strengths.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {boundaries.length ? (
                <div className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
                  <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                    {boundaries.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            {troubleshootingTitle && troubleshootingItems.length ? (
              <div className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
                <p className="text-sm font-semibold text-text-primary">{troubleshootingTitle}</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                  {troubleshootingItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {copy.tipsFooter ? <p className="text-sm text-text-secondary">{copy.tipsFooter}</p> : null}
          </section>
        ) : null}

        {copy.safetyTitle || safetyRules.length ? (
          <section id="safety" className="stack-gap">
            {copy.safetyTitle ? <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">{copy.safetyTitle}</h2> : null}
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

        {copy.comparisonTitle || comparisonPoints.length ? (
          <section className="stack-gap">
            {copy.comparisonTitle ? (
              <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">{copy.comparisonTitle}</h2>
            ) : null}
            <div className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
              {comparisonPoints.length ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                  {comparisonPoints.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
              {copy.comparisonCta ? (
                <ButtonLink
                  href={localizedSecondaryCtaHref ?? secondaryCtaHref}
                  className="shadow-card"
                  linkComponent={Link}
                >
                  {copy.comparisonCta}
                </ButtonLink>
              ) : null}
            </div>
          </section>
        ) : null}

        {faqList.length ? (
          <section id="faq" className="stack-gap">
            {faqTitle ? <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">{faqTitle}</h2> : null}
            <div className="grid grid-gap-sm md:grid-cols-2">
              {faqList.map((entry) => (
                <article
                  key={entry.question}
                  className="rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card"
                >
                  <h3 className="text-sm font-semibold text-text-primary">{entry.question}</h3>
                  <p className="mt-2 text-sm text-text-secondary">{entry.answer}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}
        <FAQSchema questions={faqJsonLdEntries} />

        {relatedEngines.length ? (
          <section className="stack-gap">
            <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">
              {copy.relatedTitle ?? 'Explore other models'}
            </h2>
            {copy.relatedSubtitle ? <p className="text-sm text-text-secondary">{copy.relatedSubtitle}</p> : null}
            <div className="grid grid-gap-sm md:grid-cols-3">
              {relatedEngines.map((entry) => {
                const label = entry.marketingName ?? entry.engine.label;
                const currentLabel = breadcrumbModelLabel || heroTitle || engine.marketingName || engine.engine.label;
                const compareTemplate =
                  locale === 'fr'
                    ? 'Comparer {a} vs {b} →'
                    : locale === 'es'
                      ? 'Comparar {a} vs {b} →'
                      : 'Compare {a} vs {b} →';
                const exploreTemplate =
                  locale === 'fr'
                    ? 'Découvrir {a} →'
                    : locale === 'es'
                      ? 'Explorar {a} →'
                      : 'Explore {a} →';
                const fallbackCompare = compareTemplate
                  .replace('{a}', currentLabel)
                  .replace('{b}', label);
                const fallbackExplore = exploreTemplate.replace('{a}', label);
                const ctaLabel =
                  engineSlug === 'veo-3-1-first-last'
                    ? entry.modelSlug === 'veo-3-1'
                      ? 'Explore Veo 3.1 →'
                      : entry.modelSlug === 'veo-3-1-fast'
                        ? 'Explore Veo 3.1 Fast →'
                        : entry.modelSlug === 'sora-2'
                          ? 'Explore Sora 2 →'
                          : fallbackCompare
                    : engineSlug === 'wan-2-6'
                      ? entry.modelSlug === 'sora-2'
                        ? relatedCtaSora2 ?? secondaryCta ?? fallbackCompare
                        : entry.modelSlug === 'sora-2-pro'
                          ? relatedCtaSora2Pro ?? fallbackCompare
                          : fallbackCompare
                      : fallbackCompare;
                const canCompare =
                  !COMPARE_EXCLUDED_SLUGS.has(engineSlug) && !COMPARE_EXCLUDED_SLUGS.has(entry.modelSlug);
                const compareSlug = [engineSlug, entry.modelSlug].sort().join('-vs-');
                const compareHref = canCompare
                  ? localizeComparePath(compareSlug, engineSlug)
                  : localizeModelsPath(entry.modelSlug);
                const linkLabel = canCompare ? ctaLabel : fallbackExplore;
                return (
                  <article
                    key={entry.modelSlug}
                    className="rounded-2xl border border-hairline bg-surface/90 p-4 shadow-card transition hover:-translate-y-1 hover:border-text-muted"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">{entry.brandId}</p>
                    <h3 className="mt-2 text-lg font-semibold text-text-primary">
                      {label}
                    </h3>
                    <p className="mt-2 text-sm text-text-secondary line-clamp-3">
                      {entry.seo?.description ?? localizedContent.overview ?? ''}
                    </p>
                    <TextLink href={compareHref} className="mt-4 gap-1 text-sm" linkComponent={Link}>
                      {linkLabel}
                    </TextLink>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="stack-gap-sm rounded-3xl border border-hairline bg-surface/90 px-6 py-6 text-text-primary shadow-card sm:px-8">
          {copy.finalPara1 ? <p className="text-base leading-relaxed text-text-secondary">{copy.finalPara1}</p> : null}
          {copy.finalPara2 ? <p className="text-base leading-relaxed text-text-secondary">{copy.finalPara2}</p> : null}
          <ButtonLink
            href={normalizedPrimaryCtaHref}
            size="lg"
            className="w-fit shadow-card"
            linkComponent={Link}
          >
            {copy.finalButton ?? primaryCta}
          </ButtonLink>
        </section>
        </div>
      </main>
    </>
  );
}

function MediaPreview({ media, label }: { media: FeaturedMedia; label: string }) {
  const posterSrc = media.posterUrl ?? null;
  const aspect = media.aspectRatio ?? '16:9';
  const [w, h] = aspect.split(':').map(Number);
  const isValidAspect = Number.isFinite(w) && Number.isFinite(h) && h > 0 && w > 0;
  const paddingBottom = isValidAspect ? `${(h / w) * 100}%` : '56.25%';
  const isVertical = isValidAspect ? w < h : false;
  const figureClassName = [
    'group relative overflow-hidden rounded-[22px] border border-hairline bg-surface shadow-card',
    isVertical ? 'mx-auto max-w-sm' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <figure className={figureClassName}>
      <div className="relative w-full overflow-hidden rounded-t-[22px] bg-placeholder">
        <div className="relative w-full" style={{ paddingBottom }}>
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
              <div className="flex h-full w-full items-center justify-center bg-surface-2 text-sm font-semibold text-text-muted">
                Sora 2 preview
              </div>
            )}
            {media.hasAudio ? (
              <span className="absolute left-3 top-3 rounded-full bg-surface-on-media-dark-70 px-3 py-1 text-[11px] font-semibold uppercase tracking-micro text-on-inverse">
                Audio on
              </span>
            ) : null}
            {media.durationSec ? (
              <span className="absolute right-3 top-3 rounded-full bg-surface/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-micro text-text-primary shadow-card">
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
          <TextLink href={media.href} className="gap-1 text-xs" linkComponent={Link}>
            View render →
          </TextLink>
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

  if (
    slug === 'sora-2' ||
    slug === 'sora-2-pro' ||
    slug === 'veo-3-1' ||
    slug === 'veo-3-1-fast' ||
    slug === 'veo-3-1-first-last' ||
    slug === 'pika-text-to-video' ||
    slug === 'wan-2-5' ||
    slug === 'wan-2-6' ||
    slug === 'kling-2-5-turbo' ||
    slug === 'minimax-hailuo-02-text' ||
    slug === 'ltx-2' ||
    slug === 'ltx-2-fast' ||
    slug === 'kling-2-6-pro' ||
    slug === 'nano-banana' ||
    slug === 'nano-banana-pro'
  ) {
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
      detailCopy,
      localizedContent,
      locale: activeLocale,
    });
  }

  const { dictionary } = await resolveDictionary();
  const activeLocale = routeLocale ?? 'en';
  if (process.env.NODE_ENV === 'development') {
    console.info('[models/page] locale debug', { slug, routeLocale, activeLocale });
  }
  const modelsBase = (MODELS_BASE_PATH_MAP[activeLocale as AppLocale] ?? 'models').replace(/^\/+|\/+$/g, '');
  const localizeModelsPath = (targetSlug?: string) => {
    const slugPart = targetSlug ? `/${targetSlug.replace(/^\/+/, '')}` : '';
    return `/${modelsBase}${slugPart}`.replace(/\/{2,}/g, '/');
  };
  const compareBase = (COMPARE_BASE_PATH_MAP[activeLocale as AppLocale] ?? 'ai-video-engines').replace(
    /^\/+|\/+$/g,
    ''
  );
  const localizeComparePath = (pairSlug: string, orderSlug?: string) => {
    return buildCanonicalComparePath({ compareBase, pairSlug, orderSlug });
  };
  const normalizeHeroCtaHref = (href?: string | null): LocalizedLinkHref | null => {
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
  const localizedContent = await getEngineLocalized(slug, activeLocale);
  const detailSlugMap = buildDetailSlugMap(slug);
  const publishableLocales = Array.from(resolveLocalesForEnglishPath(`/models/${slug}`));
  const metadataUrls = buildMetadataUrls(activeLocale, detailSlugMap, {
    englishPath: `/models/${slug}`,
    availableLocales: publishableLocales,
  });
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

  if (engine.modelSlug === 'nano-banana' || engine.modelSlug === 'nano-banana-pro') {
    detailCopy.overviewTitle = 'Overview';
  }
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
  const compareLinkHref =
    compareLink?.href ? normalizeHeroCtaHref(compareLink.href) ?? compareLink.href : null;
  const heroPrimaryCta = heroContent?.ctaPrimary;
  const heroPrimaryHref = heroPrimaryCta?.href ? normalizeHeroCtaHref(heroPrimaryCta.href) ?? heroPrimaryCta.href : null;
  const secondaryCtas = heroContent?.secondaryLinks ?? [];
  const normalizedSecondaryCtas = secondaryCtas.map((cta) => ({
    ...cta,
    href: cta?.href ? normalizeHeroCtaHref(cta.href) ?? cta.href : cta?.href,
  }));
  const brand = PARTNER_BRAND_MAP.get(engine.brandId);
  const promptEntries =
    localizedContent.prompts.length > 0
      ? localizedContent.prompts
      : engine.prompts.map(({ title, prompt, notes }) => ({ title, prompt, notes }));
  const faqEntries =
    localizedContent.faqs.length > 0
      ? localizedContent.faqs
      : (engine.faqs ?? []).map(({ question, answer }) => ({ question, answer }));
  const pricingNotes = localizedContent.pricingNotes ?? null;
  const localizedCanonicalRaw = metadataUrls.canonical;
  const localizedCanonicalUrl = localizedCanonicalRaw.replace(/\/+$/, '') || localizedCanonicalRaw;
  const canonicalUrl = localizedCanonicalUrl;
  const breadcrumbTitleBase = localizedContent.seo.title ?? marketingName ?? slug;
  const breadcrumbTitle = breadcrumbTitleBase.replace(/ —.*$/, '');
  const inLanguage = localeRegions[activeLocale] ?? 'en-US';
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
        item: localizedCanonicalUrl,
      },
    ],
  };
  const platformPriceInfo = detailCopy.overview.platformPrice
    ? {
        label: detailCopy.overview.platformPrice,
        href: '/generate',
      }
    : null;
  const examplesLinkHref = getExamplesHref(engine.modelSlug ?? slug) ?? { pathname: '/examples' };
  const pricingLinkHref = { pathname: '/pricing' };

  const heroPosterSrc = localizedContent.seo.image ?? engine.media?.imagePath ?? null;
  const heroPosterPreload = heroPosterSrc ? buildOptimizedPosterUrl(heroPosterSrc) ?? heroPosterSrc : null;
  const heroPosterAbsolute = toAbsoluteUrl(heroPosterSrc);
  const heroTitle = heroContent?.title ?? marketingName ?? slug;
  const pageDescription = introText ?? seoDescription ?? heroTitle;
  const productSchema = buildProductSchema({
    engine,
    canonical: canonicalUrl,
    description: pageDescription ?? breadcrumbTitle,
    heroTitle,
    heroPosterAbsolute,
  });
  const softwareSchema = buildSoftwareSchema({
    engine,
    canonical: canonicalUrl,
    description: pageDescription ?? breadcrumbTitle,
    heroTitle,
  });
  const schemaPayloads = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: heroTitle,
      description: pageDescription ?? breadcrumbTitle,
      url: canonicalUrl,
      inLanguage,
    },
    productSchema,
    softwareSchema,
    breadcrumbLd,
  ].filter(Boolean) as object[];
  const hasSpecs = true;
  const hasTextSection = Boolean(promptStructure) || promptEntries.length > 0;
  const hasTipsSection = Boolean(tips?.items && tips.items.length);
  const hasFaqSection = faqEntries.length > 0;
  const faqJsonLdEntries = faqEntries.slice(0, 6);
  const tocItems = [
    { id: 'specs', label: 'Specs', visible: hasSpecs },
    { id: 'text-to-video', label: 'Text to Video', visible: hasTextSection },
    { id: 'tips', label: 'Tips', visible: hasTipsSection },
    { id: 'faq', label: 'FAQ', visible: hasFaqSection },
  ].filter((item) => item.visible);
  const textAnchorId = 'text-to-video';
  const attachTextIdToPromptStructure = Boolean(promptStructure);
  const launchHref = engine.type === 'image' ? '/app/image' : '/app';

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
      <div className="container-page max-w-4xl section">
        <div className="stack-gap-lg">
          <div className="stack-gap-sm">
            <Link href={localizeModelsPath()} className="text-sm font-semibold text-brand hover:text-brandHover">
              {detailCopy.backLabel}
            </Link>
            <header className="stack-gap-sm">
              <div className="flex flex-wrap items-center gap-4">
                {brand && engine.logoPolicy === 'logoAllowed' ? (
                  <span className="flex items-center">
                    <Image src={brand.assets.light.svg} alt={`${marketingName} logo`} width={140} height={32} className="h-9 w-auto dark:hidden" />
                    <Image src={brand.assets.dark.svg} alt={`${marketingName} logo`} width={140} height={32} className="hidden h-9 w-auto dark:inline-flex" />
                  </span>
                ) : null}
                <div>
                  <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">
                    {heroContent?.title ?? marketingName}
                  </h2>
                  {versionLabel ? (
                    <p className="text-sm uppercase tracking-micro text-text-muted">{versionLabel}</p>
                  ) : null}
                </div>
              </div>
              {introText ? <p className="text-sm text-text-secondary">{introText}</p> : null}
            </header>
          </div>

          <div className="stack-gap-sm">
            {(heroPrimaryCta?.label || secondaryCtas.length) ? (
              <div className="flex flex-wrap gap-4">
                {heroPrimaryCta?.label && heroPrimaryHref ? (
                  <ButtonLink
                    href={heroPrimaryHref}
                    size="lg"
                    className="shadow-card"
                    linkComponent={Link}
                  >
                    {heroPrimaryCta.label}
                  </ButtonLink>
                ) : null}
                {normalizedSecondaryCtas
                  .filter(
                    (cta): cta is { label: string; href: LocalizedLinkHref } =>
                      Boolean(cta.label && cta.href)
                  )
                  .map((cta) => {
                    const hrefKey = typeof cta.href === 'string' ? cta.href : cta.href.pathname ?? '';
                    return (
                      <ButtonLink
                        key={`${hrefKey}-${cta.label}`}
                        href={cta.href}
                        variant="outline"
                        size="lg"
                        linkComponent={Link}
                      >
                        {cta.label}
                      </ButtonLink>
                    );
                  })}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-4 text-sm">
              <Link href={examplesLinkHref} className="font-semibold text-brand hover:text-brandHover">
                {detailCopy.examplesLinkLabel}
              </Link>
              <Link href={pricingLinkHref} className="font-semibold text-brand hover:text-brandHover">
                {detailCopy.pricingLinkLabel}
              </Link>
            </div>
          </div>

      {tocItems.length ? (
        <nav
          className="rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card"
          aria-label="Model page navigation"
        >
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Jump to section</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {tocItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="inline-flex items-center rounded-full border border-hairline px-3 py-1 text-sm font-semibold text-text-secondary transition hover:border-text-muted hover:text-text-primary"
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>
      ) : null}

      {bestUseCases?.items && bestUseCases.items.length ? (
        <section className="rounded-card border border-hairline bg-surface p-6 shadow-card">
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
        <section className="rounded-card border border-hairline bg-surface p-6 shadow-card">
          <h2 className="text-lg font-semibold text-text-primary">{technicalOverviewTitle}</h2>
          <div className="mt-4 grid grid-gap-sm text-sm text-text-secondary sm:grid-cols-2">
            {technicalOverview.map((entry, index) => (
              <article key={`${entry.label ?? index}-${entry.body}`} className="space-y-1">
                {entry.label ? <strong className="block text-text-primary">{entry.label}</strong> : null}
                {entry.body ? <p>{entry.body}</p> : null}
                {entry.link?.href && entry.link?.label ? (
                  <a
                    href={entry.link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-brand hover:text-brandHover"
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
        <section
          id={attachTextIdToPromptStructure ? textAnchorId : undefined}
          className="rounded-card border border-hairline bg-surface p-6 shadow-card"
        >
          <h2 className="text-lg font-semibold text-text-primary">{promptStructure.title ?? 'Prompt structure'}</h2>
          {promptStructure.quote ? (
            <blockquote className="mt-3 border-l-2 border-hairline pl-3 text-sm text-text-secondary italic">
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
        <section id="tips" className="rounded-card border border-hairline bg-surface p-6 shadow-card">
          <h2 className="text-lg font-semibold text-text-primary">{tips.title ?? 'Tips & tricks'}</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-text-secondary">
            {tips.items.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {compareLink?.href && compareLink.label ? (
        <p className="text-sm text-text-secondary">
          {compareLink.before ?? ''}
          <Link href={compareLinkHref ?? compareLink.href} className="font-semibold text-brand hover:text-brandHover">
            {compareLink.label}
          </Link>
          {compareLink.after ?? ''}
        </p>
      ) : null}

      <section id="specs" className="stack-gap">
        <div className="rounded-card border border-hairline bg-surface p-6 shadow-card">
          <h2 className="text-lg font-semibold text-text-primary">{detailCopy.overviewTitle}</h2>
          <dl className="mt-4 grid grid-gap-sm text-sm text-text-secondary sm:grid-cols-2">
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
              <dd>{localizeModelsPath(engine.modelSlug)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-micro text-text-muted">{detailCopy.overview.logoPolicy}</dt>
              <dd>{detailCopy.logoPolicies[engine.logoPolicy as keyof DetailCopy['logoPolicies']] ?? detailCopy.logoPolicies.textOnly}</dd>
            </div>
            {platformPriceInfo ? (
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-micro text-text-muted">{detailCopy.overview.platformPrice}</dt>
                <dd>
                  <Link
                    href={platformPriceInfo.href}
                    prefetch={false}
                    className="text-sm font-semibold text-brand hover:text-brandHover"
                  >
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
        <section
          id={!attachTextIdToPromptStructure ? textAnchorId : undefined}
          className="stack-gap"
        >
          <h2 className="text-lg font-semibold text-text-primary">{detailCopy.promptsTitle}</h2>
          <div className="grid grid-gap-sm sm:grid-cols-2">
            {promptEntries.map((entry) => (
              <article key={entry.title} className="rounded-card border border-hairline bg-surface p-4 text-sm text-text-secondary shadow-card">
                <h3 className="text-sm font-semibold text-text-primary">{entry.title}</h3>
                <p className="mt-1 text-sm text-text-secondary">{entry.prompt}</p>
                {entry.notes ? <p className="mt-2 text-xs text-text-muted">{entry.notes}</p> : null}
              </article>
            ))}
          </div>
        </section>
      )}

      {faqEntries.length > 0 && (
        <section id="faq" className="stack-gap">
          <h2 className="text-lg font-semibold text-text-primary">{detailCopy.faqTitle}</h2>
          <div className="stack-gap-sm text-sm text-text-secondary">
            {faqEntries.map(({ question, answer }) => (
              <article key={question} className="rounded-card border border-hairline bg-surface p-4 shadow-card">
                <h3 className="text-sm font-semibold text-text-primary">{question}</h3>
                <p className="mt-1 text-sm text-text-secondary">{answer}</p>
              </article>
            ))}
          </div>
        </section>
      )}
      <FAQSchema questions={faqJsonLdEntries} />

      {relatedEngines.length ? (
        <section className="stack-gap">
          <div className="stack-gap-sm">
            <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">{relatedCopy.title}</h2>
            <p className="text-sm text-text-secondary">{relatedCopy.subtitle}</p>
          </div>
          <div className="grid grid-gap-sm md:grid-cols-3">
            {relatedEngines.map((candidate) => {
              const label = candidate.marketingName ?? candidate.engine.label;
              const ctaLabel = (() => {
                if (slug === 'ltx-2') {
                  if (candidate.modelSlug === 'ltx-2-fast') return 'Compare LTX-2 Pro vs Fast';
                  if (candidate.modelSlug === 'sora-2') return 'Explore Sora 2';
                  if (candidate.modelSlug === 'sora-2-pro') return 'Explore Sora 2 Pro';
                }
                return `Try ${label}`;
              })();
              const compareDisabled =
                COMPARE_EXCLUDED_SLUGS.has(slug) || COMPARE_EXCLUDED_SLUGS.has(candidate.modelSlug);
              const compareSlug = [slug, candidate.modelSlug].sort().join('-vs-');
              const compareHref = compareDisabled
                ? localizeModelsPath(candidate.modelSlug)
                : localizeComparePath(compareSlug, slug);
              const linkLabel = compareDisabled ? relatedCopy.cta : ctaLabel;
              return (
                <article key={candidate.modelSlug} className="rounded-2xl border border-hairline bg-surface/90 p-5 shadow-card">
                  <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{candidate.brandId}</p>
                  <h3 className="mt-2 text-lg font-semibold text-text-primary">{label}</h3>
                  <p className="mt-2 text-sm text-text-secondary">
                    {candidate.seo?.description ?? 'Latency, pricing, and prompt guides are documented on the detail page.'}
                  </p>
                  <TextLink
                    href={compareHref}
                    className="mt-4 gap-1 text-sm"
                    linkComponent={Link}
                  >
                    {linkLabel} <span aria-hidden>→</span>
                  </TextLink>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-4">
        <ButtonLink
          href="/app"
          prefetch={false}
          variant="outline"
          linkComponent={Link}
        >
          {detailCopy.buttons.pricing}
        </ButtonLink>
        <ButtonLink
          href={launchHref}
          className="shadow-card"
          linkComponent={Link}
        >
          {detailCopy.buttons.launch}
        </ButtonLink>
      </div>

        </div>
    </div>
  </>
);
}
