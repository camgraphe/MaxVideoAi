import type { Metadata } from 'next';
import Script from 'next/script';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { Link } from '@/i18n/navigation';
import { UIIcon } from '@/components/ui/UIIcon';
import { Clapperboard, Copy, Film, Sparkles, Timer, Wand2, Wallet } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { resolveDictionary } from '@/lib/i18n/server';
import { listFalEngines, type FalEngineEntry } from '@/config/falEngines';
import { localePathnames, type AppLocale } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { SITE_BASE_URL } from '@/lib/metadataUrls';
import { getBreadcrumbLabels } from '@/lib/seo/breadcrumbs';
import { ModelsGallery } from '@/components/marketing/ModelsGallery';
import { ModelsCompareHeroToggle } from '@/components/marketing/ModelsCompareHeroToggle';
import { getEnginePictogram } from '@/lib/engine-branding';
import { getEngineLocalized } from '@/lib/models/i18n';
import engineCatalog from '@/config/engine-catalog.json';
const MODELS_SLUG_MAP = buildSlugMap('models');

const DEFAULT_ENGINE_TYPE_LABELS = {
  textImage: 'Text + Image to Video',
  text: 'Text to Video',
  image: 'Image to Video',
  default: 'AI Video Engine',
} as const;

type EngineCatalogEntry = (typeof engineCatalog)[number];

type EngineScore = {
  engineId?: string;
  modelSlug?: string;
  fidelity?: number;
  visualQuality?: number | null;
  motion?: number;
  consistency?: number;
  anatomy?: number;
  textRendering?: number;
  lipsyncQuality?: number | null;
  sequencingQuality?: number | null;
  controllability?: number | null;
  speedStability?: number | null;
  pricing?: number | null;
};

type EngineScoresFile = {
  scores?: EngineScore[];
};

type EngineKeySpecsEntry = {
  modelSlug?: string;
  engineId?: string;
  keySpecs?: Record<string, unknown>;
};

type EngineKeySpecsFile = {
  specs?: EngineKeySpecsEntry[];
};

async function loadEngineKeySpecs(): Promise<Map<string, Record<string, unknown>>> {
  const candidates = [
    path.join(process.cwd(), 'data', 'benchmarks', 'engine-key-specs.v1.json'),
    path.join(process.cwd(), '..', 'data', 'benchmarks', 'engine-key-specs.v1.json'),
  ];
  for (const candidate of candidates) {
    try {
      const raw = await fs.readFile(candidate, 'utf8');
      const data = JSON.parse(raw) as EngineKeySpecsFile;
      const map = new Map<string, Record<string, unknown>>();
      (data.specs ?? []).forEach((entry) => {
        const key = entry.modelSlug ?? entry.engineId;
        if (key && entry.keySpecs) {
          map.set(key, entry.keySpecs);
        }
      });
      return map;
    } catch {
      // keep trying
    }
  }
  return new Map();
}

