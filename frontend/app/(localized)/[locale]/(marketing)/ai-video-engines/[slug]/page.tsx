import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import clsx from 'clsx';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { locales } from '@/i18n/locales';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { isDatabaseConfigured } from '@/lib/db';
import compareConfig from '@/config/compare-config.json';
import engineCatalog from '@/config/engine-catalog.json';
import { ButtonLink } from '@/components/ui/Button';
import { CompareEngineSelector } from './CompareEngineSelector.client';
import { CompareScoreboard } from './CompareScoreboard.client';
import { getVideosByIds } from '@/server/videos';

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
  motion?: number;
  anatomy?: number;
  textRendering?: number;
  consistency?: number;
  lipsyncQuality?: number;
  sequencingQuality?: number;
  last_updated?: string;
};

type EngineScoresFile = {
  version?: string;
  last_updated?: string;
  scores?: EngineScore[];
};

type ShowdownSide = {
  label?: string;
  jobId?: string;
  videoUrl?: string;
  posterUrl?: string;
};

type ShowdownEntry = {
  prompt?: string;
  left: ShowdownSide;
  right: ShowdownSide;
};

const TROPHY_COMPARISONS = compareConfig.trophyComparisons as string[];
const TROPHY_SET = new Set(TROPHY_COMPARISONS);
const SHOWDOWNS =
  (compareConfig as { showdowns?: Record<string, ShowdownEntry[]> }).showdowns ?? {};
const CATALOG = engineCatalog as EngineCatalogEntry[];
const CATALOG_BY_SLUG = new Map(CATALOG.map((entry) => [entry.modelSlug, entry]));
const ENGINE_OPTIONS = [...CATALOG]
  .map((entry) => ({ value: entry.modelSlug, label: entry.marketingName }))
  .sort((a, b) => a.label.localeCompare(b.label, 'en'));

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Params[]> {
  const params: Params[] = [];
  locales.forEach((locale) => {
    TROPHY_COMPARISONS.forEach((slug) => {
      params.push({ locale, slug });
    });
  });
  return params;
}

