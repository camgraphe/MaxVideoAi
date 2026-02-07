import path from 'node:path';
import { promises as fs } from 'node:fs';
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
import { Chip } from '@/components/ui/Chip';
import { TextLink } from '@/components/ui/TextLink';
import { UIIcon } from '@/components/ui/UIIcon';
import { BackLink } from '@/components/video/BackLink';
import { SoraPromptingTabs } from '@/components/marketing/SoraPromptingTabs.client';
import { ResponsiveDetails } from '@/components/ui/ResponsiveDetails.client';
import { getExamplesHref } from '@/lib/examples-links';
import {
  Box,
  Check,
  Clock,
  Crop,
  Image as ImageIcon,
  LayoutGrid,
  Megaphone,
  Monitor,
  ChevronDown,
  Type,
  Users,
  Volume2,
} from 'lucide-react';

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
type HeroSpecIconKey = 'resolution' | 'duration' | 'textToVideo' | 'imageToVideo' | 'aspectRatio' | 'audio';
type HeroSpecChip = { label: string; icon?: HeroSpecIconKey | null };
type BestUseCaseIconKey = 'ads' | 'ugc' | 'product' | 'storyboard';
type BestUseCaseChip = { label: string; icon?: BestUseCaseIconKey | null };
type RelatedItem = {
  brand: string;
  title: string;
  description: string;
  modelSlug?: string | null;
  ctaLabel?: string | null;
  href?: string | null;
};
type EngineKeySpecsEntry = {
  modelSlug?: string;
  engineId?: string;
  keySpecs?: Record<string, unknown>;
  sources?: string[];
};
type EngineKeySpecsFile = {
  version?: string;
  last_updated?: string;
  specs?: EngineKeySpecsEntry[];
};
type KeySpecKey =
  | 'pricePerSecond'
  | 'textToVideo'
  | 'imageToVideo'
  | 'videoToVideo'
  | 'firstLastFrame'
  | 'referenceImageStyle'
  | 'referenceVideo'
  | 'maxResolution'
  | 'maxDuration'
  | 'aspectRatios'
  | 'fpsOptions'
  | 'outputFormats'
  | 'audioOutput'
  | 'nativeAudioGeneration'
  | 'lipSync'
  | 'cameraMotionControls'
  | 'watermark';
type KeySpecRow = { label: string; value: string };
type KeySpecValues = Record<KeySpecKey, string>;