async function loadEngineScores(): Promise<Map<string, EngineScore>> {
  const candidates = [
    path.join(process.cwd(), 'data', 'benchmarks', 'engine-scores.v1.json'),
    path.join(process.cwd(), '..', 'data', 'benchmarks', 'engine-scores.v1.json'),
  ];
  for (const candidate of candidates) {
    try {
      const raw = await fs.readFile(candidate, 'utf8');
      const data = JSON.parse(raw) as EngineScoresFile;
      const map = new Map<string, EngineScore>();
      (data.scores ?? []).forEach((entry) => {
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

function getCatalogBySlug() {
  return new Map<string, EngineCatalogEntry>(engineCatalog.map((entry) => [entry.modelSlug, entry]));
}

function resolveSupported(value: unknown) {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'supported' || normalized === 'yes' || normalized === 'true') return true;
  if (normalized === 'not supported' || normalized === 'no' || normalized === 'false') return false;
  return null;
}

function extractMaxResolution(value?: string | null, fallback?: string[]) {
  const candidates = [value ?? '', ...(fallback ?? [])];
  let explicitMax = 0;
  let fallbackMax = 0;
  candidates.forEach((entry) => {
    const normalized = entry.toLowerCase();
    if (normalized.includes('4k')) {
      explicitMax = Math.max(explicitMax, 2160);
      return;
    }
    const pMatches = normalized.match(/(\d{3,4})p/g) ?? [];
    if (pMatches.length) {
      pMatches.forEach((match) => {
        const num = Number(match.replace('p', ''));
        if (!Number.isNaN(num)) explicitMax = Math.max(explicitMax, num);
      });
      return;
    }
    const matches = normalized.match(/(\d{3,4})/g) ?? [];
    matches.forEach((match) => {
      const num = Number(match);
      if (!Number.isNaN(num)) fallbackMax = Math.max(fallbackMax, num);
    });
  });
  const max = explicitMax || fallbackMax;
  if (!max) return { label: 'Data pending', value: null };
  return { label: `${max}p`, value: max };
}

function extractMaxDuration(value?: string | null, fallback?: number | null) {
  if (typeof value === 'string') {
    const match = value.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      const num = Number(match[1]);
      if (!Number.isNaN(num)) return { label: `${num}s`, value: num };
    }
  }
  if (typeof fallback === 'number') {
    return { label: `${fallback}s`, value: fallback };
  }
  return { label: 'Data pending', value: null };
}

function getMinPricePerSecond(entry?: EngineCatalogEntry | null) {
  if (!entry?.engine) return null;
  const perSecond = entry.engine.pricingDetails?.perSecondCents;
  const candidates: number[] = [];
  if (typeof perSecond?.default === 'number') {
    candidates.push(perSecond.default);
    const audioOffDelta = entry.engine.pricingDetails?.addons?.audio_off?.perSecondCents;
    if (typeof audioOffDelta === 'number') {
      candidates.push(perSecond.default + audioOffDelta);
    }
  }
  if (perSecond?.byResolution) {
    Object.values(perSecond.byResolution).forEach((value) => {
      if (typeof value === 'number') candidates.push(value);
    });
  }
  if (typeof entry.engine.pricing?.base === 'number') {
    candidates.push(Math.round(entry.engine.pricing.base * 100));
  }
  if (!candidates.length) return null;
  return Math.min(...candidates);
}

function formatPriceFrom(entry?: EngineCatalogEntry | null) {
  const cents = getMinPricePerSecond(entry);
  if (typeof cents === 'number') {
    return `$${(cents / 100).toFixed(2)}/s`;
  }
  return 'Data pending';
}

const SCORE_LABELS: Array<{ key: keyof EngineScore; label: string }> = [
  { key: 'fidelity', label: 'Prompt Adherence' },
  { key: 'visualQuality', label: 'Visual Quality' },
  { key: 'motion', label: 'Motion Realism' },
  { key: 'consistency', label: 'Temporal Consistency' },
  { key: 'anatomy', label: 'Human Fidelity' },
  { key: 'textRendering', label: 'Text & UI Legibility' },
  { key: 'lipsyncQuality', label: 'Audio & Lip Sync' },
  { key: 'sequencingQuality', label: 'Multi-Shot Sequencing' },
  { key: 'controllability', label: 'Controllability' },
  { key: 'speedStability', label: 'Speed & Stability' },
  { key: 'pricing', label: 'Pricing' },
];
const SCORE_LABEL_KEYS = SCORE_LABELS.map((entry) => entry.key);
const DEFAULT_SCORE_LABEL_MAP = SCORE_LABELS.reduce((acc, entry) => {
  acc[entry.key] = entry.label;
  return acc;
}, {} as Record<keyof EngineScore, string>);

function computeOverall(score?: EngineScore | null) {
  if (!score) return null;
  const values = [score.fidelity, score.motion, score.consistency].filter(
    (value): value is number => typeof value === 'number'
  );
  if (!values.length) return null;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.round(avg * 10) / 10;
}

function deriveStrengths(score?: EngineScore | null, labels: Array<{ key: keyof EngineScore; label: string }> = SCORE_LABELS) {
  if (!score) return [];
  const entries = labels.map((entry) => {
    const value = score[entry.key];
    return typeof value === 'number' ? { label: entry.label, value } : null;
  }).filter((entry): entry is { label: string; value: number } => Boolean(entry));
  const nonPricing = entries.filter((entry) => entry.label !== 'Pricing');
  const pool = nonPricing.length ? nonPricing : entries;
  return pool
    .sort((a, b) => b.value - a.value)
    .slice(0, 2)
    .map((entry) => entry.label);
}

function toTitleCase(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const PROVIDER_LABEL_OVERRIDES: Record<string, string> = {
  'google-veo': 'Google',
  google: 'Google',
  openai: 'OpenAI',
  minimax: 'MiniMax',
  lightricks: 'Lightricks',
  pika: 'Pika',
  kling: 'Kling',
  wan: 'Wan',
};

const PROVIDER_STRIP_IDS = new Set(['openai', 'google', 'google-veo', 'minimax']);

function formatProviderLabel(entry: FalEngineEntry, catalogEntry?: EngineCatalogEntry | null) {
  const raw = entry.brandId ?? entry.engine.brandId ?? catalogEntry?.brandId ?? entry.provider;
  if (!raw) return '';
  const normalized = String(raw).toLowerCase();
  return PROVIDER_LABEL_OVERRIDES[normalized] ?? toTitleCase(raw);
}

function stripProvider(name: string, provider: string, providerId?: string | null) {
  if (!provider || !providerId || !PROVIDER_STRIP_IDS.has(providerId)) return name;
  const normalizedName = name.toLowerCase();
  const normalizedProvider = provider.toLowerCase();
  if (normalizedName.startsWith(normalizedProvider)) {
    return name.slice(provider.length).trim();
  }
  return name;
}

function clampDescription(value: string, maxLength = 110) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trim()}…`;
}

const USE_CASE_MAP: Record<string, string> = {
  'sora-2': 'cinematic scenes and character continuity',
  'sora-2-pro': 'studio-grade cinematic shots and hero scenes',
  'veo-3-1': 'ad-ready shots and precise framing control',
  'veo-3-1-fast': 'fast ad cuts and rapid iteration',
  'veo-3-1-first-last': 'storyboard-driven shots with fixed frames',
  'kling-2-6-pro': 'motion-realistic cinematic clips',
  'kling-2-5-turbo': 'fast iterations with stable prompt adherence',
  'wan-2-6': 'structured prompts with clean transitions',
  'wan-2-5': 'budget-friendly prompt testing',
  'pika-text-to-video': 'stylized social-first clips',
  'ltx-2': 'fast iteration with responsive motion',
  'ltx-2-fast': 'rapid testing and quick iteration',
  'minimax-hailuo-02-text': 'budget-friendly concept tests',
  'nano-banana': 'storyboards and still-first workflows',
  'nano-banana-pro': 'campaign stills and typography-focused edits',
};

const DEFAULT_VALUE_SENTENCE = 'Best for {useCase} with strong {strengths} in {capabilities} workflows.';
const DEFAULT_CAPABILITY_KEYWORDS: Record<string, string> = {
  T2V: 'text-to-video',
  I2V: 'image-to-video',
  V2V: 'video-to-video',
  'Lip sync': 'lip sync',
  Audio: 'native audio',
  'First/Last': 'first/last frame control',
  Extend: 'extend workflows',
};

function formatTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
}

function joinWithConjunction(values: string[], conjunction: string) {
  if (!values.length) return '';
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} ${conjunction} ${values[1]}`;
  return `${values.slice(0, -1).join(', ')} ${conjunction} ${values[values.length - 1]}`;
}

const SPEC_TOKEN_REGEX = /(\$\d+|\d+(?:\.\d+)?\s*s|\d+\s*seconds?|\d+\s*fps|\d+\s*p|\d+\s*×\s*\d+|4k|1080p|720p|2160p|\d+–\d+\s*s)/gi;
const PAREN_SPEC_REGEX = /\([^)]*?(\d|p|fps|\$)[^)]*\)/gi;