function isKnownComparison(slug: string): boolean {
  return TROPHY_COMPARISONS.includes(slug);
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

function formatYesNo(value?: boolean) {
  if (value == null) return '-';
  return value ? 'Yes' : 'No';
}

function formatPricePerSecond(entry: EngineCatalogEntry): string {
  const cents = getPricePerSecondCents(entry);
  if (typeof cents === 'number') {
    return `$${(cents / 100).toFixed(2)}/s`;
  }
  return '-';
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
  if (avg == null) return '-';
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
  if (!numeric.length) return resolutions.join(', ') || '-';
  const max = Math.max(...numeric);
  return `${max}p`;
}

function formatDuration(entry: EngineCatalogEntry) {
  const max = entry.engine?.maxDurationSec;
  return typeof max === 'number' ? `${max}s max` : '-';
}

function formatAspectRatios(entry: EngineCatalogEntry) {
  const ratios = entry.engine?.aspectRatios ?? [];
  return ratios.length ? ratios.join(' / ') : '-';
}

function formatInputs(entry: EngineCatalogEntry) {
  const modes = entry.engine?.modes ?? [];
  const labels = new Set<string>();
  modes.forEach((mode) => {
    if (mode === 't2v') labels.add('Text');
    if (mode === 'i2v') labels.add('Image');
    if (mode === 'r2v') labels.add('Reference');
  });
  return labels.size ? Array.from(labels).join(' / ') : '-';
}

function formatControls(entry: EngineCatalogEntry) {
  const params = entry.engine?.params ?? {};
  const controls: string[] = [];
  if ('seed' in params || 'seed_locked' in params || 'seedLock' in params) controls.push('Seed');
  if ('negative_prompt' in params || 'negativePrompt' in params) controls.push('Negative prompt');
  if (entry.engine?.extend) controls.push('Extend');
  if ('inpaint' in params || 'mask' in params) controls.push('Inpaint');
  return controls.length ? controls.join(' / ') : '-';
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

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const locale = params.locale ?? 'en';
  const slug = params.slug;
  const resolved = resolveEngines(slug);
  const title = resolved
    ? `${formatEngineName(resolved.left)} vs ${formatEngineName(resolved.right)} - MaxVideoAI`
    : 'Compare engines - MaxVideoAI';
  const description = resolved
    ? `Side-by-side comparison of ${formatEngineName(resolved.left)} and ${formatEngineName(resolved.right)} with MaxVideoAI metrics and guidance.`
    : 'Side-by-side comparison of AI video engines with MaxVideoAI metrics and guidance.';
  return buildSeoMetadata({
    locale,
    title,
    description,
    englishPath: `/ai-video-engines/${slug}`,
  });
}

export default async function CompareDetailPage({ params }: { params: Params }) {
  const slug = params.slug;
  if (!isKnownComparison(slug)) {
    notFound();
  }
  const resolved = resolveEngines(slug);
  if (!resolved) {
    notFound();
  }
  const { left, right } = resolved;
  const scores = await loadEngineScores();
  const leftScore = scores.get(left.modelSlug) ?? scores.get(left.engineId) ?? null;
  const rightScore = scores.get(right.modelSlug) ?? scores.get(right.engineId) ?? null;
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
  const showdowns = await hydrateShowdowns(SHOWDOWNS[slug] ?? []);
  const leftAccent = getEngineAccent(left);
  const rightAccent = getEngineAccent(right);
  const leftButtonStyle = getEngineButtonStyle(left);
  const rightButtonStyle = getEngineButtonStyle(right);
  const leftPrice = getPricePerSecondCents(left);
  const rightPrice = getPricePerSecondCents(right);
  const priceScores = computePairScores(leftPrice, rightPrice, true);
  const speedScores = computePairScores(left.engine?.avgDurationMs ?? null, right.engine?.avgDurationMs ?? null, true);
  const leftOptions = ENGINE_OPTIONS.filter((option) =>
    TROPHY_SET.has(`${option.value}-vs-${right.modelSlug}`)
  );
  const rightOptions = ENGINE_OPTIONS.filter((option) =>
    TROPHY_SET.has(`${left.modelSlug}-vs-${option.value}`)
  );
  const resolvedLeftOptions = leftOptions.length ? leftOptions : ENGINE_OPTIONS;
  const resolvedRightOptions = rightOptions.length ? rightOptions : ENGINE_OPTIONS;
  const specRows = [
    { label: 'Price per second', left: formatPricePerSecond(left), right: formatPricePerSecond(right) },
    { label: 'Inputs', left: formatInputs(left), right: formatInputs(right) },
    { label: 'Max resolution', left: formatMaxResolution(left), right: formatMaxResolution(right) },
    { label: 'Duration', left: formatDuration(left), right: formatDuration(right) },
    { label: 'Aspect ratios', left: formatAspectRatios(left), right: formatAspectRatios(right) },
    { label: 'Audio', left: formatYesNo(left.engine?.audio), right: formatYesNo(right.engine?.audio) },
    { label: 'Lipsync', left: formatYesNo(left.features?.lipsync?.value), right: formatYesNo(right.features?.lipsync?.value) },
    { label: 'Sequenced prompts', left: formatYesNo(left.features?.sequencing?.value), right: formatYesNo(right.features?.sequencing?.value) },
    { label: 'Core controls', left: formatControls(left), right: formatControls(right) },
    { label: 'Extend', left: formatYesNo(left.engine?.extend), right: formatYesNo(right.engine?.extend) },
    { label: 'Avg render time', left: formatSpeedChip(left), right: formatSpeedChip(right) },
  ];

  const comparisonMetrics = [
    {
      id: 'fidelity',
      label: 'Fidelity / Prompt Following',
      leftValue: leftScore?.fidelity ?? null,
      rightValue: rightScore?.fidelity ?? null,
    },
    { id: 'motion', label: 'Motion / Physics', leftValue: leftScore?.motion ?? null, rightValue: rightScore?.motion ?? null },
    {
      id: 'consistency',
      label: 'Consistency / Control',
      leftValue: leftScore?.consistency ?? null,
      rightValue: rightScore?.consistency ?? null,
    },
    {
      id: 'anatomy',
      label: 'Anatomy (Hands / Faces)',
      leftValue: leftScore?.anatomy ?? null,
      rightValue: rightScore?.anatomy ?? null,
    },
    {
      id: 'text',
      label: 'Text Rendering / UI Clarity',
      leftValue: leftScore?.textRendering ?? null,
      rightValue: rightScore?.textRendering ?? null,
    },
    {
      id: 'lipsync',
      label: 'Audio / Lipsync Quality',
      leftValue: leftScore?.lipsyncQuality ?? null,
      rightValue: rightScore?.lipsyncQuality ?? null,
    },
    {
      id: 'sequencing',
      label: 'Sequencing Quality',
      leftValue: leftScore?.sequencingQuality ?? null,
      rightValue: rightScore?.sequencingQuality ?? null,
    },
    { id: 'pricing', label: 'Pricing / Value', leftValue: priceScores.leftScore, rightValue: priceScores.rightScore },
    { id: 'speed', label: 'Speed / Reliability', leftValue: speedScores.leftScore, rightValue: speedScores.rightScore },
  ];

  return (
    <div className="container-page max-w-6xl section">
      <div className="stack-gap-xl">
        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Compare engines</p>
          <h1 className="mt-2 text-3xl font-semibold text-text-primary sm:text-5xl">
            {formatEngineName(left)} vs {formatEngineName(right)}
          </h1>
          <p className="mt-4 text-sm text-text-secondary">
            This page compares {formatEngineName(left)} vs {formatEngineName(right)} using the same prompts,
            side-by-side renders, and a simple scorecard (prompt accuracy, motion, consistency, anatomy, text/UI,
            audio, sequencing, and value). Use it to pick a winner fast — then jump to each engine’s profile for
            full specs and controls.
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
                  <p className="text-center text-xs text-text-secondary sm:text-sm">
                    Best for {left.bestFor ?? '-'}
                  </p>
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
                  <p className="text-center text-xs text-text-secondary sm:text-sm">
                    Best for {right.bestFor ?? '-'}
                  </p>
                </div>
              </article>

              <div className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-[10px] font-semibold uppercase tracking-micro text-on-brand shadow-lg sm:h-12 sm:w-12 sm:text-xs lg:h-14 lg:w-14 lg:text-sm">
                  VS
                </div>
              </div>
            </div>

            <CompareScoreboard
              leftLabel={formatEngineName(left)}
              rightLabel={formatEngineName(right)}
              metrics={comparisonMetrics}
              className="mt-8"
            />

            <div className="mt-8 grid grid-cols-2 items-center gap-3 sm:gap-4">
              <ButtonLink
                href={`/app?engine=${left.modelSlug}`}
                size="sm"
                style={leftButtonStyle}
                className={clsx(
                  'w-full justify-center hover:brightness-95 active:brightness-90',
                  !leftButtonStyle && leftAccent.buttonClass
                )}
              >
                Generate with {formatEngineShortName(left)}
              </ButtonLink>
              <ButtonLink
                href={`/app?engine=${right.modelSlug}`}
                size="sm"
                style={rightButtonStyle}
                className={clsx(
                  'w-full justify-center hover:brightness-95 active:brightness-90',
                  !rightButtonStyle && rightAccent.buttonClass
                )}
              >
                Generate with {formatEngineShortName(right)}
              </ButtonLink>
            </div>

            <div className="mt-10 border-t border-hairline pt-8">
              <h2 className="text-center text-2xl font-semibold text-text-primary">Spec breakdown</h2>

              <div className="mt-4 rounded-card border border-hairline bg-surface shadow-card">
                <div className="grid grid-cols-[minmax(90px,1fr)_minmax(80px,0.8fr)_minmax(90px,1fr)] gap-2 border-b border-hairline px-3 py-3 text-[10px] font-semibold uppercase tracking-micro text-text-muted sm:grid-cols-[minmax(200px,2fr)_minmax(220px,1fr)_minmax(200px,2fr)] sm:gap-4 sm:px-6 sm:py-4 sm:text-xs">
                  <span className="text-left">{formatEngineName(left)}</span>
                  <span className="text-center">Spec</span>
                  <span className="text-right">{formatEngineName(right)}</span>
                </div>
                <div className="divide-y divide-hairline">
                  {specRows.map((row, index) => (
                    <div
                      key={row.label}
                      className={clsx(
                        'grid grid-cols-[minmax(90px,1fr)_minmax(80px,0.8fr)_minmax(90px,1fr)] gap-2 px-3 py-3 text-[11px] sm:grid-cols-[minmax(200px,2fr)_minmax(220px,1fr)_minmax(200px,2fr)] sm:gap-4 sm:px-6 sm:py-4 sm:text-sm',
                        index % 2 === 1 && 'bg-surface-2'
                      )}
                    >
                      <span className="rounded-md px-1 py-0.5 text-text-secondary sm:px-2 sm:py-1">
                        {row.left}
                      </span>
                      <span className="text-center text-text-primary">{row.label}</span>
                      <span className="rounded-md px-1 py-0.5 text-right text-text-secondary sm:px-2 sm:py-1">
                        {row.right}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        

        {showdowns.length ? (
          <section className="stack-gap-sm">
            <h2 className="text-2xl font-semibold text-text-primary">Showdown (same prompt)</h2>
            <p className="text-sm text-text-secondary">
              Side-by-side renders from the same prompt. Limited to 1-3 pairs for clarity.
            </p>
            <div className="stack-gap-lg">
              {showdowns.slice(0, 3).map((entry, index) => (
                <article
                  key={`${slug}-showdown-${index}`}
                  className="rounded-card border border-hairline bg-surface p-6 shadow-card"
                >
                  <div className="stack-gap">
                    {entry.prompt ? (
                      <p className="text-sm text-text-secondary">
                        <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">Prompt</span>
                        <span className="mt-2 block text-text-primary">{entry.prompt}</span>
                      </p>
                    ) : null}
                    <div className="grid grid-gap lg:grid-cols-2">
                      {renderShowdownMedia(entry.left, formatEngineName(left))}
                      {renderShowdownMedia(entry.right, formatEngineName(right))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <div className="text-sm text-text-muted">
          <Link href="/ai-video-engines" className="font-semibold text-brand hover:text-brandHover">
            Back to AI video engines hub
          </Link>
        </div>
      </div>
    </div>
  );
}