type SoraCopy = {
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroBadge: string | null;
  heroSpecChips: HeroSpecChip[];
  heroTrustLine: string | null;
  heroDesc1: string | null;
  heroDesc2: string | null;
  primaryCta: string | null;
  primaryCtaHref: string | null;
  secondaryCta: string | null;
  secondaryCtaHref: string | null;
  whyTitle: string | null;
  heroHighlights: string[];
  bestUseCasesTitle: string | null;
  bestUseCaseChips: BestUseCaseChip[];
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
  hideQuickPricing: boolean;
  showPricePerSecondInSpecs: boolean;
  hidePricingSection: boolean;
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
  relatedItems: RelatedItem[];
  finalPara1: string | null;
  finalPara2: string | null;
  finalButton: string | null;
  faqTitle: string | null;
  faqs: LocalizedFaqEntry[];
  promptingGlobalPrinciples: string[];
  promptingEngineWhy: string[];
  promptingTabNotes: {
    quick?: string;
    structured?: string;
    pro?: string;
    storyboard?: string;
  };
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
const HERO_SPEC_ICON_MAP = {
  resolution: Monitor,
  duration: Clock,
  textToVideo: Type,
  imageToVideo: ImageIcon,
  aspectRatio: Crop,
  audio: Volume2,
} as const;
const BEST_USE_CASE_ICON_MAP = {
  ads: Megaphone,
  ugc: Users,
  product: Box,
  storyboard: LayoutGrid,
} as const;
const FULL_BLEED_SECTION =
  "relative isolate before:absolute before:inset-y-0 before:left-1/2 before:right-1/2 before:-ml-[50vw] before:-mr-[50vw] before:content-[''] before:-z-10";
const SECTION_BG_A =
  'before:bg-gradient-to-b before:from-[#F9FAFD] before:to-[#F3F4FA] before:border-t before:border-hairline/80 shadow-[inset_0_12px_18px_-14px_rgba(15,23,42,0.35)]';
const SECTION_BG_B =
  'before:bg-gradient-to-b before:from-[#F7F8FC] before:to-[#F1F3F9] before:border-t before:border-hairline/80 shadow-[inset_0_12px_18px_-14px_rgba(15,23,42,0.35)]';
const SECTION_PAD = 'px-6 py-9 sm:px-8 sm:py-12';
const SECTION_SCROLL_MARGIN = 'scroll-mt-[calc(var(--header-height)+64px)]';
const FULL_BLEED_CONTENT = 'relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-[100vw]';
const KEY_SPEC_ROW_DEFS: Array<{ key: KeySpecKey; label: string }> = [
  { key: 'pricePerSecond', label: 'Price / second' },
  { key: 'textToVideo', label: 'Text-to-Video' },
  { key: 'imageToVideo', label: 'Image-to-Video' },
  { key: 'videoToVideo', label: 'Video-to-Video' },
  { key: 'firstLastFrame', label: 'First/Last frame' },
  { key: 'referenceImageStyle', label: 'Reference image / style reference' },
  { key: 'referenceVideo', label: 'Reference video' },
  { key: 'maxResolution', label: 'Max resolution' },
  { key: 'maxDuration', label: 'Max duration' },
  { key: 'aspectRatios', label: 'Aspect ratios' },
  { key: 'fpsOptions', label: 'FPS options' },
  { key: 'outputFormats', label: 'Output format' },
  { key: 'audioOutput', label: 'Audio output' },
  { key: 'nativeAudioGeneration', label: 'Native audio generation' },
  { key: 'lipSync', label: 'Lip sync' },
  { key: 'cameraMotionControls', label: 'Camera / motion controls' },
  { key: 'watermark', label: 'Watermark' },
];

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

async function buildPricePerSecondLabel(engine: EngineCaps, locale: AppLocale): Promise<string | null> {
  const resolution = resolveDefaultResolution(engine);
  if (!resolution) return null;
  const durationOptions = selectQuickDurations(engine);
  const durationSec = durationOptions[0] ?? 5;
  try {
    const snapshot = await computePricingSnapshot({
      engine,
      durationSec,
      resolution,
      membershipTier: 'member',
    });
    const seconds = typeof snapshot.base.seconds === 'number' ? snapshot.base.seconds : durationSec;
    if (!seconds) return null;
    const perSecond = snapshot.totalCents / seconds / 100;
    return `${formatPerSecond(locale, snapshot.currency ?? 'USD', perSecond)}/s`;
  } catch {
    return null;
  }
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

async function loadEngineKeySpecs(): Promise<Map<string, EngineKeySpecsEntry>> {
  const candidates = [
    path.join(process.cwd(), 'data', 'benchmarks', 'engine-key-specs.v1.json'),
    path.join(process.cwd(), '..', 'data', 'benchmarks', 'engine-key-specs.v1.json'),
  ];
  for (const candidate of candidates) {
    try {
      const raw = await fs.readFile(candidate, 'utf8');
      const data = JSON.parse(raw) as EngineKeySpecsFile;
      const map = new Map<string, EngineKeySpecsEntry>();
      (data.specs ?? []).forEach((entry) => {
        const key = entry.modelSlug ?? entry.engineId;
        if (key) {
          map.set(key, entry);
        }
      });
      return map;
    } catch {
      // keep trying
    }
  }
  return new Map();
}

function resolveKeySpecValue(
  specs: Record<string, unknown> | undefined,
  key: string,
  fallback: string
): string {
  if (!specs || !(key in specs)) return fallback;
  const value = (specs as Record<string, unknown>)[key];
  if (Array.isArray(value)) {
    return value.length ? value.join(' / ') : fallback;
  }
  if (value == null) return fallback;
  const normalized = String(value).trim();
  if (/^(yes|true)$/i.test(normalized)) return 'Supported';
  if (/^(no|false)$/i.test(normalized)) return 'Not supported';
  return normalized;
}

function resolveStatus(value?: boolean | null) {
  if (value === true) return 'Supported';
  if (value === false) return 'Not supported';
  return 'Data pending';
}

function resolveModeSupported(engineCaps: EngineCaps | undefined, mode: string) {
  const modes = engineCaps?.modes ?? [];
  if (!modes.length) return 'Data pending';
  return modes.includes(mode) ? 'Supported' : 'Not supported';
}

function formatMaxResolution(engineCaps: EngineCaps | undefined) {
  const resolutions = engineCaps?.resolutions ?? [];
  const numeric = resolutions
    .map((value) => {
      const match = String(value).match(/(\d+)/);
      return match ? Number(match[1]) : null;
    })
    .filter((value): value is number => value != null);
  if (!numeric.length) return resolutions.join(', ') || 'Data pending';
  const max = Math.max(...numeric);
  return `${max}p`;
}

function formatDuration(engineCaps: EngineCaps | undefined) {
  const max = engineCaps?.maxDurationSec;
  return typeof max === 'number' ? `${max}s max` : 'Data pending';
}

function formatAspectRatios(engineCaps: EngineCaps | undefined) {
  const ratios = engineCaps?.aspectRatios ?? [];
  return ratios.length ? ratios.join(' / ') : 'Data pending';
}

function formatFps(engineCaps: EngineCaps | undefined) {
  const fps = engineCaps?.fps ?? [];
  return fps.length ? fps.join(' / ') : 'Data pending';
}

function getPricePerSecondCents(engineCaps: EngineCaps | undefined): number | null {
  const perSecond = engineCaps?.pricingDetails?.perSecondCents;
  const byResolution = perSecond?.byResolution ? Object.values(perSecond.byResolution) : [];
  const cents = perSecond?.default ?? (byResolution.length ? Math.min(...byResolution) : null);
  if (typeof cents === 'number') {
    return cents;
  }
  const base = engineCaps?.pricing?.base;
  if (typeof base === 'number') {
    return Math.round(base * 100);
  }
  return null;
}

function formatPricePerSecond(engineCaps: EngineCaps | undefined): string {
  const cents = getPricePerSecondCents(engineCaps);
  if (typeof cents === 'number') {
    return `$${(cents / 100).toFixed(2)}/s`;
  }
  return 'Data pending';
}

function buildSpecValues(
  entry: FalEngineEntry,
  specs: Record<string, unknown> | undefined,
  pricePerSecondOverride?: string | null
): KeySpecValues {
  const engineCaps = entry.engine;
  return {
    pricePerSecond: resolveKeySpecValue(
      specs,
      'pricePerSecond',
      pricePerSecondOverride ?? formatPricePerSecond(engineCaps)
    ),
    textToVideo: resolveKeySpecValue(specs, 'textToVideo', resolveModeSupported(engineCaps, 't2v')),
    imageToVideo: resolveKeySpecValue(specs, 'imageToVideo', resolveModeSupported(engineCaps, 'i2v')),
    videoToVideo: resolveKeySpecValue(specs, 'videoToVideo', resolveModeSupported(engineCaps, 'v2v')),
    firstLastFrame: resolveKeySpecValue(specs, 'firstLastFrame', resolveStatus(engineCaps?.keyframes)),
    referenceImageStyle: resolveKeySpecValue(specs, 'referenceImageStyle', resolveModeSupported(engineCaps, 'r2v')),
    referenceVideo: resolveKeySpecValue(specs, 'referenceVideo', 'Data pending'),
    maxResolution: resolveKeySpecValue(specs, 'maxResolution', formatMaxResolution(engineCaps)),
    maxDuration: resolveKeySpecValue(specs, 'maxDuration', formatDuration(engineCaps)),
    aspectRatios: resolveKeySpecValue(specs, 'aspectRatios', formatAspectRatios(engineCaps)),
    fpsOptions: resolveKeySpecValue(specs, 'fpsOptions', formatFps(engineCaps)),
    outputFormats: resolveKeySpecValue(specs, 'outputFormats', 'Data pending'),
    audioOutput: resolveKeySpecValue(specs, 'audioOutput', resolveStatus(engineCaps?.audio)),
    nativeAudioGeneration: resolveKeySpecValue(specs, 'nativeAudioGeneration', resolveStatus(engineCaps?.audio)),
    lipSync: resolveKeySpecValue(specs, 'lipSync', 'Data pending'),
    cameraMotionControls: resolveKeySpecValue(
      specs,
      'cameraMotionControls',
      resolveStatus(engineCaps?.motionControls)
    ),
    watermark: resolveKeySpecValue(specs, 'watermark', 'No (MaxVideoAI)'),
  };
}

function isPending(value: string) {
  return value.trim().toLowerCase() === 'data pending';
}

function isUnsupported(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized === 'not supported' || normalized === 'unsupported';
}

function isSupported(value: string) {
  return value.trim().toLowerCase() === 'supported';
}

function normalizeMaxResolution(value: string) {
  const matchP = value.match(/(\d{3,4}p)/i);
  if (matchP) return matchP[1];
  const matchK = value.match(/(\d+)\s?k/i);
  if (matchK) return `${matchK[1]}K`;
  return value;
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
  const getBoolean = (key: string): boolean => custom[key] === true;
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
  const getPromptingTabNotes = (): SoraCopy['promptingTabNotes'] => {
    const value = custom['promptingTabNotes'];
    if (!value || typeof value !== 'object') return {};
    const obj = value as Record<string, unknown>;
    const pick = (key: string) => (typeof obj[key] === 'string' ? obj[key] : undefined);
    return {
      quick: pick('quick'),
      structured: pick('structured'),
      pro: pick('pro'),
      storyboard: pick('storyboard'),
    };
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
  const getHeroSpecChips = (): HeroSpecChip[] => {
    const value = custom['heroSpecChips'];
    if (!Array.isArray(value)) return [];
    return value.reduce<HeroSpecChip[]>((chips, entry) => {
      if (!entry || typeof entry !== 'object') return chips;
      const obj = entry as Record<string, unknown>;
      const label = typeof obj.label === 'string' ? obj.label.trim() : '';
      if (!label) return chips;
      const rawIcon = typeof obj.icon === 'string' ? obj.icon.trim() : '';
      const icon = (rawIcon in HERO_SPEC_ICON_MAP ? rawIcon : null) as HeroSpecIconKey | null;
      chips.push({ label, icon });
      return chips;
    }, []);
  };
  const getRelatedItems = (): RelatedItem[] => {
    const value = custom['relatedItems'];
    if (!Array.isArray(value)) return [];
    return value.reduce<RelatedItem[]>((items, entry) => {
      if (!entry || typeof entry !== 'object') return items;
      const obj = entry as Record<string, unknown>;
      const brand = typeof obj.brand === 'string' ? obj.brand.trim() : '';
      const title = typeof obj.title === 'string' ? obj.title.trim() : '';
      const description = typeof obj.description === 'string' ? obj.description.trim() : '';
      if (!brand || !title || !description) return items;
      const modelSlug = typeof obj.modelSlug === 'string' ? obj.modelSlug.trim() : null;
      const ctaLabel = typeof obj.ctaLabel === 'string' ? obj.ctaLabel.trim() : null;
      const href = typeof obj.href === 'string' ? obj.href.trim() : null;
      items.push({ brand, title, description, modelSlug, ctaLabel, href });
      return items;
    }, []);
  };
  const getBestUseCaseChips = (): BestUseCaseChip[] => {
    const value = custom['bestUseCaseChips'];
    if (!Array.isArray(value)) return [];
    return value.reduce<BestUseCaseChip[]>((chips, entry) => {
      if (!entry || typeof entry !== 'object') return chips;
      const obj = entry as Record<string, unknown>;
      const label = typeof obj.label === 'string' ? obj.label.trim() : '';
      if (!label) return chips;
      const rawIcon = typeof obj.icon === 'string' ? obj.icon.trim() : '';
      const icon = (rawIcon in BEST_USE_CASE_ICON_MAP ? rawIcon : null) as BestUseCaseIconKey | null;
      chips.push({ label, icon });
      return chips;
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
  const bestUseCaseChips = getBestUseCaseChips();
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
  const promptingGlobalPrinciples = getStringArray('promptingGlobalPrinciples');
  const promptingEngineWhy = getStringArray('promptingEngineWhy');
  const promptingTabNotes = getPromptingTabNotes();

  return {
    heroTitle: localized.hero?.title ?? getString('heroTitle'),
    heroSubtitle: localized.hero?.intro ?? getString('heroSubtitle'),
    heroBadge: localized.hero?.badge ?? getString('heroBadge'),
    heroSpecChips: getHeroSpecChips(),
    heroTrustLine: getString('heroTrustLine'),
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
    bestUseCaseChips,
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
    hideQuickPricing: getBoolean('hideQuickPricing'),
    showPricePerSecondInSpecs: getBoolean('showPricePerSecondInSpecs'),
    hidePricingSection: getBoolean('hidePricingSection'),
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
    relatedItems: getRelatedItems(),
    finalPara1: getString('finalPara1'),
    finalPara2: getString('finalPara2'),
    finalButton: getString('finalButton'),
    faqTitle: getString('faqTitle'),
    faqs: getFaqs(),
    promptingGlobalPrinciples,
    promptingEngineWhy,
    promptingTabNotes,
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
  const showPricePerSecondInSpecs = copy.showPricePerSecondInSpecs;
  const keySpecsMap = await loadEngineKeySpecs();
  const keySpecsEntry =
    keySpecsMap.get(engine.modelSlug) ?? keySpecsMap.get(engine.id) ?? null;
  const pricePerSecondLabel = await buildPricePerSecondLabel(pricingEngine, locale);
  const keySpecValues = keySpecsEntry
    ? buildSpecValues(engine, keySpecsEntry.keySpecs, pricePerSecondLabel)
    : null;
  const keySpecDefs = showPricePerSecondInSpecs
    ? KEY_SPEC_ROW_DEFS
    : KEY_SPEC_ROW_DEFS.filter((row) => row.key !== 'pricePerSecond');
  const keySpecRows: KeySpecRow[] = keySpecValues
    ? keySpecDefs.map(({ key, label }) => ({
        label,
        value: key === 'maxResolution' ? normalizeMaxResolution(keySpecValues[key]) : keySpecValues[key],
      })).filter((row) => !isPending(row.value) && !isUnsupported(row.value))
    : [];

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
      keySpecRows={keySpecRows}
      keySpecValues={keySpecValues}
      pricePerSecondLabel={pricePerSecondLabel}
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
  keySpecRows,
  keySpecValues,
  pricePerSecondLabel,
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
  keySpecRows: KeySpecRow[];
  keySpecValues: KeySpecValues | null;
  pricePerSecondLabel: string | null;
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
  const heroSpecChips = copy.heroSpecChips;
  const heroTrustLine = copy.heroTrustLine;
  const showHeroDescriptions = heroSpecChips.length === 0;
  const heroPrice = keySpecValues?.pricePerSecond ?? pricePerSecondLabel ?? formatPricePerSecond(engine);
  const heroDuration =
    typeof heroMedia.durationSec === 'number'
      ? `${heroMedia.durationSec}s`
      : keySpecValues?.maxDuration ?? 'Data pending';
  const heroFormat = heroMedia.aspectRatio ?? keySpecValues?.aspectRatios ?? 'Data pending';
  const heroMetaLines = [
    { label: 'Price', value: heroPrice },
    { label: 'Duration', value: heroDuration },
    { label: 'Format', value: heroFormat },
  ].filter((line) => Boolean(line.value));
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
  const bestUseCaseChips = copy.bestUseCaseChips;
  const whatFlowSteps = copy.whatFlowSteps;
  const quickStartTitle = copy.quickStartTitle;
  const quickStartBlocks = copy.quickStartBlocks;
  const breadcrumbModelLabel = localizedContent.marketingName ?? engine.marketingName ?? heroTitle;
  const howToLatamTitle = copy.howToLatamTitle;
  const howToLatamSteps = copy.howToLatamSteps;
  const specSections = copy.specSections;
  const quickPricingTitle = copy.quickPricingTitle;
  const promptPatternSteps = copy.promptPatternSteps;
  const imageToVideoSteps = copy.imageFlow;
  const imageToVideoUseCases = copy.imageWhy;
  const strengths = copy.strengths;
  const boundaries = copy.boundaries;
  const troubleshootingTitle = copy.troubleshootingTitle;
  const troubleshootingItems = copy.troubleshootingItems;
  const safetyRules = copy.safetyRules;
  const safetyInterpretation = copy.safetyInterpretation;
  const comparisonPoints = copy.comparisonPoints;
  const relatedCtaSora2 = copy.relatedCtaSora2;
  const relatedCtaSora2Pro = copy.relatedCtaSora2Pro;
  const relatedItems = copy.relatedItems;
  const isSoraPrompting = engine.modelSlug === 'sora-2' || engine.modelSlug === 'sora-2-pro';
  const baseFaqList = faqEntries.map((entry) => ({
    question: entry.question,
    answer: entry.answer,
  }));
  const soraFaqList = [
    {
      question: 'Is Sora available in Europe / the UK?',
      answer: 'Yes — you can generate from Europe, the UK, and most supported locations.',
    },
    {
      question: 'Can Sora generate 1080p videos?',
      answer: 'This tier outputs 720p. For 1080p, use Sora Pro.',
    },
    {
      question: 'Does Sora support image-to-video?',
      answer: 'Yes. Upload a single reference frame (up to ~50 MB) and prompt motion + timing.',
    },
    {
      question: 'Can I remix or extend an existing video?',
      answer: 'Not in this configuration. It’s text → video and image → video only. Generate multiple clips for longer edits.',
    },
    {
      question: 'How do I keep outputs consistent (brand look)?',
      answer: 'Use a reference image, name your palette and lighting, and reuse the same prompt structure across takes.',
    },
    {
      question: 'Does Sora support audio and lip sync?',
      answer: 'Audio is included. Lip sync works best with short lines (long speeches can drift).',
    },
  ];
  const faqTitle = (isSoraPrompting ? 'FAQ' : copy.faqTitle) ?? 'FAQ';
  const faqList = isSoraPrompting ? soraFaqList : baseFaqList;
  const faqJsonLdEntries = faqList.slice(0, 6);
  const pageDescription = heroDesc1 ?? heroSubtitle ?? localizedContent.seo.description ?? heroTitle;
  const heroPosterAbsolute = toAbsoluteUrl(heroMedia.posterUrl ?? localizedContent.seo.image ?? null);
  const heroVideoAbsolute = heroMedia.videoUrl ? toAbsoluteUrl(heroMedia.videoUrl) : null;
  const durationIso = heroMedia.durationSec ? `PT${Math.round(heroMedia.durationSec)}S` : undefined;
  const hasKeySpecRows = keySpecRows.length > 0;
  const hasSpecs = specSections.length > 0 || hasKeySpecRows;
  const hasExamples = galleryVideos.length > 0;
  const hasTextSection =
    isSoraPrompting ||
    promptPatternSteps.length > 0 ||
    Boolean(copy.promptTitle || copy.promptIntro || copy.promptSkeleton || copy.promptSkeletonNote);
  const hasWhatSection =
    !isSoraPrompting &&
    Boolean(
      copy.whatTitle ||
        copy.whatIntro1 ||
        copy.whatIntro2 ||
        quickStartTitle ||
        quickStartBlocks.length ||
        whatFlowSteps.length
    );
  const hasImageSection = isSoraPrompting || imageToVideoSteps.length > 0 || imageToVideoUseCases.length > 0;
  const hasTipsSection =
    isSoraPrompting || strengths.length > 0 || boundaries.length > 0 || Boolean(copy.tipsTitle);
  const hasSafetySection =
    isSoraPrompting || safetyRules.length > 0 || safetyInterpretation.length > 0 || Boolean(copy.safetyTitle);
  const hasFaqSection = isSoraPrompting || faqList.length > 0;
  const isImageEngine = engine.type === 'image';
  const textAnchorId = isImageEngine ? 'text-to-image' : 'text-to-video';
  const imageAnchorId = isImageEngine ? 'image-to-image' : 'image-to-video';
  const imageWorkflowAnchorId = 'image-workflow';
  const compareAnchorId = isSoraPrompting ? 'compare' : imageWorkflowAnchorId;
  const tocItems = [
    { id: 'specs', label: 'Specs', visible: hasSpecs },
    { id: textAnchorId, label: 'Examples', visible: hasExamples },
    { id: imageAnchorId, label: 'Prompting', visible: hasTextSection },
    { id: 'tips', label: 'Tips', visible: hasTipsSection },
    {
      id: compareAnchorId,
      label: isSoraPrompting ? 'Compare' : isImageEngine ? 'Image to Image' : 'Image to Video',
      visible: hasImageSection,
    },
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
      <main className="container-page max-w-6xl pb-0 pt-5 sm:pt-7">
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

            <section className="stack-gap rounded-3xl bg-surface/80 p-6 sm:p-8">
              <div className="stack-gap-lg">
            <div className="stack-gap-sm text-center">
              <h1 className="text-3xl font-semibold text-text-primary sm:text-5xl">
                {heroTitle}
              </h1>
              {heroSubtitle ? (
                <p className="text-base leading-relaxed text-text-secondary sm:text-lg">
                  {heroSubtitle}
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
              {showHeroDescriptions && heroDesc1 ? (
                <p className="text-base leading-relaxed text-text-secondary">{heroDesc1}</p>
              ) : null}
              {showHeroDescriptions && heroDesc2 ? (
                <p className="text-base leading-relaxed text-text-secondary">{heroDesc2}</p>
              ) : null}
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
                    hideLabel
                    hidePrompt
                    metaLines={heroMetaLines}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-4">
                {bestUseCases.length || bestUseCaseChips.length ? (
                  <div className="space-y-1.5 rounded-2xl border border-hairline bg-surface/80 p-3 shadow-card">
                    {copy.bestUseCasesTitle ? (
                      <p className="text-xs font-semibold text-text-primary">{copy.bestUseCasesTitle}</p>
                    ) : null}
                    {bestUseCaseChips.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {bestUseCaseChips.map((chip, index) => {
                          const Icon = chip.icon ? BEST_USE_CASE_ICON_MAP[chip.icon] : null;
                          return (
                            <Chip
                              key={`${chip.label}-${index}`}
                              variant="outline"
                              className="px-2.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-text-secondary"
                            >
                              {Icon ? <UIIcon icon={Icon} size={14} className="text-text-muted" /> : null}
                              <span>{chip.label}</span>
                            </Chip>
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
            className={`${FULL_BLEED_SECTION} sticky top-[calc(var(--header-height)-8px)] z-40 border-b border-hairline bg-white before:bg-white`}
            aria-label="Model page sections"
          >
            <div className="mx-auto w-full max-w-6xl px-6 sm:px-8">
              <div className="flex flex-wrap justify-center gap-2 py-0.5">
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
            {copy.specTitle ? (
              <h2 className="mt-2 text-center text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">
                {copy.specTitle}
              </h2>
            ) : null}
            {copy.specNote ? (
              <blockquote className="rounded-2xl border border-hairline bg-surface-2 px-4 py-3 text-center text-sm text-text-secondary">
                {copy.specNote}
              </blockquote>
            ) : null}
            {keySpecRows.length ? (
              <div className="mx-auto grid max-w-5xl grid-cols-2 gap-x-3 gap-y-1.5 border-t border-hairline/70 pt-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {keySpecRows.map((row, index) => (
                  <div
                    key={row.label}
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
                        {isSupported(row.value) ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <UIIcon icon={Check} size={14} className="text-emerald-600" />
                            <span className="sr-only">Supported</span>
                          </span>
                        ) : (
                          row.value
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {specSections.length ? (
              <div className="grid grid-gap-sm grid-cols-2">
                {specSections.map((section) => {
                  const normalizedTitle = section.title.toLowerCase();
                  const isInputsCard =
                    isSoraPrompting && normalizedTitle.startsWith('inputs & file types');
                  const isAudioCard = isSoraPrompting && normalizedTitle.startsWith('audio');

                  if (isInputsCard) {
                    return (
                      <article
                        key={section.title}
                        className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card"
                      >
                        <details className="group rounded-xl px-0 py-0 text-sm text-text-secondary">
                          <summary className="cursor-pointer list-none text-lg font-semibold text-text-primary">
                            <span className="flex items-center justify-between gap-3">
                              <span>Inputs &amp; file types</span>
                              <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-micro text-text-muted">
                                Details
                                <UIIcon
                                  icon={ChevronDown}
                                  size={14}
                                  className="text-text-muted transition group-open:rotate-180"
                                />
                              </span>
                            </span>
                          </summary>
                          <div className="mt-2 stack-gap-sm">
                            <p className="text-sm text-text-secondary">
                              Start from text or a single reference image — then prompt motion + timing.
                            </p>
                            <ul className="list-disc space-y-1 pl-5">
                              <li>
                                Text → Video: 1–3 sentences. Think shot description: subject + action + camera + vibe.
                              </li>
                              <li>
                                Image → Video: upload one still to lock the look, then describe motion + timing.
                              </li>
                              <li>
                                Reference images showing real people are blocked — use characters, non-human subjects,
                                or product shots.
                              </li>
                            </ul>
                          </div>
                        </details>
                      </article>
                    );
                  }

                  if (isAudioCard) {
                    return (
                      <article
                        key={section.title}
                        className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card"
                      >
                        <details className="group rounded-xl px-0 py-0 text-sm text-text-secondary">
                          <summary className="cursor-pointer list-none text-lg font-semibold text-text-primary">
                            <span className="flex items-center justify-between gap-3">
                              <span>Audio (included)</span>
                              <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-micro text-text-muted">
                                Details
                                <UIIcon
                                  icon={ChevronDown}
                                  size={14}
                                  className="text-text-muted transition group-open:rotate-180"
                                />
                              </span>
                            </span>
                          </summary>
                          <div className="mt-2 stack-gap-sm">
                            <p className="text-sm text-text-secondary">
                              Audio ships with the clip — use 1–2 sound cues to make it feel intentional.
                            </p>
                            <ul className="list-disc space-y-1 pl-5">
                              <li>
                                Add 1–2 key sound cues as pacing anchors (e.g., distant traffic hiss, packaging
                                crinkle, footsteps on wet pavement).
                              </li>
                              <li>
                                Lip sync works best with short, punchy lines — long speeches can drift.
                              </li>
                            </ul>
                          </div>
                        </details>
                      </article>
                    );
                  }

                  return (
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
                  );
                })}
              </div>
            ) : null}
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
                  <p className="text-center text-base leading-relaxed text-text-secondary">{copy.galleryIntro}</p>
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
                                  video.prompt
                                    ? `MaxVideoAI ${video.engineLabel} example – ${video.prompt}`
                                    : `MaxVideoAI ${video.engineLabel} example`
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

        <section
          id={imageAnchorId}
          className={`${FULL_BLEED_SECTION} ${SECTION_BG_B} ${SECTION_PAD} ${SECTION_SCROLL_MARGIN} stack-gap`}
        >
          {isSoraPrompting ? (
            <div className="stack-gap-lg">
              <SoraPromptingTabs
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
                        promptLabel={copy.demoPromptLabel ?? undefined}
                        promptLines={copy.demoPrompt}
                      />
                    ) : (
                      <div className="flex h-full min-h-[280px] items-center justify-center rounded-xl border border-dashed border-hairline bg-bg text-sm text-text-secondary">
                        {copy.galleryIntro ?? 'Demo clip coming soon.'}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              {copy.promptTitle ? (
                <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">
                  {copy.promptTitle}
                </h2>
              ) : null}
              {copy.promptIntro ? <p className="text-base leading-relaxed text-text-secondary">{copy.promptIntro}</p> : null}
              <div className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
                {promptPatternSteps.length ? (
                  <div className="space-y-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                      {promptPatternSteps.map((step, index) => (
                        <div
                          key={step}
                          className="flex items-start gap-4 rounded-xl bg-bg px-3 py-2 text-sm text-text-secondary"
                        >
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
            </>
          )}
        </section>

        {!isSoraPrompting && (copy.demoTitle || copy.demoPrompt.length || copy.demoNotes.length) ? (
          <section className={`${FULL_BLEED_SECTION} ${SECTION_BG_A} ${SECTION_PAD} stack-gap-lg`}>
            {copy.demoTitle ? (
              <h2 className="mt-2 text-center text-2xl font-semibold text-text-primary sm:mt-0 sm:text-3xl">
                {copy.demoTitle}
              </h2>
            ) : null}
            <div className="stack-gap-lg">
              <div className="mx-auto w-full max-w-5xl">
                {demoMedia ? (
                  <MediaPreview
                    media={demoMedia}
                    label={copy.demoTitle ?? 'Sora 2 demo'}
                    promptLabel={copy.demoPromptLabel ?? undefined}
                    promptLines={copy.demoPrompt}
                  />
                ) : (
                  <div className="flex h-full min-h-[280px] items-center justify-center rounded-xl border border-dashed border-hairline bg-bg text-sm text-text-secondary">
                    {copy.galleryIntro ?? 'Demo clip coming soon.'}
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {isSoraPrompting ? (
          <section id="tips" className={`${FULL_BLEED_SECTION} ${SECTION_BG_A} ${SECTION_PAD} ${SECTION_SCROLL_MARGIN} stack-gap-lg`}>
            <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">
              Tips &amp; quick fixes (plain English)
            </h2>
            <p className="text-base leading-relaxed text-text-secondary">
              Sora is most predictable when you keep the shot simple, readable, and physical.
            </p>
            <div className="grid grid-gap-sm lg:grid-cols-3">
              <div className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
                <h3 className="text-base font-semibold text-text-primary">What works best</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                  <li>One clear subject + one visible action</li>
                  <li>Simple environments with 2–3 visual anchors</li>
                  <li>One main camera move (push-in, pan, handheld, tracking — pick one)</li>
                  <li>Short beats (4–12 seconds): one moment, not a full storyline</li>
                  <li>For storyboard / shot list prompts: 2–3 beats max in one clip</li>
                </ul>
              </div>
              <div className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
                <h3 className="text-base font-semibold text-text-primary">Common problems → fast fixes</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                  <li>Feels random / inconsistent → simplify to: subject + action + camera + lighting. Re-run 2–3 takes.</li>
                  <li>Motion looks weird → reduce movement: one camera move, slower action, fewer props.</li>
                  <li>Subject drifts off-brand → start from a reference image and lock palette + lighting.</li>
                  <li>Text looks wrong → avoid readable signage, tiny UI, micro labels. Keep text off-screen.</li>
                  <li>Dialogue drifts → keep lines short and punchy; avoid long monologues.</li>
                </ul>
              </div>
              <div className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
                <h3 className="text-base font-semibold text-text-primary">Hard limits to keep in mind</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                  <li>Output is short-form (4 / 8 / 12 seconds). For longer edits, stitch multiple clips.</li>
                  <li>This tier is 720p (use Pro for higher resolution).</li>
                  <li>No video input here — start from text or a single reference image.</li>
                  <li>
                    <strong>Reference image requirements are strict (Image→Video):</strong> use <strong>one clean still image</strong> that matches your target aspect ratio. Avoid <strong>real people</strong>, <strong>logos/watermarks</strong>, <strong>readable text</strong>, and <strong>collages</strong> — some uploads may be blocked.
                  </li>
                  <li>No fixed seeds — iteration = re-run + refine.</li>
                </ul>
              </div>
            </div>
          </section>
        ) : copy.tipsTitle || strengths.length || boundaries.length ? (
          <section
            id="tips"
            className={`${FULL_BLEED_SECTION} ${SECTION_BG_B} ${SECTION_PAD} stack-gap-lg`}
          >
            {copy.tipsTitle ? (
              <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">
                {copy.tipsTitle}
              </h2>
            ) : null}
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

        {isSoraPrompting ? (
          <section
            id={compareAnchorId}
            className={`${FULL_BLEED_SECTION} ${SECTION_BG_B} ${SECTION_PAD} ${SECTION_SCROLL_MARGIN} stack-gap-lg`}
          >
            <h2 className="mt-2 flex flex-wrap items-center gap-2 text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">
              <span>Sora vs Sora Pro</span>
              <TextLink
                href={localizeModelsPath('sora-2-pro')}
                className="text-sm font-semibold text-brand hover:text-brandHover"
                linkComponent={Link}
              >
                View Sora 2 Pro details →
              </TextLink>
            </h2>
            <div className="grid grid-gap-sm lg:grid-cols-2">
              <div className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
                <h3 className="text-base font-semibold text-text-primary">Use Sora when you want:</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                  <li>Fast idea → clip iteration</li>
                  <li>Storyboards, concepts, UGC-style beats, short ads</li>
                  <li>A quick first pass where 720p is enough</li>
                </ul>
              </div>
              <div className="stack-gap-sm rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
                <h3 className="text-base font-semibold text-text-primary">Use Sora Pro when you need:</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                  <li>Higher resolution output</li>
                  <li>More control for finals (including audio control in the UI)</li>
                  <li>Cleaner final takes after you’ve validated the idea</li>
                </ul>
              </div>
            </div>
            {isSoraPrompting && (relatedItems.length || relatedEngines.length) ? (
              <div className="stack-gap">
                <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">
                  Compare Sora 2 vs other AI video models
                </h2>
                <p className="text-base leading-relaxed text-text-secondary">
                  Not sure if Sora 2 is the best fit for your shot? These side-by-side comparisons break down the tradeoffs —
                  <strong> price per second, resolution, audio, speed, and motion style</strong> — so you can pick the right
                  engine fast.
                </p>
                <p className="text-sm text-text-secondary">Each page includes real outputs and practical best-use cases.</p>
                <div className="grid grid-gap-sm md:grid-cols-3">
                  {(relatedItems.length
                    ? relatedItems
                    : relatedEngines.map((entry) => ({
                        brand: entry.brandId,
                        title: entry.marketingName ?? entry.engine.label,
                        modelSlug: entry.modelSlug,
                      }))
                  )
                    .filter((entry) => Boolean(entry.modelSlug))
                    .map((entry) => {
                      const label = entry.title ?? '';
                      const compareBaseSlug = 'sora-2';
                      const compareSlug = [compareBaseSlug, entry.modelSlug].sort().join('-vs-');
                      const compareHref = localizeComparePath(compareSlug, compareBaseSlug);
                      const descriptionBySlug: Record<string, string> = {
                        'sora-2-pro':
                          'Need higher resolution or more control for finals? Sora 2 Pro is the upgrade path from Sora 2 when you’re done storyboarding and want cleaner deliverables.',
                        'veo-3-1':
                          'Veo 3.1 is strong for cinematic short-form with a different motion feel. Compare it to Sora 2 if you’re optimizing for audio, style, or a specific look.',
                        'veo-3-1-fast':
                          'Veo 3.1 Fast is built for cheaper, faster iteration. Compare it to Sora 2 if you want quick volume testing for ads and social.',
                      };
                      const ctaBySlug: Record<string, string> = {
                        'sora-2-pro': 'Compare OpenAI Sora 2 vs OpenAI Sora 2 Pro →',
                        'veo-3-1': 'Compare OpenAI Sora 2 vs Google Veo 3.1 →',
                        'veo-3-1-fast': 'Compare OpenAI Sora 2 vs Google Veo 3.1 Fast →',
                      };
                      const description =
                        descriptionBySlug[entry.modelSlug ?? ''] ??
                        `Compare Sora 2 vs ${label} on price, resolution, audio, speed, and motion style.`;
                      const ctaLabel = ctaBySlug[entry.modelSlug ?? ''] ?? `Compare Sora 2 vs ${label} →`;
                      return (
                        <article
                          key={entry.modelSlug}
                          className="rounded-2xl border border-hairline bg-surface/90 p-4 shadow-card transition hover:-translate-y-1 hover:border-text-muted"
                        >
                          {entry.brand ? (
                            <p className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">
                              {entry.brand}
                            </p>
                          ) : null}
                          <h3 className="mt-2 text-lg font-semibold text-text-primary">Sora 2 vs {label}</h3>
                          <p className="mt-2 text-sm text-text-secondary line-clamp-2">{description}</p>
                          <TextLink
                            href={compareHref}
                            className="mt-4 gap-1 text-sm font-semibold text-brand hover:text-brandHover"
                            linkComponent={Link}
                          >
                            {ctaLabel}
                          </TextLink>
                        </article>
                      );
                    })}
                </div>
                <ButtonLink
                  href={normalizedPrimaryCtaHref}
                  size="lg"
                  className="w-fit shadow-card"
                  linkComponent={Link}
                >
                  Generate Sora 2 in MaxVideoAI →
                </ButtonLink>
              </div>
            ) : null}
          </section>
        ) : null}

        {!isSoraPrompting ? (
          <section
            id={compareAnchorId}
            className={`${FULL_BLEED_SECTION} ${SECTION_BG_A} ${SECTION_PAD} ${SECTION_SCROLL_MARGIN} stack-gap`}
          >
            {copy.imageTitle ? (
              <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">
                {copy.imageTitle}
              </h2>
            ) : null}
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
        ) : null}

        {!isSoraPrompting ? (
          <section
            id="examples"
            className={`${FULL_BLEED_SECTION} ${SECTION_BG_A} ${SECTION_PAD} stack-gap`}
          >
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
        ) : null}

        {!isSoraPrompting && (copy.comparisonTitle || comparisonPoints.length) ? (
          <section className={`${FULL_BLEED_SECTION} ${SECTION_BG_B} ${SECTION_PAD} stack-gap`}>
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

        {!isSoraPrompting && (relatedItems.length || relatedEngines.length) ? (
          <section className={`${FULL_BLEED_SECTION} ${SECTION_BG_A} ${SECTION_PAD} stack-gap`}>
            <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">
              {copy.relatedTitle ?? 'Explore other models'}
            </h2>
            {copy.relatedSubtitle ? <p className="text-sm text-text-secondary">{copy.relatedSubtitle}</p> : null}
            <div className="grid grid-gap-sm md:grid-cols-3">
              {(relatedItems.length
                ? relatedItems.map((item) => {
                    const compareSlug = item.modelSlug
                      ? [engineSlug, item.modelSlug].sort().join('-vs-')
                      : null;
                    const compareHref = item.href
                      ? item.href
                      : compareSlug
                        ? localizeComparePath(compareSlug, engineSlug)
                        : localizeModelsPath(item.modelSlug ?? '');
                    const label = item.ctaLabel ?? 'Compare →';
                    return (
                      <article
                        key={`${item.brand}-${item.title}`}
                        className="rounded-2xl border border-hairline bg-surface/90 p-4 shadow-card transition hover:-translate-y-1 hover:border-text-muted"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">
                          {item.brand}
                        </p>
                        <h3 className="mt-2 text-lg font-semibold text-text-primary">{item.title}</h3>
                        <p className="mt-2 text-sm text-text-secondary line-clamp-3">{item.description}</p>
                        <TextLink href={compareHref} className="mt-4 gap-1 text-sm" linkComponent={Link}>
                          {label}
                        </TextLink>
                      </article>
                    );
                  })
                : relatedEngines.map((entry) => {
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
                  }))}
            </div>
          </section>
        ) : null}

        {isSoraPrompting ? (
          <section
            id="safety"
            className={`${FULL_BLEED_SECTION} ${SECTION_BG_B} ${SECTION_PAD} ${SECTION_SCROLL_MARGIN} stack-gap`}
          >
            <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">
              Safety &amp; people / likeness (practical version)
            </h2>
            <div className="rounded-2xl border border-hairline bg-surface/80 p-4 shadow-card">
              <ul className="list-disc space-y-1 pl-5 text-sm text-text-secondary">
                <li>Don’t generate real people or public figures (celebrities, politicians, etc.).</li>
                <li>No minors, sexual content, hateful content, or graphic violence.</li>
                <li>Don’t use someone’s likeness without consent.</li>
                <li>Some prompts and reference images may be blocked — generic characters and scenes are fine.</li>
              </ul>
            </div>
          </section>
        ) : copy.safetyTitle || safetyRules.length ? (
          <section
            id="safety"
            className={`${FULL_BLEED_SECTION} ${SECTION_BG_A} ${SECTION_PAD} ${SECTION_SCROLL_MARGIN} stack-gap`}
          >
            {copy.safetyTitle ? (
              <h2 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl sm:mt-0">
                {copy.safetyTitle}
              </h2>
            ) : null}
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
            {isSoraPrompting ? (
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
            ) : (
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
            )}
          </section>
        ) : null}
        <FAQSchema questions={faqJsonLdEntries} />
        </div>
      </main>
    </>
  );
}

function MediaPreview({
  media,
  label,
  promptLabel,
  promptLines = [],
  hideLabel = false,
  hidePrompt = false,
  metaLines = [],
}: {
  media: FeaturedMedia;
  label: string;
  promptLabel?: string;
  promptLines?: string[];
  hideLabel?: boolean;
  hidePrompt?: boolean;
  metaLines?: Array<{ label: string; value: string }>;
}) {
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
        {!hideLabel ? <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{label}</p> : null}
        {metaLines.length ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-text-secondary">
            {metaLines.map((line) => (
              <li key={line.label} className="flex items-center gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-micro text-text-muted">
                  {line.label}
                </span>
                <span>{line.value}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {!hidePrompt && promptLabel ? (
          <p className="text-xs font-semibold text-text-secondary">{promptLabel}</p>
        ) : null}
        {!hidePrompt && promptLines.length ? (
          <div className="space-y-2 text-sm text-text-primary">
            {promptLines.map((line) => (
              <p key={line} className="leading-relaxed">
                {line}
              </p>
            ))}
          </div>
        ) : null}
        {!hidePrompt && promptLines.length === 0 && media.prompt ? (
          <p className="text-sm font-semibold leading-snug text-text-primary">{media.prompt}</p>
        ) : null}
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