function sanitizeDescription(text: string) {
  const withoutParens = text.replace(PAREN_SPEC_REGEX, '');
  const withoutTokens = withoutParens.replace(SPEC_TOKEN_REGEX, '');
  const withoutHints = withoutTokens.replace(/\b(up to|from)\b\s*/gi, '');
  const withoutFragments = withoutHints
    .replace(/\s*\/+\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/([,.;:])\s*[-–]\s*/g, '$1 ')
    .replace(/\s{2,}/g, ' ');
  return withoutFragments.replace(/\s+$/, '').trim();
}

function capabilityKeywords(
  capabilities: string[],
  map: Record<string, string>,
  conjunction: string,
  fallback: string
) {
  const translated = capabilities.map((cap) => map[cap] ?? cap.toLowerCase());
  if (!translated.length) return fallback;
  return joinWithConjunction(translated, conjunction);
}

function buildValueSentence({
  slug,
  strengths,
  capabilities,
  fallback,
  template,
  strengthsFallback,
  capabilityFallback,
  conjunction,
  useCaseMap,
  capabilityMap,
}: {
  slug: string;
  strengths: string[];
  capabilities: string[];
  fallback: string;
  template: string;
  strengthsFallback: string;
  capabilityFallback: string;
  conjunction: string;
  useCaseMap: Record<string, string>;
  capabilityMap: Record<string, string>;
}) {
  const useCase = useCaseMap[slug] ?? fallback;
  const cleanedUseCase = sanitizeDescription(useCase);
  const strengthsText = strengths.length ? joinWithConjunction(strengths, conjunction) : strengthsFallback;
  const capabilityText = capabilityKeywords(capabilities, capabilityMap, conjunction, capabilityFallback);
  return formatTemplate(template, {
    useCase: cleanedUseCase,
    strengths: strengthsText,
    capabilities: capabilityText,
  });
}

export async function generateMetadata({ params }: { params: { locale: AppLocale } }): Promise<Metadata> {
  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: 'models.meta' });
  const title = t('title');
  const meta = buildSeoMetadata({
    locale,
    title,
    description: t('description'),
    hreflangGroup: 'models',
    slugMap: MODELS_SLUG_MAP,
    imageAlt: 'Model lineup overview with Price-Before chip.',
  });
  return {
    ...meta,
    title: { absolute: title },
    openGraph: meta.openGraph ? { ...meta.openGraph, title } : meta.openGraph,
    twitter: meta.twitter ? { ...meta.twitter, title } : meta.twitter,
  };
}

type EngineTypeKey = 'textImage' | 'text' | 'image' | 'default';

const ENGINE_TYPE_KEYS: EngineTypeKey[] = ['textImage', 'text', 'image', 'default'];

function getEngineTypeKey(entry: FalEngineEntry): EngineTypeKey {
  if (entry.type && ENGINE_TYPE_KEYS.includes(entry.type as EngineTypeKey)) return entry.type as EngineTypeKey;
  const modes = new Set(entry.engine.modes);
  const hasText = modes.has('t2v');
  const hasImage = modes.has('i2v');
  const hasImageGen = modes.has('t2i') || modes.has('i2i');
  if (hasText && hasImage) return 'textImage';
  if (hasText) return 'text';
  if (hasImage || hasImageGen) return 'image';
  return 'default';
}

