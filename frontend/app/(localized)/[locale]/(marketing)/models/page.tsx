import type { Metadata } from 'next';
import Script from 'next/script';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { Link } from '@/i18n/navigation';
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
import compareConfig from '@/config/compare-config.json';

const MODELS_SLUG_MAP = buildSlugMap('models');
const DEFAULT_INTRO = {
  paragraphs: [
    'Each engine in this catalog is wired into the MaxVideoAI workspace with monitored latency, price tracking, and fallbacks. We add models as soon as providers open real capacity—not waitlist demos—so you know what can ship to production today.',
    'Pick an engine to see the prompt presets, duration limits, and current route we use to keep renders flowing, then duplicate it into your own workspace.',
  ],
  cards: [
    {
      emoji: '🎬',
      title: 'When to choose Sora',
      body: 'Reach for Sora 2 or Sora 2 Pro when you need cinematic physics, character continuity, or audio baked directly into the render. These tiers cost more per second but deliver hero-quality footage.',
    },
    {
      emoji: '🎯',
      title: 'When to choose Veo',
      body: 'Veo 3 tiers provide precise framing controls and tone presets, plus fast variants for iteration. They are ideal for ad cuts, b-roll, and campaigns that demand consistent camera moves.',
    },
    {
      emoji: '⚡',
      title: 'When to choose Pika or MiniMax',
      body: 'Pika 2.2 excels at stylised loops and social edits, while MiniMax Hailuo 02 keeps budgets low for volume runs. Both complement Sora and Veo when you need fast alternates or lightweight briefs.',
    },
    {
      emoji: '🖼️',
      title: 'When to choose Nano Banana',
      body: 'Storyboard or edit photoreal stills before jumping into motion. Nano Banana shares the same wallet and prompt lab, so you can prep Veo/Sora shots with text-to-image or reference edits.',
    },
  ],
  cta: {
    title: 'Need a side-by-side?',
    before: 'Read the ',
    comparisonLabel: 'Sora vs Veo vs Pika comparison guide',
    middle: ' for detailed quality notes, price ranges, and timing benchmarks, then clone any render from the ',
    examplesLabel: 'examples gallery',
    after: ' to start with a proven prompt.',
  },
} as const;

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

function computeOverall(score?: EngineScore | null) {
  if (!score) return null;
  const values = [score.fidelity, score.motion, score.consistency].filter(
    (value): value is number => typeof value === 'number'
  );
  if (!values.length) return null;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.round(avg * 10) / 10;
}

