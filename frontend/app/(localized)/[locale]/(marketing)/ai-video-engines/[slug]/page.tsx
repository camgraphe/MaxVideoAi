import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import clsx from 'clsx';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { localePathnames, locales } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { isDatabaseConfigured } from '@/lib/db';
import { normalizeEngineId } from '@/lib/engine-alias';
import compareConfig from '@/config/compare-config.json';
import { COMPARE_SHOWDOWNS } from '@/config/compare-showdowns';
import engineCatalog from '@/config/engine-catalog.json';
import { ButtonLink } from '@/components/ui/Button';
import { CompareEngineSelector } from './CompareEngineSelector.client';
import { CompareScoreboard } from './CompareScoreboard.client';
import { CopyPromptButton } from './CopyPromptButton.client';
import { getVideosByIds, listExamples, type GalleryVideo } from '@/server/videos';

const SITE_BASE = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? 'https://maxvideoai.com').replace(
  /\/+$/,
  ''
);
const COMPARE_SLUG_MAP = buildSlugMap('compare');
const MODELS_SLUG_MAP = buildSlugMap('models');
const ALLOW_SHOWDOWN_FALLBACK = SITE_BASE.includes('localhost') || SITE_BASE.includes('127.0.0.1');

interface Params {
  locale?: AppLocale;
  slug: string;
}

type EngineCatalogFeature = {
  value?: boolean;
  note?: string;
};

type EngineCatalogEntry = {
  engineId: string;
  modelSlug: string;
  marketingName: string;
  provider: string;
  brandId: string;
  versionLabel?: string;
  availability: string;
  logoPolicy: string;
  engine?: {
    modes?: string[];
    maxDurationSec?: number;
    resolutions?: string[];
    aspectRatios?: string[];
    audio?: boolean;
    extend?: boolean;
    keyframes?: boolean;
    motionControls?: boolean;
    params?: Record<string, unknown>;
    pricingDetails?: {
      perSecondCents?: {
        default?: number;
        byResolution?: Record<string, number>;
      };
    };
    pricing?: {
      base?: number;
      unit?: string;
    };
    avgDurationMs?: number | null;
  };
  modes?: Array<{ mode: string; falModelId?: string }>;
  features?: Record<string, EngineCatalogFeature>;
  bestFor?: string;
};

type EngineScore = {
  engineId?: string;
  modelSlug?: string;
  fidelity?: number;
  visualQuality?: number | null;
  motion?: number;
  anatomy?: number;
  textRendering?: number;
  consistency?: number;
  controllability?: number | null;
  lipsyncQuality?: number;
  sequencingQuality?: number;
  speedStability?: number | null;
  pricing?: number | null;
  last_updated?: string;
};