function getEngineDisplayName(entry: FalEngineEntry): string {
  const name = entry.marketingName ?? entry.engine.label;
  return name
    .replace(/\s*\(.*\)$/, '')
    .replace(/\s+Text to Video$/i, '')
    .replace(/\s+Image to Video$/i, '')
    .trim();
}

export default async function ModelsPage() {
  const { locale, dictionary } = await resolveDictionary();
  const activeLocale = locale as AppLocale;
  const breadcrumbLabels = getBreadcrumbLabels(activeLocale);
  const localePrefix = localePathnames[activeLocale] ? `/${localePathnames[activeLocale]}` : '';
  const modelsPath = `${localePrefix}/${MODELS_SLUG_MAP[activeLocale] ?? MODELS_SLUG_MAP.en ?? 'models'}`.replace(
    /\/{2,}/g,
    '/'
  );
  const homeUrl = `${SITE_BASE_URL}${localePrefix || ''}`;
  const modelsUrl = `${SITE_BASE_URL}${modelsPath}`;
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: breadcrumbLabels.home,
        item: homeUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: breadcrumbLabels.models,
        item: modelsUrl,
      },
    ],
  };
  const content = dictionary.models;
  const galleryCopy = (content.gallery ?? {}) as unknown as {
    scoreLabels?: Record<keyof EngineScore, string>;
    valueSentence?: {
      template?: string;
      strengthsFallback?: string;
      capabilityFallback?: string;
      conjunction?: string;
      useCases?: Record<string, string>;
      capabilityKeywords?: Record<string, string>;
    };
    stats?: {
      typeShort?: string;
    };
  };
  const listingCopy = (content.listing ?? {}) as {
    hero?: {
      title?: string;
      subtitle?: string;
      bullets?: string[];
      compareLabel?: string;
    };
    grid?: {
      srTitle?: string;
      bridgeText?: string;
    };
    quickCompare?: {
      title?: string;
      subtitle?: string;
      shortcuts?: string[];
    };
    chooseOutcome?: {
      title?: string;
      subtitle?: string;
      tiles?: { title?: string; description?: string }[];
    };
    reliability?: {
      title?: string;
      subtitle?: string;
      items?: { title?: string; body?: string }[];
      faq?: { question?: string; answer?: string }[];
    };
    cta?: {
      title?: string;
      subtitle?: string;
      pills?: string[];
      microcopy?: string;
      primaryLabel?: string;
      secondaryLabel?: string;
    };
  };
  const heroTitle =
    listingCopy.hero?.title ?? content.hero?.title ?? 'Compare AI video models with live pricing';
  const heroSubhead =
    listingCopy.hero?.subtitle ??
    content.hero?.subtitle ??
    'Live $/s + real limits + examples — then compare two engines side by side.';
  const cardCtaLabel = content.cardCtaLabel ?? 'Explore model';
  const engineTypeLabels = {
    ...DEFAULT_ENGINE_TYPE_LABELS,
    ...(content.engineTypeLabels ?? {}),
  };
  const engineMetaCopy = (content.meta ?? {}) as Record<
    string,
    {
      displayName?: string;
      description?: string;
      priceBefore?: string;
      versionLabel?: string;
    }
  >;
  const keySpecsMap = await loadEngineKeySpecs();
  const scoresMap = await loadEngineScores();
  const catalogBySlug = getCatalogBySlug();

  const priorityOrder = [
    'sora-2',
    'sora-2-pro',
    'veo-3-1',
    'veo-3-1-fast',
    'veo-3-1-first-last',
    'pika-text-to-video',
    'wan-2-6',
    'wan-2-5',
    'kling-2-5-turbo',
    'kling-2-6-pro',
    'ltx-2-fast',
    'ltx-2',
    'minimax-hailuo-02-text',
    'nano-banana',
    'nano-banana-pro',
  ];

  const engineIndex = new Map<string, FalEngineEntry>(listFalEngines().map((entry) => [entry.modelSlug, entry]));
  const priorityEngines = priorityOrder
    .map((slug) => engineIndex.get(slug))
    .filter((entry): entry is FalEngineEntry => Boolean(entry));
  const remainingEngines = listFalEngines()
    .filter((entry) => !priorityOrder.includes(entry.modelSlug))
    .sort((a, b) => getEngineDisplayName(a).localeCompare(getEngineDisplayName(b)));
  const engines = [...priorityEngines, ...remainingEngines];

  const localizedMap = new Map<string, Awaited<ReturnType<typeof getEngineLocalized>>>(
    await Promise.all(
      engines.map(async (engine) => {
        const localized = await getEngineLocalized(engine.modelSlug, activeLocale);
        return [engine.modelSlug, localized] as const;
      })
    )
  );

  const scoreLabelMap = { ...DEFAULT_SCORE_LABEL_MAP, ...(galleryCopy.scoreLabels ?? {}) };
  const scoreLabels = SCORE_LABEL_KEYS.map((key) => ({
    key,
    label: scoreLabelMap[key] ?? DEFAULT_SCORE_LABEL_MAP[key],
  }));
  const valueTemplate = galleryCopy.valueSentence?.template ?? DEFAULT_VALUE_SENTENCE;
  const strengthsFallback = galleryCopy.valueSentence?.strengthsFallback ?? 'reliable outputs';
  const capabilityFallback = galleryCopy.valueSentence?.capabilityFallback ?? 'AI video';
  const conjunction = galleryCopy.valueSentence?.conjunction ?? 'and';
  const useCaseMap = { ...USE_CASE_MAP, ...(galleryCopy.valueSentence?.useCases ?? {}) };
  const capabilityMap = { ...DEFAULT_CAPABILITY_KEYWORDS, ...(galleryCopy.valueSentence?.capabilityKeywords ?? {}) };

  const modelCards = engines.map((engine) => {
    const meta = engineMetaCopy[engine.modelSlug] ?? engineMetaCopy[engine.id] ?? null;
    const localized = localizedMap.get(engine.modelSlug);
    const engineTypeKey = getEngineTypeKey(engine);
    const engineType = engineTypeLabels[engineTypeKey] ?? DEFAULT_ENGINE_TYPE_LABELS[engineTypeKey];
    const versionLabel = localized?.versionLabel ?? meta?.versionLabel ?? engine.versionLabel ?? '';
    const displayName =
      localized?.marketingName ?? meta?.displayName ?? engine.cardTitle ?? getEngineDisplayName(engine);
    const description = localized?.hero?.intro ?? localized?.overview ?? meta?.description ?? engineType;
    const catalogEntry = catalogBySlug.get(engine.modelSlug) ?? null;
    const keySpecs = keySpecsMap.get(engine.modelSlug) ?? {};
    const scoreEntry =
      scoresMap.get(engine.modelSlug) ?? scoresMap.get(engine.engine.id) ?? scoresMap.get(engine.id) ?? null;
    const overallScore = computeOverall(scoreEntry);
    const strengths = deriveStrengths(scoreEntry, scoreLabels);
    const providerId = (engine.brandId ?? engine.engine.brandId ?? catalogEntry?.brandId ?? '').toString().toLowerCase();
    const providerLabel = formatProviderLabel(engine, catalogEntry);
    const engineName = stripProvider(displayName, providerLabel, providerId) || displayName;
    const normalizedVersion = versionLabel.replace(/^v\s*/i, '').trim();
    const hasVersion =
      normalizedVersion &&
      (engineName.toLowerCase().includes(normalizedVersion.toLowerCase()) ||
        engineName.toLowerCase().includes(versionLabel.toLowerCase()));
    const titleLabel = normalizedVersion && !hasVersion ? `${engineName} ${normalizedVersion}` : engineName;
    const modes = new Set(catalogEntry?.engine?.modes ?? engine.engine.modes ?? []);
    const isImageOnly =
      !modes.has('t2v') &&
      !modes.has('i2v') &&
      !modes.has('v2v') &&
      (modes.has('t2i') || modes.has('i2i'));
    const t2v = resolveSupported((keySpecs as Record<string, unknown>).textToVideo) ?? modes.has('t2v');
    const i2v = resolveSupported((keySpecs as Record<string, unknown>).imageToVideo) ?? modes.has('i2v');
    const v2v = resolveSupported((keySpecs as Record<string, unknown>).videoToVideo) ?? modes.has('v2v');
    const firstLast =
      resolveSupported((keySpecs as Record<string, unknown>).firstLastFrame) ??
      Boolean(catalogEntry?.engine?.keyframes);
    const extend = Boolean(catalogEntry?.engine?.extend);
    const lipSync = resolveSupported((keySpecs as Record<string, unknown>).lipSync) ?? undefined;
    const audioSupported =
      resolveSupported((keySpecs as Record<string, unknown>).audioOutput) ??
      (catalogEntry?.engine?.audio == null ? null : Boolean(catalogEntry.engine.audio));
    const maxResolution = extractMaxResolution(
      (keySpecs as Record<string, string>).maxResolution,
      catalogEntry?.engine?.resolutions
    );
    const maxDuration = extractMaxDuration(
      (keySpecs as Record<string, string>).maxDuration,
      catalogEntry?.engine?.maxDurationSec ?? null
    );
    const priceFrom = formatPriceFrom(catalogEntry);
    const capabilityKeywordsList = [
      t2v ? 'T2V' : null,
      i2v ? 'I2V' : null,
      v2v ? 'V2V' : null,
      lipSync ? 'Lip sync' : null,
      audioSupported ? 'Audio' : null,
      firstLast ? 'First/Last' : null,
      extend ? 'Extend' : null,
    ]
      .filter(Boolean) as string[];
    const capabilities = capabilityKeywordsList
      .filter((cap) => cap !== 'Lip sync' && cap !== 'Audio')
      .slice(0, 5) as string[];
    const compareDisabled = ['nano-banana', 'nano-banana-pro'].includes(engine.modelSlug);
    const bestForFallback = catalogEntry?.bestFor ? sanitizeDescription(catalogEntry.bestFor) : engineType;
    const generatedDescription = buildValueSentence({
      slug: engine.modelSlug,
      strengths,
      capabilities: capabilityKeywordsList,
      fallback: bestForFallback,
      template: valueTemplate,
      strengthsFallback,
      capabilityFallback,
      conjunction,
      useCaseMap,
      capabilityMap,
    });
    const microDescription = clampDescription(generatedDescription, 120);
    const pictogram = getEnginePictogram({
      id: engine.engine.id,
      brandId: engine.brandId ?? engine.engine.brandId,
      label: displayName,
    });

    return {
      id: engine.modelSlug,
      label: titleLabel,
      provider: providerLabel,
      description: microDescription,
      versionLabel,
      overallScore,
      priceNote: null,
      priceNoteHref: null,
      href: { pathname: '/models/[slug]', params: { slug: engine.modelSlug } },
      backgroundColor: pictogram.backgroundColor,
      textColor: pictogram.textColor,
      strengths,
      capabilities: capabilities.slice(0, 5),
      stats: {
        priceFrom: priceFrom === 'Data pending' ? '—' : priceFrom,
        maxDuration: isImageOnly ? 'Image' : maxDuration.label === 'Data pending' ? '—' : maxDuration.label,
        maxResolution: maxResolution.label === 'Data pending' ? '—' : maxResolution.label,
      },
      statsLabels: {
        duration: isImageOnly ? galleryCopy.stats?.typeShort ?? 'Type' : undefined,
      },
      audioAvailable: Boolean(audioSupported),
      compareDisabled,
      filterMeta: {
        t2v,
        i2v,
        v2v,
        firstLast,
        extend,
        lipSync,
        audio: Boolean(audioSupported),
        maxResolution: maxResolution.value,
        maxDuration: maxDuration.value,
        priceFrom: (() => {
          const cents = getMinPricePerSecond(catalogEntry);
          return typeof cents === 'number' ? cents / 100 : null;
        })(),
      },
    };
  });

  const heroBullets =
    listingCopy.hero?.bullets ?? [
      'Click any model for full specs, prompt presets, and examples.',
      'Compare engines side by side with specs and prompts',
    ];

  const cardBySlug = new Map(modelCards.map((card) => [card.id, card]));
  const quickCompareMicroLabels = listingCopy.quickCompare?.shortcuts ?? [];
  const quickCompareShortcuts = [
    { a: 'sora-2', b: 'veo-3-1', micro: quickCompareMicroLabels[0] ?? 'cinematic vs ad-ready' },
    { a: 'sora-2', b: 'kling-2-6-pro', micro: quickCompareMicroLabels[1] ?? 'cinematic vs control' },
    { a: 'veo-3-1', b: 'kling-2-6-pro', micro: quickCompareMicroLabels[2] ?? 'ads vs motion' },
    { a: 'sora-2', b: 'wan-2-6', micro: quickCompareMicroLabels[3] ?? 'premium vs fast' },
    { a: 'veo-3-1', b: 'wan-2-6', micro: quickCompareMicroLabels[4] ?? 'ads vs budget' },
    { a: 'kling-2-6-pro', b: 'wan-2-6', micro: quickCompareMicroLabels[5] ?? 'motion vs speed' },
  ];

  const outcomeCopy = listingCopy.chooseOutcome?.tiles ?? [];
  const outcomeTiles = [
    {
      title: outcomeCopy[0]?.title ?? 'Cinematic / hero shots',
      description: outcomeCopy[0]?.description ?? 'Character continuity, cinematic physics, premium look.',
      engines: ['sora-2', 'sora-2-pro', 'kling-2-6-pro'],
      icon: Film,
    },
    {
      title: outcomeCopy[1]?.title ?? 'Ads & marketing cuts',
      description: outcomeCopy[1]?.description ?? 'Precise framing, consistent camera moves, fast variants.',
      engines: ['veo-3-1', 'veo-3-1-fast'],
      icon: Clapperboard,
    },
    {
      title: outcomeCopy[2]?.title ?? 'Fast iteration (cheap tests)',
      description: outcomeCopy[2]?.description ?? 'Try lots of versions quickly before you commit.',
      engines: ['wan-2-5', 'minimax-hailuo-02-text', 'pika-text-to-video'],
      icon: Timer,
    },
    {
      title: outcomeCopy[3]?.title ?? 'Stylized / social edits',
      description: outcomeCopy[3]?.description ?? 'Stylized motion, loops, social-first look.',
      engines: ['pika-text-to-video', 'wan-2-6'],
      icon: Sparkles,
    },
    {
      title: outcomeCopy[4]?.title ?? 'High-res / 4K deliverables',
      description: outcomeCopy[4]?.description ?? 'When max resolution matters.',
      engines: ['ltx-2-fast', 'ltx-2'],
      icon: Wand2,
    },
    {
      title: outcomeCopy[5]?.title ?? 'Storyboard & still-first workflows',
      description: outcomeCopy[5]?.description ?? 'Prep frames and references before motion.',
      engines: ['nano-banana', 'nano-banana-pro'],
      icon: Copy,
    },
  ];

  const fallbackFaqItems = [
    {
      question: 'How pricing is calculated',
      answer:
        'We show an estimated $/s for each engine based on current public pricing and our internal normalization. Final cost can vary by provider tier and generation settings.',
    },
    {
      question: 'Why max duration differs per engine',
      answer:
        'Max duration depends on provider limits, tier (fast/pro), and generation mode (text-to-video, image-to-video, extend/continue). We display the latest known limits per engine.',
    },
    {
      question: 'What Compare mode shows (specs + prompts + examples)',
      answer:
        'Compare mode opens a side-by-side page with key specs, strengths, and example renders. When available, it uses the same prompt template so you can judge outputs more fairly.',
    },
    {
      question: 'How to use model pages (full details)',
      answer:
        'Each model page includes full specs, supported modes (T2V/I2V/V2V), and a prompt section you can copy to reproduce results or iterate quickly.',
    },
    {
      question: 'How often data is updated',
      answer:
        'We update model limits and pricing references as providers change their published info and as we test new versions. If something looks off, the model page notes the last refresh.',
    },
  ];
  const faqItems =
    listingCopy.reliability?.faq?.length && listingCopy.reliability.faq.every((item) => item.question && item.answer)
      ? listingCopy.reliability.faq
      : fallbackFaqItems;

  const fallbackReliabilityItems = [
    { title: 'Live pricing', body: 'We track $/s so you see real cost before you generate.' },
    { title: 'Real limits', body: 'Duration, max resolution, formats… shown per engine.' },
    { title: 'Examples you can clone', body: 'Duplicate prompts and settings from real renders.' },
  ];
  const reliabilityItems =
    listingCopy.reliability?.items && listingCopy.reliability.items.length === 3
      ? listingCopy.reliability.items
      : fallbackReliabilityItems;

  const ctaPills = listingCopy.cta?.pills ?? ['Live pricing', 'Clone prompts', 'Compare side-by-side'];

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: modelCards.map((card, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: card.label,
      url: `${SITE_BASE_URL}${modelsPath}/${card.id}`,
    })),
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <main className="container-page max-w-6xl section">
      <div className="stack-gap-lg">
        <header className="stack-gap-sm -mt-2 items-center text-center sm:-mt-4">
          <h1 className="text-3xl font-semibold text-text-primary sm:text-5xl">{heroTitle}</h1>
          <p className="sm:max-w-[62ch] text-base leading-relaxed text-text-secondary">{heroSubhead}</p>
          <ul className="grid gap-2 text-sm text-text-secondary sm:max-w-[62ch]">
            {heroBullets.map((bullet) => (
              <li key={bullet} className="flex items-center justify-center gap-2 text-center">
                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-text-muted" aria-hidden="true" />
                <span className="text-center">{bullet}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col items-center gap-2">
            <ModelsCompareHeroToggle
              label={listingCopy.hero?.compareLabel ?? 'Enter Compare Mode'}
              className="px-7 py-3 text-sm"
            />
          </div>
        </header>

        <section id="models-grid" className="stack-gap-md scroll-mt-24">
          <h2 className="sr-only">
            {listingCopy.grid?.srTitle ?? 'AI video and image models you can compare on MaxVideoAI'}
          </h2>
          <ModelsGallery cards={modelCards} ctaLabel={cardCtaLabel} copy={content.gallery} />
        </section>
        <p className="text-sm text-text-secondary text-center">
          {listingCopy.grid?.bridgeText ??
            'Compare AI video and image engines side-by-side with live pricing, real limits, and examples you can clone.'}
        </p>
        <div className="stack-gap-xl py-4 sm:py-10">
          <section className="rounded-2xl border border-hairline bg-slate-50/60 p-6 shadow-card dark:bg-white/5 sm:p-8">
            <div className="stack-gap-xs">
              <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">
                {listingCopy.quickCompare?.title ?? 'Quick compare shortcuts'}
              </h2>
              <p className="text-sm text-text-secondary">
                {listingCopy.quickCompare?.subtitle ??
                  'Pick a popular matchup to preload Compare mode (or open the comparison page).'}
              </p>
            </div>
            <div className="mt-6 flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:overflow-visible">
              {quickCompareShortcuts.map((shortcut) => {
                const leftCard = cardBySlug.get(shortcut.a);
                const rightCard = cardBySlug.get(shortcut.b);
                const leftLabel = leftCard?.label ?? shortcut.a;
                const rightLabel = rightCard?.label ?? shortcut.b;
                const leftColor = leftCard?.backgroundColor ?? 'var(--text-muted)';
                const rightColor = rightCard?.backgroundColor ?? 'var(--text-muted)';
                const sorted = [shortcut.a, shortcut.b].sort();
                const compareSlug = `${sorted[0]}-vs-${sorted[1]}`;
                return (
                  <Link
                    key={`${shortcut.a}-${shortcut.b}`}
                    href={{ pathname: '/ai-video-engines/[slug]', params: { slug: compareSlug } }}
                    prefetch={false}
                    className="min-w-[220px] rounded-2xl border border-hairline bg-bg/70 px-4 py-3 text-xs font-semibold text-text-primary shadow-sm transition hover:-translate-y-0.5 hover:border-text-muted"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: leftColor }} />
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: rightColor }} />
                      </span>
                      <span className="truncate">
                        {leftLabel} vs {rightLabel}
                      </span>
                    </div>
                    <span className="mt-1 block text-[10px] font-medium text-text-muted">{shortcut.micro}</span>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-hairline bg-slate-50/60 p-6 shadow-card dark:bg-white/5 sm:p-8">
            <div className="stack-gap-xs">
              <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">
                {listingCopy.chooseOutcome?.title ?? 'Choose by outcome'}
              </h2>
              <p className="text-sm text-text-secondary">
                {listingCopy.chooseOutcome?.subtitle ?? 'Start from the result you want — then pick an engine.'}
              </p>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {outcomeTiles.map((tile) => (
                <div
                  key={tile.title}
                  className="rounded-2xl border border-hairline bg-bg/70 p-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-text-primary">
                      <UIIcon icon={tile.icon} size={16} />
                    </span>
                    <h3 className="text-sm font-semibold text-text-primary">{tile.title}</h3>
                  </div>
                  <p className="mt-2 text-sm text-text-secondary">{tile.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tile.engines.map((slug) => {
                      const card = cardBySlug.get(slug);
                      if (!card) return null;
                      const color = card.backgroundColor ?? 'var(--text-muted)';
                      return (
                        <Link
                          key={slug}
                          href={{ pathname: '/models/[slug]', params: { slug } }}
                          prefetch={false}
                          className="inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-micro text-text-primary shadow-sm transition hover:-translate-y-0.5 dark:text-white/90"
                          style={{
                            borderColor: color,
                            backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)`,
                          }}
                        >
                          {card.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-hairline bg-slate-50/60 p-6 shadow-card dark:bg-white/5 sm:p-8">
            <div className="stack-gap-xs">
              <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">
                {listingCopy.reliability?.title ?? 'How MaxVideoAI stays reliable'}
              </h2>
              <p className="text-sm text-text-secondary">
                {listingCopy.reliability?.subtitle ??
                  'The essentials that keep your comparisons consistent and production-ready.'}
              </p>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                { ...reliabilityItems[0], icon: Wallet },
                { ...reliabilityItems[1], icon: Clapperboard },
                { ...reliabilityItems[2], icon: Copy },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-hairline bg-bg/70 p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-text-primary">
                      <UIIcon icon={item.icon} size={16} />
                    </span>
                    <h3 className="text-sm font-semibold text-text-primary">{item.title}</h3>
                  </div>
                  <p className="mt-2 text-sm text-text-secondary">{item.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 grid gap-3">
              {faqItems.map((item) => (
                <details key={item.question} className="rounded-xl border border-hairline bg-bg/70 p-3">
                  <summary className="cursor-pointer">
                    <h3 className="inline text-sm font-semibold text-text-primary">{item.question}</h3>
                  </summary>
                  <p className="mt-2 text-sm text-text-secondary">{item.answer}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/60 p-6 shadow-card dark:border-white/10 dark:bg-white/5 sm:p-8">
            <span className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-purple-400/20 blur-3xl" />
            <span className="pointer-events-none absolute -bottom-16 -right-16 h-64 w-64 rounded-full bg-sky-400/20 blur-3xl" />
            <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-xl">
                <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">
                  {listingCopy.cta?.title ?? 'Start generating in seconds'}
                </h2>
                <p className="mt-2 text-sm text-text-secondary">
                  {listingCopy.cta?.subtitle ??
                    'Pick a model above, then generate — or browse proven prompts and outputs before you commit.'}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-micro text-text-secondary">
                  {ctaPills.map((pill) => (
                    <span
                      key={pill}
                      className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface/80 px-3 py-1"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-text-muted" aria-hidden="true" />
                      {pill}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-xs text-text-muted">
                  {listingCopy.cta?.microcopy ?? 'Same prompt presets • Live pricing • Side-by-side comparisons'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/app"
                  className="inline-flex items-center rounded-full bg-text-primary px-5 py-3 text-xs font-semibold uppercase tracking-micro text-bg transition hover:opacity-90"
                  aria-label="Generate now (opens workspace)"
                >
                  {listingCopy.cta?.primaryLabel ?? 'Generate now'}
                </Link>
                <Link
                  href="/examples"
                  className="inline-flex items-center rounded-full border border-text-primary/40 bg-transparent px-5 py-3 text-xs font-semibold uppercase tracking-micro text-text-primary transition hover:border-text-primary/60"
                  aria-label="Browse examples (opens gallery)"
                >
                  {listingCopy.cta?.secondaryLabel ?? 'Browse examples'}
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
      <Script id="models-breadcrumb-jsonld" type="application/ld+json">
        {JSON.stringify(breadcrumbJsonLd)}
      </Script>
      <Script id="models-itemlist-jsonld" type="application/ld+json">
        {JSON.stringify(itemListJsonLd)}
      </Script>
      <Script id="models-faq-jsonld" type="application/ld+json">
        {JSON.stringify(faqJsonLd)}
      </Script>
    </main>
  );
}