function deriveStrengths(score?: EngineScore | null) {
  if (!score) return [];
  const entries = SCORE_LABELS.map((entry) => {
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

function capabilityKeywords(capabilities: string[]) {
  const map: Record<string, string> = {
    T2V: 'text-to-video',
    I2V: 'image-to-video',
    V2V: 'video-to-video',
    'Lip sync': 'lip sync',
    Audio: 'native audio',
    'First/Last': 'first/last frame control',
    Extend: 'extend workflows',
  };
  const translated = capabilities.map((cap) => map[cap] ?? cap.toLowerCase());
  if (!translated.length) return 'AI video';
  if (translated.length === 1) return translated[0];
  if (translated.length === 2) return `${translated[0]} and ${translated[1]}`;
  return `${translated.slice(0, -1).join(', ')} and ${translated[translated.length - 1]}`;
}

function buildValueSentence({
  slug,
  strengths,
  capabilities,
  fallback,
}: {
  slug: string;
  strengths: string[];
  capabilities: string[];
  fallback: string;
}) {
  const useCase = USE_CASE_MAP[slug] ?? fallback;
  const cleanedUseCase = sanitizeDescription(useCase);
  const strengthsText = strengths.length ? strengths.join(' and ') : 'reliable outputs';
  const capabilityText = capabilityKeywords(capabilities);
  return `Best for ${cleanedUseCase} with strong ${strengthsText} in ${capabilityText} workflows.`;
}

export async function generateMetadata({ params }: { params: { locale: AppLocale } }): Promise<Metadata> {
  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: 'models.meta' });
  return buildSeoMetadata({
    locale,
    title: t('title'),
    description: t('description'),
    hreflangGroup: 'models',
    slugMap: MODELS_SLUG_MAP,
    imageAlt: 'Model lineup overview with Price-Before chip.',
  });
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
  const heroTitle = 'Compare AI video models with live pricing';
  const heroSubhead =
    content.hero?.subtitle ??
    'Browse Sora, Veo, Kling, Pika, Wan and MiniMax — see real outputs, key limits, and cost per second in one workspace.';
  const HERO_BODY_FALLBACK =
    'Browse every AI video engine available in MaxVideoAI, including Sora 2, Veo 3.1, Pika 2.2, Kling, Luma, Wan and MiniMax Hailuo. Each model page includes real examples, specs, pricing and prompt tips so you can choose the right engine for your shot.';
  const heroBody =
    typeof content.hero?.body === 'string' && content.hero.body.trim().length ? content.hero.body : HERO_BODY_FALLBACK;
  const introContent = content.intro ?? null;
  const introParagraphs =
    Array.isArray(introContent?.paragraphs) && introContent.paragraphs.length
      ? introContent.paragraphs
      : DEFAULT_INTRO.paragraphs;
  const introCards =
    Array.isArray(introContent?.cards) && introContent.cards.length ? introContent.cards : DEFAULT_INTRO.cards;
  const introCta = {
    title: introContent?.cta?.title ?? DEFAULT_INTRO.cta.title,
    before: introContent?.cta?.before ?? DEFAULT_INTRO.cta.before,
    comparisonLabel: introContent?.cta?.comparisonLabel ?? DEFAULT_INTRO.cta.comparisonLabel,
    middle: introContent?.cta?.middle ?? DEFAULT_INTRO.cta.middle,
    examplesLabel: introContent?.cta?.examplesLabel ?? DEFAULT_INTRO.cta.examplesLabel,
    after: introContent?.cta?.after ?? DEFAULT_INTRO.cta.after,
  };
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

  const popularComparisonSlugs = (compareConfig.trophyComparisons as string[] | undefined)?.slice(0, 6) ?? [];
  const popularComparisons = popularComparisonSlugs
    .map((slug) => {
      const parts = slug.split('-vs-');
      if (parts.length !== 2) return null;
      const [leftSlug, rightSlug] = parts;
      const leftName =
        catalogBySlug.get(leftSlug)?.marketingName ??
        engineIndex.get(leftSlug)?.marketingName ??
        engineIndex.get(leftSlug)?.engine.label ??
        leftSlug;
      const rightName =
        catalogBySlug.get(rightSlug)?.marketingName ??
        engineIndex.get(rightSlug)?.marketingName ??
        engineIndex.get(rightSlug)?.engine.label ??
        rightSlug;
      return {
        slug,
        label: `${leftName} vs ${rightName}`,
      };
    })
    .filter((entry): entry is { slug: string; label: string } => Boolean(entry));

  const localizedMap = new Map<string, Awaited<ReturnType<typeof getEngineLocalized>>>(
    await Promise.all(
      engines.map(async (engine) => {
        const localized = await getEngineLocalized(engine.modelSlug, activeLocale);
        return [engine.modelSlug, localized] as const;
      })
    )
  );

  const quickLinkSlugs = [
    'sora-2',
    'sora-2-pro',
    'veo-3-1',
    'veo-3-1-first-last',
    'pika-text-to-video',
    'kling-2-5-turbo',
    'kling-2-6-pro',
    'wan-2-6',
    'wan-2-5',
    'ltx-2-fast',
    'ltx-2',
    'minimax-hailuo-02-text',
    'nano-banana',
    'nano-banana-pro',
  ];
  const quickLinks = quickLinkSlugs
    .map((slug) => engineIndex.get(slug))
    .filter((entry): entry is FalEngineEntry => Boolean(entry));

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
    const strengths = deriveStrengths(scoreEntry);
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
    const lipSync = resolveSupported((keySpecs as Record<string, unknown>).lipSync);
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
        duration: isImageOnly ? 'Type' : undefined,
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

  const heroBullets = [
    'Live $/s, max duration, and max resolution per engine',
    'Real examples + prompt presets you can clone',
    'Use Compare mode, then open a model page for full specs & prompt examples.',
  ];

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
            <ModelsCompareHeroToggle />
            <p className="text-xs text-text-muted">
              See full model details below, or select two engines for a side-by-side comparison.
            </p>
          </div>
        </header>

        <section id="models-grid" className="stack-gap-md scroll-mt-24">
          <ModelsGallery cards={modelCards} ctaLabel={cardCtaLabel} />
        </section>

        <section className="stack-gap-lg rounded-3xl border border-hairline bg-surface/90 p-6 text-sm text-text-secondary shadow-card sm:p-8">
          <div className="stack-gap-sm">
            <h3 className="text-base font-semibold text-text-primary">How MaxVideoAI routes models</h3>
            {introParagraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <p>{heroBody}</p>
          </div>
          {popularComparisons.length ? (
            <div className="rounded-3xl border border-hairline bg-surface/80 p-4 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Popular comparisons</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {popularComparisons.map((entry) => (
                  <Link
                    key={entry.slug}
                    href={{ pathname: '/ai-video-engines/[slug]', params: { slug: entry.slug } }}
                    prefetch={false}
                    className="inline-flex items-center rounded-full border border-hairline px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-secondary transition hover:border-text-muted hover:text-text-primary"
                  >
                    {entry.label}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
          <div className="grid grid-gap-sm lg:grid-cols-3">
            {introCards.map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-hairline bg-gradient-to-br from-bg via-surface to-bg p-5 shadow-card"
              >
                <div className="flex items-center gap-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-lg">
                    {card.emoji ?? '🎬'}
                  </span>
                  <h4 className="text-xs font-semibold uppercase tracking-micro text-text-muted">{card.title}</h4>
                </div>
                <p className="mt-3 text-sm">{card.body}</p>
              </div>
            ))}
          </div>
          <div className="rounded-3xl border border-dashed border-hairline bg-bg/70 p-4">
            <h4 className="text-xs font-semibold uppercase tracking-micro text-text-muted">{introCta.title}</h4>
            <p className="mt-2">
              {introCta.before}
              <Link
                href={{ pathname: '/blog/[slug]', params: { slug: 'compare-ai-video-engines' } }}
                className="font-semibold text-brand hover:text-brandHover"
              >
                {introCta.comparisonLabel}
              </Link>
              {introCta.middle}
              <Link href="/examples" className="font-semibold text-brand hover:text-brandHover">
                {introCta.examplesLabel}
              </Link>
              {introCta.after}
            </p>
          </div>

          {quickLinks.length ? (
            <div className="rounded-3xl border border-hairline bg-surface/80 p-4 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Popular engines</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {quickLinks.map((entry) => (
                  <Link
                    key={entry.modelSlug}
                    href={{ pathname: '/models/[slug]', params: { slug: entry.modelSlug } }}
                    prefetch={false}
                    className="inline-flex items-center rounded-full border border-hairline px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-secondary transition hover:border-text-muted hover:text-text-primary"
                    aria-label={`View ${entry.marketingName ?? entry.engine.label}`}
                  >
                    {entry.marketingName ?? entry.engine.label}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </section>
        {content.note ? (
          <p className="rounded-3xl border border-dashed border-hairline bg-bg/70 px-6 py-4 text-sm text-text-secondary">
            {content.note}
          </p>
        ) : null}
      </div>
      <Script id="models-breadcrumb-jsonld" type="application/ld+json">
        {JSON.stringify(breadcrumbJsonLd)}
      </Script>
    </main>
  );
}