type EngineScoresFile = {
  version?: string;
  last_updated?: string;
  scores?: EngineScore[];
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

type ShowdownSide = {
  label?: string;
  jobId?: string;
  videoUrl?: string;
  posterUrl?: string;
  placeholder?: boolean;
};

type ShowdownEntry = {
  prompt?: string;
  left: ShowdownSide;
  right: ShowdownSide;
};

const TROPHY_COMPARISONS = compareConfig.trophyComparisons as string[];
const EXCLUDED_ENGINE_SLUGS = new Set(['nano-banana', 'nano-banana-pro']);
const SHOWDOWNS =
  (compareConfig as { showdowns?: Record<string, ShowdownEntry[]> }).showdowns ?? {};
const CATALOG = engineCatalog as EngineCatalogEntry[];
const CATALOG_BY_SLUG = new Map(CATALOG.map((entry) => [entry.modelSlug, entry]));
const ENGINE_OPTIONS = [...CATALOG]
  .filter((entry) => !EXCLUDED_ENGINE_SLUGS.has(entry.modelSlug))
  .map((entry) => ({ value: entry.modelSlug, label: entry.marketingName }))
  .sort((a, b) => a.label.localeCompare(b.label, 'en'));

export const dynamicParams = true;

export async function generateStaticParams(): Promise<Params[]> {
  const params: Params[] = [];
  locales.forEach((locale) => {
    TROPHY_COMPARISONS.forEach((slug) => {
      params.push({ locale, slug });
    });
  });
  return params;
}

function formatEngineName(entry: EngineCatalogEntry): string {
  return entry.marketingName || entry.modelSlug.replace(/-/g, ' ');
}

function formatEngineShortName(entry: EngineCatalogEntry): string {
  const fullName = formatEngineName(entry);
  const words = fullName.split(' ').filter(Boolean);
  if (words.length <= 1) return fullName;
  const providerHint = (entry.provider || entry.brandId || '').toLowerCase();
  if (providerHint && words[0]?.toLowerCase() === providerHint.split(' ')[0]) {
    return words.slice(1).join(' ');
  }
  if (['openai', 'google'].includes(words[0]?.toLowerCase())) {
    return words.slice(1).join(' ');
  }
  return words.slice(1).join(' ');
}

type EngineAccent = {
  barClass: string;
  badgeClass: string;
  buttonClass: string;
  columnTintClass: string;
};

type OverallTone = 'left' | 'right' | 'tie' | 'none';

function getEngineAccent(entry: EngineCatalogEntry): EngineAccent {
  const brand = entry.brandId?.toLowerCase() ?? '';
  if (brand.includes('openai')) {
    return {
      barClass: 'bg-emerald-500',
      badgeClass: 'bg-emerald-500 text-white',
      buttonClass: 'bg-emerald-500 text-white hover:bg-emerald-600',
      columnTintClass: 'bg-emerald-500/5',
    };
  }
  if (brand.includes('google')) {
    return {
      barClass: 'bg-orange-500',
      badgeClass: 'bg-orange-500 text-white',
      buttonClass: 'bg-orange-500 text-white hover:bg-orange-600',
      columnTintClass: 'bg-orange-500/5',
    };
  }
  return {
    barClass: 'bg-brand',
    badgeClass: 'bg-brand text-on-brand',
    buttonClass: 'bg-brand text-on-brand hover:bg-brandHover',
    columnTintClass: 'bg-brand/5',
  };
}

function getEngineButtonStyle(entry: EngineCatalogEntry): CSSProperties | undefined {
  const brandId = entry.brandId?.trim();
  if (!brandId) return undefined;
  return {
    backgroundColor: `var(--engine-${brandId}-bg)`,
    color: `var(--engine-${brandId}-ink)`,
  };
}


function resolveOverallTone(leftValue: number | null, rightValue: number | null): OverallTone {
  if (typeof leftValue !== 'number' || typeof rightValue !== 'number') return 'none';
  if (leftValue === rightValue) return 'tie';
  return leftValue > rightValue ? 'left' : 'right';
}

function resolveEngines(slug: string) {
  const parts = slug.split('-vs-');
  if (parts.length !== 2) return null;
  const [leftSlug, rightSlug] = parts;
  const left = CATALOG_BY_SLUG.get(leftSlug);
  const right = CATALOG_BY_SLUG.get(rightSlug);
  if (!left || !right) return null;
  return { left, right };
}

function getCanonicalCompareSlug(slug: string) {
  const parts = slug.split('-vs-');
  if (parts.length !== 2) return null;
  const [leftSlug, rightSlug] = parts;
  const sorted = [leftSlug, rightSlug].sort();
  return {
    canonicalSlug: `${sorted[0]}-vs-${sorted[1]}`,
    leftSlug,
    rightSlug,
  };
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

async function hydrateShowdowns(entries: ShowdownEntry[]): Promise<ShowdownEntry[]> {
  const jobIds = new Set<string>();
  entries.forEach((entry) => {
    if (entry.left.jobId) jobIds.add(entry.left.jobId);
    if (entry.right.jobId) jobIds.add(entry.right.jobId);
  });
  if (!jobIds.size || !isDatabaseConfigured()) {
    return entries;
  }
  try {
    const videos = await getVideosByIds(Array.from(jobIds));
    return entries.map((entry) => {
      const leftVideo = entry.left.jobId ? videos.get(entry.left.jobId) : null;
      const rightVideo = entry.right.jobId ? videos.get(entry.right.jobId) : null;
      return {
        ...entry,
        left: {
          ...entry.left,
          videoUrl: leftVideo?.videoUrl ?? entry.left.videoUrl,
          posterUrl: leftVideo?.thumbUrl ?? entry.left.posterUrl,
        },
        right: {
          ...entry.right,
          videoUrl: rightVideo?.videoUrl ?? entry.right.videoUrl,
          posterUrl: rightVideo?.thumbUrl ?? entry.right.posterUrl,
        },
      };
    });
  } catch {
    return entries;
  }
}

function pickEngineExamples(examples: GalleryVideo[], engine: EngineCatalogEntry, count = 2): GalleryVideo[] {
  const normalizedSlug = normalizeEngineId(engine.modelSlug) ?? engine.modelSlug;
  const allowedEngineIds = new Set(
    [normalizedSlug, engine.modelSlug, engine.engineId, engine.engine?.id]
      .map((id) => (id ? id.toString().trim().toLowerCase() : ''))
      .filter(Boolean)
  );
  const filtered = examples.filter((video) => {
    const normalized = normalizeEngineId(video.engineId)?.trim().toLowerCase();
    return normalized ? allowedEngineIds.has(normalized) : false;
  });
  const shuffled = [...filtered].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function formatYesNo(value?: boolean) {
  if (value == null) return '-';
  return value ? 'Yes' : 'No';
}

function formatPricePerSecond(entry: EngineCatalogEntry): string {
  const cents = getPricePerSecondCents(entry);
  if (typeof cents === 'number') {
    return `$${(cents / 100).toFixed(2)}/s`;
  }
  return 'Data pending';
}

function getPricePerSecondCents(entry: EngineCatalogEntry): number | null {
  const perSecond = entry.engine?.pricingDetails?.perSecondCents;
  const byResolution = perSecond?.byResolution ? Object.values(perSecond.byResolution) : [];
  const cents = perSecond?.default ?? (byResolution.length ? Math.min(...byResolution) : null);
  if (typeof cents === 'number') {
    return cents;
  }
  const base = entry.engine?.pricing?.base;
  if (typeof base === 'number') {
    return Math.round(base * 100);
  }
  return null;
}

function formatSpeedChip(entry: EngineCatalogEntry) {
  const avg = entry.engine?.avgDurationMs ?? null;
  if (avg == null) return 'Data pending';
  return `${Math.round(avg / 1000)}s avg`;
}

function formatMaxResolution(entry: EngineCatalogEntry) {
  const resolutions = entry.engine?.resolutions ?? [];
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

function formatDuration(entry: EngineCatalogEntry) {
  const max = entry.engine?.maxDurationSec;
  return typeof max === 'number' ? `${max}s max` : 'Data pending';
}

function formatAspectRatios(entry: EngineCatalogEntry) {
  const ratios = entry.engine?.aspectRatios ?? [];
  return ratios.length ? ratios.join(' / ') : 'Data pending';
}

function formatFps(entry: EngineCatalogEntry) {
  const fps = entry.engine?.fps ?? [];
  return fps.length ? fps.join(' / ') : 'Data pending';
}

function formatInputs(entry: EngineCatalogEntry) {
  const modes = entry.engine?.modes ?? [];
  const labels = new Set<string>();
  modes.forEach((mode) => {
    if (mode === 't2v') labels.add('Text');
    if (mode === 'i2v') labels.add('Image');
    if (mode === 'r2v') labels.add('Reference');
  });
  return labels.size ? Array.from(labels).join(' / ') : 'Data pending';
}

function formatControls(entry: EngineCatalogEntry) {
  const params = entry.engine?.params ?? {};
  const controls: string[] = [];
  if ('seed' in params || 'seed_locked' in params || 'seedLock' in params) controls.push('Seed');
  if ('negative_prompt' in params || 'negativePrompt' in params) controls.push('Negative prompt');
  if (entry.engine?.extend) controls.push('Extend');
  if ('inpaint' in params || 'mask' in params) controls.push('Inpaint');
  return controls.length ? controls.join(' / ') : 'Data pending';
}

function resolveStatus(value?: boolean | null) {
  if (value === true) return 'Supported';
  if (value === false) return 'Not supported';
  return 'Data pending';
}

function resolveModeSupported(entry: EngineCatalogEntry, mode: string) {
  const modes = entry.engine?.modes ?? [];
  if (!modes.length) return 'Data pending';
  return modes.includes(mode) ? 'Supported' : 'Not supported';
}

function isPending(value: string) {
  return value.trim().toLowerCase() === 'data pending';
}

function buildSpecValues(entry: EngineCatalogEntry, specs: Record<string, unknown> | undefined) {
  return {
    textToVideo: resolveKeySpecValue(specs, 'textToVideo', resolveModeSupported(entry, 't2v')),
    imageToVideo: resolveKeySpecValue(specs, 'imageToVideo', resolveModeSupported(entry, 'i2v')),
    videoToVideo: resolveKeySpecValue(specs, 'videoToVideo', resolveModeSupported(entry, 'v2v')),
    firstLastFrame: resolveKeySpecValue(specs, 'firstLastFrame', resolveStatus(entry.engine?.keyframes)),
    referenceImageStyle: resolveKeySpecValue(specs, 'referenceImageStyle', resolveModeSupported(entry, 'r2v')),
    referenceVideo: resolveKeySpecValue(specs, 'referenceVideo', 'Data pending'),
    maxResolution: resolveKeySpecValue(specs, 'maxResolution', formatMaxResolution(entry)),
    maxDuration: resolveKeySpecValue(specs, 'maxDuration', formatDuration(entry)),
    aspectRatios: resolveKeySpecValue(specs, 'aspectRatios', formatAspectRatios(entry)),
    fpsOptions: resolveKeySpecValue(specs, 'fpsOptions', formatFps(entry)),
    outputFormats: resolveKeySpecValue(specs, 'outputFormats', 'Data pending'),
    audioOutput: resolveKeySpecValue(specs, 'audioOutput', resolveStatus(entry.engine?.audio)),
    nativeAudioGeneration: resolveKeySpecValue(specs, 'nativeAudioGeneration', resolveStatus(entry.engine?.audio)),
    lipSync: resolveKeySpecValue(specs, 'lipSync', resolveStatus(entry.features?.lipsync?.value)),
    cameraMotionControls: resolveKeySpecValue(
      specs,
      'cameraMotionControls',
      resolveStatus(entry.engine?.motionControls)
    ),
    watermark: 'No (MaxVideoAI)',
  };
}

function parseFirstNumber(value: string) {
  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const num = Number(match[1]);
  return Number.isNaN(num) ? null : num;
}

function parseResolutionValue(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes('4k')) return 2160;
  const matches = normalized.match(/(\d{3,4})/g) ?? [];
  const numbers = matches.map((entry) => Number(entry)).filter((entry) => !Number.isNaN(entry));
  return numbers.length ? Math.max(...numbers) : null;
}

function resolveAudioOffPrice(entry: EngineCatalogEntry): string | null {
  const perSecond = entry.engine?.pricingDetails?.perSecondCents;
  if (!perSecond || typeof perSecond.default !== 'number') return null;
  const audioOffDelta = entry.engine?.pricingDetails?.addons?.audio_off?.perSecondCents;
  if (typeof audioOffDelta !== 'number') return null;
  const total = perSecond.default + audioOffDelta;
  return `Audio off: $${(total / 100).toFixed(2)}/s`;
}

const PRICING_SCORE_MIN = 0.03;
const PRICING_SCORE_MAX = 1.0;

function computePricingScore(prices: number[]): number | null {
  if (!prices.length) return null;
  const avg = prices.reduce((sum, value) => sum + value, 0) / prices.length;
  const normalized =
    10 * (PRICING_SCORE_MAX - avg) / (PRICING_SCORE_MAX - PRICING_SCORE_MIN);
  const clamped = Math.max(0, Math.min(10, normalized));
  return Math.round(clamped * 10) / 10;
}

function parseResolutionLabel(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes('4k')) return 2160;
  const match = normalized.match(/(\d{3,4})/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isNaN(value) ? null : value;
}

function formatPriceLine(label: string | null, cents: number) {
  const value = `$${(cents / 100).toFixed(2)}/s`;
  return label ? `${label}: ${value}` : value;
}

function resolvePricingDisplay(entry: EngineCatalogEntry) {
  const perSecond = entry.engine?.pricingDetails?.perSecondCents;
  const byResolution = perSecond?.byResolution ?? {};
  const resolutionEntries = Object.entries(byResolution)
    .map(([label, cents]) => ({
      label,
      cents: typeof cents === 'number' ? cents : null,
      order: parseResolutionLabel(label),
    }))
    .filter((entry): entry is { label: string; cents: number; order: number | null } => entry.cents != null);
  const distinctValues = Array.from(new Set(resolutionEntries.map((entry) => entry.cents)));

  if (resolutionEntries.length && distinctValues.length > 1) {
    const sorted = [...resolutionEntries].sort((a, b) => {
      const aKey = a.order ?? a.cents;
      const bKey = b.order ?? b.cents;
      return aKey - bKey;
    });
    const minEntry = sorted[0];
    const maxEntry = sorted[sorted.length - 1];
    const headline = formatPriceLine(minEntry.label, minEntry.cents);
    const subline = formatPriceLine(maxEntry.label, maxEntry.cents);
    return {
      headline,
      subline,
      prices: [minEntry.cents / 100, maxEntry.cents / 100],
    };
  }

  const baseCents = getPricePerSecondCents(entry);
  if (typeof baseCents === 'number') {
    const audioOff = resolveAudioOffPrice(entry);
    const audioOffDelta = perSecond?.addons?.audio_off?.perSecondCents;
    const audioOffCents =
      typeof audioOffDelta === 'number' && typeof perSecond?.default === 'number'
        ? perSecond.default + audioOffDelta
        : null;
    const prices = [baseCents / 100];
    if (typeof audioOffCents === 'number') {
      prices.push(audioOffCents / 100);
    }
    return {
      headline: formatPriceLine(null, baseCents),
      subline: audioOff,
      prices,
    };
  }

  return {
    headline: 'Data pending',
    subline: null,
    prices: [],
  };
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

function renderSpecValue(value: string) {
  const normalized = value.toLowerCase();
  if (normalized === 'supported') {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 p-1">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white" aria-hidden>
          ✓
        </span>
      </span>
    );
  }
  if (normalized === 'not supported') {
    return (
      <span className="inline-flex items-center rounded-full border border-rose-500/30 bg-rose-500/10 p-1">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white" aria-hidden>
          ✕
        </span>
      </span>
    );
  }
  return <span>{value}</span>;
}

function computeOverall(score?: EngineScore | null) {
  if (!score) return null;
  const values = [score.fidelity, score.motion, score.consistency].filter(
    (value): value is number => typeof value === 'number'
  );
  if (!values.length) return null;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.round(avg * 10) / 10;
}

function computePairScores(leftValue: number | null, rightValue: number | null, preferLower = false) {
  if (typeof leftValue !== 'number' || typeof rightValue !== 'number') {
    return { leftScore: null, rightScore: null };
  }
  if (leftValue === rightValue) {
    return { leftScore: 7.5, rightScore: 7.5 };
  }
  const min = Math.min(leftValue, rightValue);
  const max = Math.max(leftValue, rightValue);
  const range = max - min || 1;
  const leftRaw = preferLower ? (max - leftValue) / range : (leftValue - min) / range;
  const rightRaw = preferLower ? (max - rightValue) / range : (rightValue - min) / range;
  const leftScore = Math.round(leftRaw * 10 * 10) / 10;
  const rightScore = Math.round(rightRaw * 10 * 10) / 10;
  return { leftScore, rightScore };
}

function renderShowdownMedia(side: ShowdownSide, fallbackLabel: string) {
  const label = side.label ?? fallbackLabel;
  return (
    <div className="stack-gap-sm">
      <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{label}</p>
      <div className="relative aspect-video overflow-hidden rounded-card border border-hairline bg-placeholder">
        {side.videoUrl ? (
          <video
            className="h-full w-full object-cover"
            controls
            preload="none"
            poster={side.posterUrl}
            playsInline
          >
            <source src={side.videoUrl} />
          </video>
        ) : side.posterUrl ? (
          <img
            src={side.posterUrl}
            alt={`${label} showdown frame`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-text-muted">
            No preview
          </div>
        )}
      </div>
    </div>
  );
}

function buildGenerateHref(engineSlug: string, prompt: string, aspectRatio: string, mode: string) {
  const params = new URLSearchParams({
    engine: engineSlug,
    prompt,
    ar: aspectRatio,
    mode,
  });
  return `/app?${params.toString()}`;
}

function pickCapabilityDifference(
  left: EngineCatalogEntry,
  right: EngineCatalogEntry,
  label: string,
  leftStatus: string,
  rightStatus: string
): string {
  const leftNormalized = leftStatus.toLowerCase();
  const rightNormalized = rightStatus.toLowerCase();
  const leftPending = leftNormalized.includes('pending') || leftNormalized.includes('validated');
  const rightPending = rightNormalized.includes('pending') || rightNormalized.includes('validated');
  if (!leftPending && !rightPending && leftStatus !== rightStatus) {
    return `${label}: ${formatEngineName(left)} is ${leftStatus.toLowerCase()} vs ${formatEngineName(right)} is ${rightStatus.toLowerCase()}.`;
  }
  return `${label}: both are ${leftStatus === rightStatus ? leftStatus.toLowerCase() : 'still being validated'}.`;
}

function pickOutputDifference(
  leftLabel: string,
  rightLabel: string,
  leftValue: string,
  rightValue: string,
  label: string
): string {
  const leftPending = leftValue.toLowerCase().includes('pending') || leftValue.toLowerCase().includes('validated');
  const rightPending = rightValue.toLowerCase().includes('pending') || rightValue.toLowerCase().includes('validated');
  if (!leftPending && !rightPending && leftValue !== rightValue) {
    return `${label}: ${leftLabel} is ${leftValue} vs ${rightLabel} is ${rightValue}.`;
  }
  return `${label}: data is still being validated for one or both engines.`;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const locale = params.locale ?? 'en';
  const slug = params.slug;
  const canonicalInfo = getCanonicalCompareSlug(slug);
  const resolved = canonicalInfo ? resolveEngines(canonicalInfo.canonicalSlug) : null;
  const title = resolved
    ? `${formatEngineName(resolved.left)} vs ${formatEngineName(resolved.right)}: specs, pricing & prompt test`
    : 'Compare AI video engines: specs, pricing & prompt test';
  const description = resolved
    ? `Compare ${formatEngineName(resolved.left)} vs ${formatEngineName(resolved.right)} on MaxVideoAI with identical prompts, key specs, and a scorecard across 11 criteria.`
    : 'Side-by-side comparison of AI video engines with MaxVideoAI metrics and guidance.';

  let robots: Metadata['robots'] | undefined;
  if (resolved) {
    const keySpecs = await loadEngineKeySpecs();
    const leftKeySpecs = keySpecs.get(resolved.left.modelSlug)?.keySpecs ?? undefined;
    const rightKeySpecs = keySpecs.get(resolved.right.modelSlug)?.keySpecs ?? undefined;
    const leftSpecs = buildSpecValues(resolved.left, leftKeySpecs);
    const rightSpecs = buildSpecValues(resolved.right, rightKeySpecs);
    const rows = [
      leftSpecs.textToVideo,
      rightSpecs.textToVideo,
      leftSpecs.imageToVideo,
      rightSpecs.imageToVideo,
      leftSpecs.videoToVideo,
      rightSpecs.videoToVideo,
      leftSpecs.firstLastFrame,
      rightSpecs.firstLastFrame,
      leftSpecs.referenceImageStyle,
      rightSpecs.referenceImageStyle,
      leftSpecs.referenceVideo,
      rightSpecs.referenceVideo,
      leftSpecs.maxResolution,
      rightSpecs.maxResolution,
      leftSpecs.maxDuration,
      rightSpecs.maxDuration,
      leftSpecs.aspectRatios,
      rightSpecs.aspectRatios,
      leftSpecs.fpsOptions,
      rightSpecs.fpsOptions,
      leftSpecs.outputFormats,
      rightSpecs.outputFormats,
    ];
    const pendingCount = rows.filter((value) => isPending(value)).length;
    const pendingRatio = rows.length ? pendingCount / rows.length : 0;
    if (pendingRatio >= 0.35) {
      robots = { index: false, follow: true };
    }
  }

  const canonicalSlug = canonicalInfo?.canonicalSlug ?? slug;
  return buildSeoMetadata({
    locale,
    title,
    description,
    englishPath: `/ai-video-engines/${canonicalSlug}`,
    robots,
  });
}

export default async function CompareDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams?: { order?: string };
}) {
  const slug = params.slug;
  const canonicalInfo = getCanonicalCompareSlug(slug);
  if (!canonicalInfo) {
    notFound();
  }
  const resolved = resolveEngines(slug);
  if (!resolved) {
    notFound();
  }
  const locale = params.locale ?? 'en';
  const localePrefix = localePathnames[locale] ? `/${localePathnames[locale]}` : '';
  const modelsBase = MODELS_SLUG_MAP[locale] ?? MODELS_SLUG_MAP.en ?? 'models';
  const modelsHref = `${localePrefix}/${modelsBase}`.replace(/\/{2,}/g, '/');
  const canonicalSlug = canonicalInfo.canonicalSlug;
  if (canonicalSlug !== slug) {
    const compareBase = COMPARE_SLUG_MAP[locale] ?? COMPARE_SLUG_MAP.en ?? 'ai-video-engines';
    const query = canonicalInfo.leftSlug ? `?order=${canonicalInfo.leftSlug}` : '';
    redirect(`${localePrefix}/${compareBase}/${canonicalSlug}${query}`.replace(/\/{2,}/g, '/'));
  }
  let { left, right } = resolved;
  const requestedOrder = typeof searchParams?.order === 'string' ? searchParams.order : null;
  if (requestedOrder && requestedOrder === right.modelSlug) {
    [left, right] = [right, left];
  }
  const scores = await loadEngineScores();
  const keySpecs = await loadEngineKeySpecs();
  const leftScore = scores.get(left.modelSlug) ?? scores.get(left.engineId) ?? null;
  const rightScore = scores.get(right.modelSlug) ?? scores.get(right.engineId) ?? null;
  const leftKeySpecs =
    keySpecs.get(left.modelSlug)?.keySpecs ?? keySpecs.get(left.engineId)?.keySpecs ?? undefined;
  const rightKeySpecs =
    keySpecs.get(right.modelSlug)?.keySpecs ?? keySpecs.get(right.engineId)?.keySpecs ?? undefined;
  const leftSpecs = buildSpecValues(left, leftKeySpecs);
  const rightSpecs = buildSpecValues(right, rightKeySpecs);
  const leftPricingDisplay = resolvePricingDisplay(left);
  const rightPricingDisplay = resolvePricingDisplay(right);
  const leftOverall = computeOverall(leftScore);
  const rightOverall = computeOverall(rightScore);
  const updatedAt = leftScore?.last_updated ?? rightScore?.last_updated ?? null;
  const overallTone = resolveOverallTone(leftOverall, rightOverall);
  const leftOverallClass =
    overallTone === 'left'
      ? 'bg-emerald-500 text-white'
      : overallTone === 'right'
        ? 'bg-orange-500 text-white'
        : 'bg-surface-2 text-text-primary';
  const rightOverallClass =
    overallTone === 'right'
      ? 'bg-emerald-500 text-white'
      : overallTone === 'left'
        ? 'bg-orange-500 text-white'
        : 'bg-surface-2 text-text-primary';
  const showdowns = await hydrateShowdowns(SHOWDOWNS[canonicalSlug] ?? []);
  const hasMedia = (side: ShowdownSide) => Boolean(side.videoUrl || side.posterUrl);
  let exampleVideos: GalleryVideo[] = [];
  if (ALLOW_SHOWDOWN_FALLBACK) {
    try {
      exampleVideos = await listExamples('date-desc', 80);
    } catch {
      exampleVideos = [];
    }
  }
  const leftExamplePool = ALLOW_SHOWDOWN_FALLBACK ? pickEngineExamples(exampleVideos, left, 3) : [];
  const rightExamplePool = ALLOW_SHOWDOWN_FALLBACK ? pickEngineExamples(exampleVideos, right, 3) : [];

  const showdownSlots = COMPARE_SHOWDOWNS.map((template, index) => {
    const entry = showdowns[index];
    const fallbackLeft = leftExamplePool[index % Math.max(leftExamplePool.length, 1)];
    const fallbackRight = rightExamplePool[index % Math.max(rightExamplePool.length, 1)];
    const leftSide = {
      label: formatEngineName(left),
      ...(entry?.left ?? {}),
      videoUrl: entry?.left?.videoUrl ?? fallbackLeft?.videoUrl,
      posterUrl: entry?.left?.posterUrl ?? fallbackLeft?.thumbUrl,
      placeholder: ALLOW_SHOWDOWN_FALLBACK && !entry?.left?.videoUrl && !entry?.left?.posterUrl,
    };
    const rightSide = {
      label: formatEngineName(right),
      ...(entry?.right ?? {}),
      videoUrl: entry?.right?.videoUrl ?? fallbackRight?.videoUrl,
      posterUrl: entry?.right?.posterUrl ?? fallbackRight?.thumbUrl,
      placeholder: ALLOW_SHOWDOWN_FALLBACK && !entry?.right?.videoUrl && !entry?.right?.posterUrl,
    };
    if (!ALLOW_SHOWDOWN_FALLBACK && (!hasMedia(leftSide) || !hasMedia(rightSide))) return null;
    return {
      ...template,
      prompt: entry?.prompt ?? template.prompt,
      left: leftSide,
      right: rightSide,
    };
  }).filter((entry): entry is typeof COMPARE_SHOWDOWNS[number] & { left: ShowdownSide; right: ShowdownSide } => Boolean(entry));
  const leftAccent = getEngineAccent(left);
  const rightAccent = getEngineAccent(right);
  const leftButtonStyle = getEngineButtonStyle(left);
  const rightButtonStyle = getEngineButtonStyle(right);
  const priceScores = {
    leftScore: computePricingScore(leftPricingDisplay.prices),
    rightScore: computePricingScore(rightPricingDisplay.prices),
  };
  const speedScores = computePairScores(left.engine?.avgDurationMs ?? null, right.engine?.avgDurationMs ?? null, true);
  const resolvedLeftOptions = ENGINE_OPTIONS;
  const resolvedRightOptions = ENGINE_OPTIONS;
  const specRows = [
    {
      label: 'Pricing (MaxVideoAI)',
      left: leftPricingDisplay.headline,
      right: rightPricingDisplay.headline,
      subline: leftPricingDisplay.subline,
      rightSubline: rightPricingDisplay.subline,
    },
    { label: 'Text-to-Video', left: leftSpecs.textToVideo, right: rightSpecs.textToVideo },
    { label: 'Image-to-Video', left: leftSpecs.imageToVideo, right: rightSpecs.imageToVideo },
    { label: 'Video-to-Video', left: leftSpecs.videoToVideo, right: rightSpecs.videoToVideo },
    { label: 'First/Last frame', left: leftSpecs.firstLastFrame, right: rightSpecs.firstLastFrame },
    {
      label: 'Reference image / style reference',
      left: leftSpecs.referenceImageStyle,
      right: rightSpecs.referenceImageStyle,
    },
    { label: 'Reference video', left: leftSpecs.referenceVideo, right: rightSpecs.referenceVideo },
    { label: 'Max resolution', left: leftSpecs.maxResolution, right: rightSpecs.maxResolution },
    { label: 'Max duration', left: leftSpecs.maxDuration, right: rightSpecs.maxDuration },
    { label: 'Aspect ratios', left: leftSpecs.aspectRatios, right: rightSpecs.aspectRatios },
    { label: 'FPS options', left: leftSpecs.fpsOptions, right: rightSpecs.fpsOptions },
    { label: 'Output format', left: leftSpecs.outputFormats, right: rightSpecs.outputFormats },
    { label: 'Audio output', left: leftSpecs.audioOutput, right: rightSpecs.audioOutput },
    {
      label: 'Native audio generation',
      left: leftSpecs.nativeAudioGeneration,
      right: rightSpecs.nativeAudioGeneration,
    },
    { label: 'Lip sync', left: leftSpecs.lipSync, right: rightSpecs.lipSync },
    {
      label: 'Camera / motion controls',
      left: leftSpecs.cameraMotionControls,
      right: rightSpecs.cameraMotionControls,
    },
    { label: 'Watermark', left: leftSpecs.watermark, right: rightSpecs.watermark },
  ].filter((row) => !(isPending(row.left) && isPending(row.right)));

  const formatFaqValue = (value: string) => (isPending(value) ? 'still being validated' : value);
  const faqPricingLeft = formatFaqValue(leftPricingDisplay.headline);
  const faqPricingRight = formatFaqValue(rightPricingDisplay.headline);
  const faqT2vLeft = formatFaqValue(leftSpecs.textToVideo);
  const faqT2vRight = formatFaqValue(rightSpecs.textToVideo);
  const faqI2vLeft = formatFaqValue(leftSpecs.imageToVideo);
  const faqI2vRight = formatFaqValue(rightSpecs.imageToVideo);
  const faqV2vLeft = formatFaqValue(leftSpecs.videoToVideo);
  const faqV2vRight = formatFaqValue(rightSpecs.videoToVideo);
  const faqFirstLastLeft = formatFaqValue(leftSpecs.firstLastFrame);
  const faqFirstLastRight = formatFaqValue(rightSpecs.firstLastFrame);
  const faqRefImgLeft = formatFaqValue(leftSpecs.referenceImageStyle);
  const faqRefImgRight = formatFaqValue(rightSpecs.referenceImageStyle);
  const faqRefVidLeft = formatFaqValue(leftSpecs.referenceVideo);
  const faqRefVidRight = formatFaqValue(rightSpecs.referenceVideo);
  const faqResLeft = formatFaqValue(leftSpecs.maxResolution);
  const faqResRight = formatFaqValue(rightSpecs.maxResolution);
  const faqDurLeft = formatFaqValue(leftSpecs.maxDuration);
  const faqDurRight = formatFaqValue(rightSpecs.maxDuration);
  const faqArLeft = formatFaqValue(leftSpecs.aspectRatios);
  const faqArRight = formatFaqValue(rightSpecs.aspectRatios);
  const faqAudioOutLeft = formatFaqValue(leftSpecs.audioOutput);
  const faqAudioOutRight = formatFaqValue(rightSpecs.audioOutput);
  const faqAudioGenLeft = formatFaqValue(leftSpecs.nativeAudioGeneration);
  const faqAudioGenRight = formatFaqValue(rightSpecs.nativeAudioGeneration);
  const faqLipLeft = formatFaqValue(leftSpecs.lipSync);
  const faqLipRight = formatFaqValue(rightSpecs.lipSync);
  const faqPricingDiff = `Pricing: ${formatEngineName(left)} starts at ${faqPricingLeft} vs ${formatEngineName(right)} starts at ${faqPricingRight}.`;
  const faqCapabilityDiff = pickCapabilityDifference(
    left,
    right,
    'Capability',
    faqV2vLeft,
    faqV2vRight
  );
  const faqOutputDiff = pickOutputDifference(
    formatEngineName(left),
    formatEngineName(right),
    faqResLeft,
    faqResRight,
    'Max resolution'
  );

  const faqItems = [
    {
      question: `What are ${formatEngineName(left)} and ${formatEngineName(right)}?`,
      answer:
        `${formatEngineName(left)} and ${formatEngineName(right)} are AI video generation engines available on MaxVideoAI. ` +
        'This page compares them side-by-side using the same prompts, key specs, and performance data shown above.',
    },
    {
      question: `Which is better: ${formatEngineName(left)} or ${formatEngineName(right)}?`,
      answer:
        'It depends on your workflow. Use the scorecard and the “same prompt” showdowns to compare prompt adherence, motion realism, human fidelity, and text legibility — then open each engine profile for full details.',
    },
    {
      question: 'Which is cheaper on MaxVideoAI?',
      answer:
        `Pricing varies by mode and preset. Currently, ${formatEngineName(left)} starts at ${faqPricingLeft} and ` +
        `${formatEngineName(right)} starts at ${faqPricingRight} (see “Pricing (MaxVideoAI)” for details).`,
    },
    {
      question: `What are the biggest differences between ${formatEngineName(left)} and ${formatEngineName(right)}?`,
      answer: [faqPricingDiff, faqCapabilityDiff, faqOutputDiff],
    },
    {
      question: 'Do they support Text-to-Video / Image-to-Video / Video-to-Video?',
      answer:
        `On MaxVideoAI: Text-to-Video is ${faqT2vLeft} vs ${faqT2vRight}; Image-to-Video is ${faqI2vLeft} vs ${faqI2vRight}; ` +
        `Video-to-Video is ${faqV2vLeft} vs ${faqV2vRight}. Some fields may still be under validation.`,
    },
    {
      question: 'Do they support First/Last frame or references?',
      answer:
        `First/Last frame is ${faqFirstLastLeft} vs ${faqFirstLastRight}. Reference image/style is ${faqRefImgLeft} vs ${faqRefImgRight}; ` +
        `Reference video is ${faqRefVidLeft} vs ${faqRefVidRight}.`,
    },
    {
      question: 'What are the max resolution, duration, and aspect ratios?',
      answer:
        `Max output is ${faqResLeft} / ${faqDurLeft} for ${formatEngineName(left)} and ${faqResRight} / ${faqDurRight} for ` +
        `${formatEngineName(right)}. Supported aspect ratios include ${faqArLeft} vs ${faqArRight} (see Key Specs for the full list).`,
    },
    {
      question: 'Do they support audio generation and lip sync?',
      answer:
        `Audio output is ${faqAudioOutLeft} vs ${faqAudioOutRight}. Native audio generation is ${faqAudioGenLeft} vs ${faqAudioGenRight}, ` +
        `and lip sync is ${faqLipLeft} vs ${faqLipRight} (some fields may still be under validation).`,
    },
    {
      question: 'Does MaxVideoAI add a watermark?',
      answer: 'No. MaxVideoAI exports are watermark-free (“Watermark: No (MaxVideoAI)”).',
    },
    {
      question: 'Why do results look different with the same prompt?',
      answer:
        'Even with identical prompts, models interpret instructions differently and use different training data and generation strategies. ' +
        'That’s why the Showdown section exists: same prompt, side-by-side outputs.',
    },
    {
      question: 'Where can I find full specs, controls, and more prompt examples?',
      answer:
        `Open the full engine profiles for complete specs, controls, and more prompts: /models/${left.modelSlug} and /models/${right.modelSlug}. ` +
        'You can also browse more outputs in the engine galleries.',
    },
  ];

  const faqJsonLdItems = faqItems.filter((item) => {
    const text = Array.isArray(item.answer) ? item.answer.join(' ') : item.answer;
    return !text.toLowerCase().includes('data pending');
  });

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqJsonLdItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: Array.isArray(item.answer) ? item.answer.join(' ') : item.answer,
      },
    })),
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Comparisons', item: `${SITE_BASE}/ai-video-engines` },
      {
        '@type': 'ListItem',
        position: 2,
        name: `${formatEngineName(left)} vs ${formatEngineName(right)}`,
        item: `${SITE_BASE}/ai-video-engines/${canonicalSlug}`,
      },
    ],
  };

  const webPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${formatEngineName(left)} vs ${formatEngineName(right)}: specs, pricing & prompt test`,
    url: `${SITE_BASE}/ai-video-engines/${canonicalSlug}`,
    description: `Compare ${formatEngineName(left)} vs ${formatEngineName(right)} with the same prompts, key specs, and a scorecard across 11 criteria on MaxVideoAI.`,
  };

  const comparisonMetrics = [
    {
      id: 'prompt_adherence',
      label: 'Prompt Adherence',
      tooltip: 'prompt alignment / instruction following',
      leftValue: leftScore?.fidelity ?? null,
      rightValue: rightScore?.fidelity ?? null,
    },
    {
      id: 'visual_quality',
      label: 'Visual Quality',
      tooltip: 'image quality / aesthetic quality / realism / artifacts / flicker',
      leftValue: leftScore?.visualQuality ?? null,
      rightValue: rightScore?.visualQuality ?? null,
    },
    {
      id: 'motion_realism',
      label: 'Motion Realism',
      tooltip: 'motion smoothness / physics plausibility',
      leftValue: leftScore?.motion ?? null,
      rightValue: rightScore?.motion ?? null,
    },
    {
      id: 'temporal_consistency',
      label: 'Temporal Consistency',
      tooltip: 'temporal coherence / identity consistency',
      leftValue: leftScore?.consistency ?? null,
      rightValue: rightScore?.consistency ?? null,
    },
    {
      id: 'human_fidelity',
      label: 'Human Fidelity',
      tooltip: 'faces / hands / body realism',
      leftValue: leftScore?.anatomy ?? null,
      rightValue: rightScore?.anatomy ?? null,
    },
    {
      id: 'text_ui_legibility',
      label: 'Text & UI Legibility',
      tooltip: 'text rendering / readability',
      leftValue: leftScore?.textRendering ?? null,
      rightValue: rightScore?.textRendering ?? null,
    },
    {
      id: 'audio_lip_sync',
      label: 'Audio & Lip Sync',
      tooltip: 'lip sync quality / dialogue sync',
      leftValue: leftScore?.lipsyncQuality ?? null,
      rightValue: rightScore?.lipsyncQuality ?? null,
    },
    {
      id: 'multi_shot_sequencing',
      label: 'Multi-Shot Sequencing',
      tooltip: 'shot-to-shot continuity / multi-shot',
      leftValue: leftScore?.sequencingQuality ?? null,
      rightValue: rightScore?.sequencingQuality ?? null,
    },
    {
      id: 'controllability',
      label: 'Controllability',
      tooltip: 'camera control / constraint following',
      leftValue: leftScore?.controllability ?? null,
      rightValue: rightScore?.controllability ?? null,
    },
    {
      id: 'speed_stability',
      label: 'Speed & Stability',
      tooltip: 'latency / success rate',
      leftValue: leftScore?.speedStability ?? speedScores.leftScore,
      rightValue: rightScore?.speedStability ?? speedScores.rightScore,
    },
    {
      id: 'pricing',
      label: 'Pricing',
      tooltip: 'price per second / credits / estimated cost',
      leftValue: priceScores.leftScore,
      rightValue: priceScores.rightScore,
    },
  ];

  const scoredMetrics = comparisonMetrics
    .filter((metric) => typeof metric.leftValue === 'number' && typeof metric.rightValue === 'number')
    .map((metric) => {
      const leftValue = metric.leftValue as number;
      const rightValue = metric.rightValue as number;
      const winner = leftValue === rightValue ? 'tie' : leftValue > rightValue ? 'left' : 'right';
      return {
        label: metric.label,
        leftValue,
        rightValue,
        winner,
        delta: Math.abs(leftValue - rightValue),
      };
    });
  const leftWins = scoredMetrics.filter((metric) => metric.winner === 'left').length;
  const rightWins = scoredMetrics.filter((metric) => metric.winner === 'right').length;
  const totalScored = scoredMetrics.length;
  const scoreLeader = leftWins === rightWins ? null : leftWins > rightWins ? 'left' : 'right';
  const topWinner = scoreLeader === 'left' ? left : scoreLeader === 'right' ? right : null;
  const topDeltas = scoredMetrics
    .filter((metric) => metric.winner === scoreLeader)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 2)
    .map((metric) => metric.label);

  const pricingWinner =
    typeof priceScores.leftScore === 'number' && typeof priceScores.rightScore === 'number'
      ? priceScores.leftScore === priceScores.rightScore
        ? null
        : priceScores.leftScore > priceScores.rightScore
          ? 'left'
          : 'right'
      : null;

  const deriveStrengths = (side: 'left' | 'right') =>
    comparisonMetrics
      .filter((metric) => typeof metric.leftValue === 'number' && typeof metric.rightValue === 'number')
      .map((metric) => {
        const leftValue = metric.leftValue as number;
        const rightValue = metric.rightValue as number;
        if (side === 'left' && leftValue > rightValue) {
          return { label: metric.label, delta: Math.abs(leftValue - rightValue) };
        }
        if (side === 'right' && rightValue > leftValue) {
          return { label: metric.label, delta: Math.abs(leftValue - rightValue) };
        }
        return null;
      })
      .filter((entry): entry is { label: string; delta: number } => Boolean(entry))
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 2)
      .map((entry) => entry.label);

  const durationLeft = parseFirstNumber(leftSpecs.maxDuration);
  const durationRight = parseFirstNumber(rightSpecs.maxDuration);
  const durationWinner =
    typeof durationLeft === 'number' && typeof durationRight === 'number'
      ? durationLeft === durationRight
        ? null
        : durationLeft > durationRight
          ? 'left'
          : 'right'
      : null;
  const durationSummary = `${formatFaqValue(leftSpecs.maxDuration)} vs ${formatFaqValue(rightSpecs.maxDuration)}`;
  const pricingSummary = `${leftPricingDisplay.headline} vs ${rightPricingDisplay.headline}`;
  const specWinnerRow = (() => {
    const valueForSupport = (label: string, leftValue: string, rightValue: string) => {
      const leftIsSupported = leftValue.toLowerCase() === 'supported';
      const rightIsSupported = rightValue.toLowerCase() === 'supported';
      if (leftIsSupported === rightIsSupported) return null;
      const winner = leftIsSupported ? 'left' : 'right';
      return {
        id: 'spec',
        icon: 'spec',
        label,
        value: `${label}: ${formatEngineName(winner === 'left' ? left : right)} (${leftValue} vs ${rightValue}).`,
        accent: winner as OverallTone,
      };
    };
    if (!isPending(leftSpecs.videoToVideo) && !isPending(rightSpecs.videoToVideo)) {
      const row = valueForSupport('Video-to-Video', leftSpecs.videoToVideo, rightSpecs.videoToVideo);
      if (row) return row;
    }
    if (!isPending(leftSpecs.firstLastFrame) && !isPending(rightSpecs.firstLastFrame)) {
      const row = valueForSupport('First/Last frame', leftSpecs.firstLastFrame, rightSpecs.firstLastFrame);
      if (row) return row;
    }
    const leftRes = parseResolutionValue(leftSpecs.maxResolution);
    const rightRes = parseResolutionValue(rightSpecs.maxResolution);
    if (leftRes && rightRes && leftRes !== rightRes) {
      const winner = leftRes > rightRes ? 'left' : 'right';
      return {
        id: 'spec',
        icon: 'spec',
        label: 'Max resolution',
        value: `Max resolution: ${formatEngineName(winner === 'left' ? left : right)} (${leftSpecs.maxResolution} vs ${rightSpecs.maxResolution}).`,
        accent: winner as OverallTone,
      };
    }
    if (durationWinner) {
      return {
        id: 'duration',
        icon: 'duration',
        label: 'Max duration',
        value: `Max duration: ${formatEngineName(durationWinner === 'left' ? left : right)} (${durationSummary}).`,
        accent: durationWinner,
      };
    }
    return null;
  })();
  const winnerSummaryRows: Array<{ id: string; icon: string; label: string; value: string; accent: OverallTone | null }> = [];
  if (scoreLeader && topWinner) {
    winnerSummaryRows.push({
      id: 'scorecard',
      icon: 'scorecard',
      label: 'Scorecard winner',
      value: `Scorecard winner: ${formatEngineName(topWinner)} leads on ${scoreLeader === 'left' ? leftWins : rightWins}/${totalScored}${
        topDeltas.length ? ` (best: ${topDeltas.join(', ')})` : ''
      }.`,
      accent: scoreLeader,
    });
  }
  if (pricingWinner) {
    winnerSummaryRows.push({
      id: 'pricing',
      icon: 'pricing',
      label: 'Pricing',
      value: `Cheaper: ${formatEngineName(pricingWinner === 'left' ? left : right)} (${pricingSummary}).`,
      accent: pricingWinner,
    });
  }
  if (specWinnerRow) {
    winnerSummaryRows.push(specWinnerRow);
  } else if (durationWinner) {
    winnerSummaryRows.push({
      id: 'duration',
      icon: 'duration',
      label: 'Max duration',
      value: `Max duration: ${formatEngineName(durationWinner === 'left' ? left : right)} (${durationSummary}).`,
      accent: durationWinner,
    });
  }
  const summaryRows = winnerSummaryRows.slice(0, 3);
  const resolveAccentDot = (accent: OverallTone | null) => {
    if (accent === 'left') return leftAccent.barClass;
    if (accent === 'right') return rightAccent.barClass;
    return 'bg-neutral-300';
  };
  const summaryIcons: Record<string, JSX.Element> = {
    scorecard: (
      <svg viewBox="0 0 20 20" className="h-4 w-4 text-text-muted" aria-hidden>
        <path
          fill="currentColor"
          d="M6.5 2.5h7a1 1 0 0 1 1 1V6a4 4 0 0 1-3 3.87V12h1.5a1 1 0 1 1 0 2h-7a1 1 0 1 1 0-2H7V9.87A4 4 0 0 1 4 6V3.5a1 1 0 0 1 1-1Zm1 2V6a2.5 2.5 0 1 0 5 0V4.5h-5Z"
        />
      </svg>
    ),
    pricing: (
      <svg viewBox="0 0 20 20" className="h-4 w-4 text-text-muted" aria-hidden>
        <path
          fill="currentColor"
          d="M10 2.5c-3.59 0-6.5 2.69-6.5 6 0 3.87 3.57 6.48 6.5 9 2.93-2.52 6.5-5.13 6.5-9 0-3.31-2.91-6-6.5-6Zm.75 3.25a.75.75 0 1 0-1.5 0v.65h-.5a1.5 1.5 0 1 0 0 3h1.25a.5.5 0 1 1 0 1H8.5a.75.75 0 1 0 0 1.5h.75v.6a.75.75 0 1 0 1.5 0v-.6h.5a1.5 1.5 0 1 0 0-3H9.5a.5.5 0 1 1 0-1h1.25a.75.75 0 1 0 0-1.5h-.5v-.65Z"
        />
      </svg>
    ),
    spec: (
      <svg viewBox="0 0 20 20" className="h-4 w-4 text-text-muted" aria-hidden>
        <path
          fill="currentColor"
          d="M4 5.5A1.5 1.5 0 0 1 5.5 4h9A1.5 1.5 0 0 1 16 5.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 14.5v-9Zm2 1a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2H6Zm0 4a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H6Zm0 4a1 1 0 1 0 0 2h3a1 1 0 1 0 0-2H6Z"
        />
      </svg>
    ),
    duration: (
      <svg viewBox="0 0 20 20" className="h-4 w-4 text-text-muted" aria-hidden>
        <path
          fill="currentColor"
          d="M10 3.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Zm0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm.75 1.75a.75.75 0 0 0-1.5 0v3.1c0 .27.15.52.4.65l2.2 1.2a.75.75 0 1 0 .72-1.32l-1.82-1V7.25Z"
        />
      </svg>
    ),
  };

  return (
    <div className="container-page max-w-6xl section">
      <div className="stack-gap-xl">
        <div className="text-sm text-text-muted">
          <Link href={modelsHref} className="font-semibold text-brand hover:text-brandHover">
            ← Back to models
          </Link>
        </div>
        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Compare engines</p>
          <h1 className="mt-2 text-3xl font-semibold text-text-primary sm:text-5xl">
            {formatEngineName(left)} vs {formatEngineName(right)}
          </h1>
          <p className="mt-4 text-sm text-text-secondary">
            This page compares {formatEngineName(left)} vs {formatEngineName(right)} on MaxVideoAI using the same
            prompts, side-by-side renders, key specs, and a scorecard across 11 criteria. Use it to pick a winner fast
            — then open each engine profile for full specs and prompt examples.
          </p>
        </header>

        <section className="relative overflow-hidden rounded-[36px] border border-hairline bg-surface shadow-card">
          <div className="relative z-10 rounded-[32px] border border-transparent bg-gradient-to-b from-surface via-surface to-surface-2 p-6 sm:p-8">
            <div className="relative mt-2 grid grid-cols-2 gap-3 sm:gap-5">
              <article className="relative rounded-[28px] border border-hairline bg-surface/80 p-4 sm:p-5 shadow-sm">
                <div className="stack-gap-sm">
                  <div className="flex justify-center">
                    <div className={clsx('flex h-10 w-10 items-center justify-center rounded-full text-base font-semibold shadow-inner sm:h-14 sm:w-14 sm:text-xl', leftOverallClass)}>
                      {leftOverall != null ? leftOverall.toFixed(1) : '-'}
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <CompareEngineSelector
                      options={resolvedLeftOptions}
                      value={left.modelSlug}
                      otherValue={right.modelSlug}
                      side="left"
                    />
                  </div>
                  {(() => {
                    const bestFor = left.bestFor?.trim();
                    const derived = deriveStrengths('left').join(', ');
                    const strengths = bestFor && !isPending(bestFor) ? bestFor : derived;
                    return strengths ? (
                      <p className="text-center text-xs text-text-secondary sm:text-sm">Strengths: {strengths}</p>
                    ) : null;
                  })()}
                </div>
              </article>

              <article className="relative rounded-[28px] border border-hairline bg-surface/80 p-4 sm:p-5 shadow-sm">
                <div className="stack-gap-sm text-right">
                  <div className="flex justify-center">
                    <div className={clsx('flex h-10 w-10 items-center justify-center rounded-full text-base font-semibold shadow-inner sm:h-14 sm:w-14 sm:text-xl', rightOverallClass)}>
                      {rightOverall != null ? rightOverall.toFixed(1) : '-'}
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <CompareEngineSelector
                      options={resolvedRightOptions}
                      value={right.modelSlug}
                      otherValue={left.modelSlug}
                      side="right"
                    />
                  </div>
                  {(() => {
                    const bestFor = right.bestFor?.trim();
                    const derived = deriveStrengths('right').join(', ');
                    const strengths = bestFor && !isPending(bestFor) ? bestFor : derived;
                    return strengths ? (
                      <p className="text-center text-xs text-text-secondary sm:text-sm">Strengths: {strengths}</p>
                    ) : null;
                  })()}
                </div>
              </article>

              <div className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-[10px] font-semibold uppercase tracking-micro text-on-brand shadow-lg sm:h-12 sm:w-12 sm:text-xs lg:h-14 lg:w-14 lg:text-sm">
                  VS
                </div>
              </div>
            </div>

            <div className="mt-8 text-center">
              <h2 className="text-xl font-semibold text-text-primary">Scorecard (Side-by-Side)</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Scores reflect quality and control on MaxVideoAI across 11 criteria.
              </p>
            </div>
            <CompareScoreboard
              leftLabel={formatEngineName(left)}
              rightLabel={formatEngineName(right)}
              metrics={comparisonMetrics}
              className="mt-6"
            />

            <div className="mt-6 mx-auto max-w-3xl">
              <div className="rounded-card bg-surface/95 px-3 py-4 text-center shadow-card">
                <div className="flex items-center justify-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-hairline bg-surface-2">
                    {summaryIcons.scorecard}
                  </span>
                  <h3 className="text-sm font-semibold text-text-primary">Winner summary</h3>
                </div>
                <div className="mt-3 grid gap-2">
                  {summaryRows.slice(0, 1).map((row) => (
                    <div
                      key={row.id}
                      className="flex flex-col items-center gap-2 rounded-2xl bg-surface-2/70 px-3 py-2 text-center"
                    >
                      <div className="flex items-center gap-2">
                        <span className={clsx('h-2.5 w-2.5 rounded-full opacity-80', resolveAccentDot(row.accent))} />
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-surface">
                          {summaryIcons[row.icon]}
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-micro text-text-muted">
                          {row.label}
                        </span>
                      </div>
                      <p className="text-sm text-text-secondary">{row.value}</p>
                    </div>
                  ))}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {summaryRows.slice(1).map((row) => (
                      <div
                        key={row.id}
                        className="flex flex-col items-center gap-2 rounded-2xl bg-surface-2/70 px-3 py-2 text-center"
                      >
                        <div className="flex items-center gap-2">
                          <span className={clsx('h-2.5 w-2.5 rounded-full opacity-80', resolveAccentDot(row.accent))} />
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-surface">
                            {summaryIcons[row.icon]}
                          </span>
                          <span className="text-[10px] font-semibold uppercase tracking-micro text-text-muted">
                            {row.label}
                          </span>
                        </div>
                        <p className="text-sm text-text-secondary">{row.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 items-center gap-3 sm:gap-4">
              <div className="flex flex-col items-center gap-2">
                <ButtonLink
                  href={`/app?engine=${left.modelSlug}`}
                  size="sm"
                  style={leftButtonStyle}
                  className={clsx(
                    'w-full max-w-[180px] justify-center hover:brightness-95 active:brightness-90',
                    !leftButtonStyle && leftAccent.buttonClass
                  )}
                >
                  Generate with {formatEngineShortName(left)}
                </ButtonLink>
                <Link
                  href={`/models/${left.modelSlug}`}
                  className="text-xs font-semibold text-brand hover:text-brandHover"
                >
                  Full engine profile
                </Link>
              </div>
              <div className="flex flex-col items-center gap-2">
                <ButtonLink
                  href={`/app?engine=${right.modelSlug}`}
                  size="sm"
                  style={rightButtonStyle}
                  className={clsx(
                    'w-full max-w-[180px] justify-center hover:brightness-95 active:brightness-90',
                    !rightButtonStyle && rightAccent.buttonClass
                  )}
                >
                  Generate with {formatEngineShortName(right)}
                </ButtonLink>
                <Link
                  href={`/models/${right.modelSlug}`}
                  className="text-xs font-semibold text-brand hover:text-brandHover"
                >
                  Full engine profile
                </Link>
              </div>
            </div>

            <div className="mt-10 border-t border-hairline pt-8">
              <h2 className="text-center text-2xl font-semibold text-text-primary">Key Specs (Side-by-Side)</h2>
              <p className="mt-2 text-center text-sm text-text-secondary">
                Compare key AI video model specs side-by-side (pricing, inputs, resolution, duration, aspect ratios,
                audio, and core controls). This is a high-level snapshot — see the full engine profile for the complete
                feature set and prompt examples.
              </p>

              <div className="mt-4 rounded-card border border-hairline bg-surface shadow-card">
                <div className="grid grid-cols-[minmax(90px,1fr)_minmax(80px,0.8fr)_minmax(90px,1fr)] gap-2 border-b border-hairline px-3 py-3 text-[10px] font-semibold uppercase tracking-micro text-text-muted min-[840px]:grid-cols-[minmax(200px,2fr)_minmax(220px,1fr)_minmax(200px,2fr)] min-[840px]:gap-4 min-[840px]:px-6 min-[840px]:py-4 min-[840px]:text-xs">
                  <span className="text-left">{formatEngineName(left)}</span>
                  <span className="text-center">Key spec</span>
                  <span className="text-right">{formatEngineName(right)}</span>
                </div>
                <div className="divide-y divide-hairline">
                  {specRows.map((row, index) => (
                    <div
                      key={row.label}
                      className={clsx(
                        'grid grid-cols-[minmax(90px,1fr)_minmax(80px,0.8fr)_minmax(90px,1fr)] gap-2 px-3 py-3 text-[11px] min-[840px]:grid-cols-[minmax(200px,2fr)_minmax(220px,1fr)_minmax(200px,2fr)] min-[840px]:gap-4 min-[840px]:px-6 min-[840px]:py-4 min-[840px]:text-sm',
                        index % 2 === 1 && 'bg-surface-2'
                      )}
                    >
                      <div className="rounded-md px-1 py-0.5 text-text-secondary sm:px-2 sm:py-1">
                        {renderSpecValue(row.left)}
                        {'subline' in row && row.subline ? (
                          <div className="mt-1 text-[10px] text-text-muted">{row.subline}</div>
                        ) : null}
                      </div>
                      <span className="text-center text-text-primary">{row.label}</span>
                      <div className="rounded-md px-1 py-0.5 text-right text-text-secondary sm:px-2 sm:py-1">
                        {renderSpecValue(row.right)}
                        {'rightSubline' in row && row.rightSubline ? (
                          <div className="mt-1 text-[10px] text-text-muted">{row.rightSubline}</div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        

        {showdownSlots.length ? (
          <section className="stack-gap-sm">
            <h2 className="text-2xl font-semibold text-text-primary">Showdown (same prompt)</h2>
            <p className="text-sm text-text-secondary">
              Side-by-side renders from the same prompt on MaxVideoAI. Prompts are identical; outputs may vary by model.
            </p>
            <p className="text-xs text-text-muted">Showing up to 3 prompt pairs for clarity.</p>

            <div className="stack-gap-lg">
              {showdownSlots.map((entry) => (
                <article
                  key={`${slug}-showdown-${entry.id}`}
                  className="rounded-card border border-hairline bg-surface p-6 shadow-card"
                >
                  <div className="stack-gap-sm">
                    <div>
                      <h3 className="text-lg font-semibold text-text-primary">{entry.title}</h3>
                      <p className="text-sm text-text-secondary">What it tests: {entry.whatItTests}</p>
                    </div>
                    <div className="rounded-card border border-hairline bg-surface-2 p-3 text-sm text-text-secondary">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">Prompt</span>
                        <CopyPromptButton prompt={entry.prompt} />
                      </div>
                      <p className="mt-2 text-text-primary">{entry.prompt}</p>
                    </div>
                    <div className="grid grid-gap lg:grid-cols-2">
                      {renderShowdownMedia(entry.left, formatEngineName(left))}
                      {renderShowdownMedia(entry.right, formatEngineName(right))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
                      <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">Try this prompt:</span>
                      <Link
                        href={buildGenerateHref(left.modelSlug, entry.prompt, entry.aspectRatio, entry.mode)}
                        className="rounded-full border border-hairline bg-surface px-3 py-1 text-xs font-semibold text-text-primary transition hover:bg-surface-2"
                      >
                        {formatEngineShortName(left)}
                      </Link>
                      <Link
                        href={buildGenerateHref(right.modelSlug, entry.prompt, entry.aspectRatio, entry.mode)}
                        className="rounded-full border border-hairline bg-surface px-3 py-1 text-xs font-semibold text-text-primary transition hover:bg-surface-2"
                      >
                        {formatEngineShortName(right)}
                      </Link>
                      <span className="text-xs text-text-muted">Opens the generator pre-filled.</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <p className="text-sm text-text-secondary">
              This side-by-side AI video comparison uses identical prompts to highlight differences in motion, realism,
              human fidelity, and text legibility. For full specs, controls, and more prompt examples, open each engine
              profile.
            </p>
          </section>
        ) : null}

        <section className="stack-gap-sm">
          <h2 className="text-2xl font-semibold text-text-primary">FAQ</h2>
          <p className="text-sm text-text-secondary">
            Quick answers about {formatEngineName(left)} vs {formatEngineName(right)} on MaxVideoAI (pricing, modes,
            specs, and why results differ).
          </p>
          <div className="stack-gap-sm">
            {faqItems.map((item) => (
              <details key={item.question} className="rounded-card border border-hairline bg-surface p-4">
                <summary className="cursor-pointer text-sm font-semibold text-text-primary">
                  {item.question}
                </summary>
                {Array.isArray(item.answer) ? (
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-text-secondary">
                    {item.answer.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-text-secondary">{item.answer}</p>
                )}
              </details>
            ))}
          </div>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }}
          />
        </section>

        <div className="text-sm text-text-muted">
          <Link href={modelsHref} className="font-semibold text-brand hover:text-brandHover">
            Back to models
          </Link>
        </div>
      </div>
    </div>
  );
}
