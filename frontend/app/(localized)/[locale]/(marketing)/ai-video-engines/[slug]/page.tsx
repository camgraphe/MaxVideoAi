import type { CSSProperties } from 'react';
import Image from 'next/image';
import type { Metadata } from 'next';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import clsx from 'clsx';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { localePathnames, locales } from '@/i18n/locales';
import { resolveDictionary } from '@/lib/i18n/server';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import { isDatabaseConfigured } from '@/lib/db';
import compareConfig from '@/config/compare-config.json';
import { getCompareShowdowns, type CompareShowdown } from '@/config/compare-showdowns';
import { canonicalizeFalModelSlug, listFalEngines } from '@/config/falEngines';
import engineCatalog from '@/config/engine-catalog.json';
import { isPublishedComparisonSlug } from '@/lib/compare-hub/data';
import { ButtonLink } from '@/components/ui/Button';
import { DeferredSourcePrompt } from '@/components/i18n/DeferredSourcePrompt.client';
import { CompareEngineSelector } from './CompareEngineSelector.client';
import { CompareScoreboard } from './CompareScoreboard.client';
import { CopyPromptButton } from './CopyPromptButton.client';
import { getLatestPublicVideoByPromptAndEngine, getPublicVideosByIds, type GalleryVideo } from '@/server/videos';
import { fetchEngineAverageDurations } from '@/server/generate-metrics';
import { computeMarketingPriceRange } from '@/lib/pricing-marketing';
import { applyDisplayedPriceMarginCents } from '@/lib/pricing-display';
import { getImageAlt } from '@/lib/image-alt';
import type { EngineCaps } from '@/types/engines';

const COMPARE_SLUG_MAP = buildSlugMap('compare');
const MODELS_SLUG_MAP = buildSlugMap('models');

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
    fps?: number[];
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
      addons?: {
        audio_off?: {
          perSecondCents?: number;
        };
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
  slotId?: string;
  prompt?: string;
  left: ShowdownSide;
  right: ShowdownSide;
};

const TROPHY_COMPARISONS = compareConfig.trophyComparisons as string[];
const RELATED_COMPARISONS =
  (compareConfig as { relatedComparisons?: Record<string, string[]> }).relatedComparisons ?? {};
const EXCLUDED_ENGINE_SLUGS = new Set(['nano-banana', 'nano-banana-pro', 'nano-banana-2']);
const SHOWDOWNS =
  (compareConfig as { showdowns?: Record<string, Array<ShowdownEntry | null>> }).showdowns ?? {};
const SHOWDOWN_OVERRIDES =
  (compareConfig as { showdownOverrides?: Record<string, Record<string, string>> }).showdownOverrides ?? {};
const CATALOG = engineCatalog as EngineCatalogEntry[];
const CATALOG_BY_SLUG = new Map(CATALOG.map((entry) => [entry.modelSlug, entry]));
const ENGINE_OPTIONS = [...CATALOG]
  .filter((entry) => !EXCLUDED_ENGINE_SLUGS.has(entry.modelSlug))
  .map((entry) => ({ value: entry.modelSlug, label: entry.marketingName }))
  .sort((a, b) => a.label.localeCompare(b.label, 'en'));
const PRICING_ENGINES = new Map<string, EngineCaps>(
  listFalEngines().map((entry) => [entry.modelSlug, entry.engine])
);

function reverseCompareSlug(slug: string) {
  const parts = slug.split('-vs-');
  if (parts.length !== 2) return null;
  return `${parts[1]}-vs-${parts[0]}`;
}

function formatTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
}

function replaceCriteriaCount(template: string, count: number) {
  return template
    .replace(/\b11 criteria\b/g, `${count} criteria`)
    .replace(/\b11 critères\b/g, `${count} critères`)
    .replace(/\b11 criterios\b/g, `${count} criterios`);
}

function stripAudioReferencesForSilentPair(template: string, pairHasNativeAudio: boolean) {
  if (pairHasNativeAudio) return template;
  return template
    .replace(/\(duration,\s*resolution,\s*audio\)/g, '(duration and resolution)')
    .replace(/\(durée,\s*résolution,\s*audio\)/g, '(durée et résolution)')
    .replace(/\(duración,\s*resolución,\s*audio\)/g, '(duración y resolución)')
    .replace(
      /\(pricing,\s*inputs,\s*resolution,\s*duration,\s*aspect ratios,\s*audio,\s*and core controls\)/g,
      '(pricing, inputs, resolution, duration, aspect ratios, and core controls)'
    )
    .replace(
      /\(prix,\s*entrées,\s*résolution,\s*durée,\s*formats,\s*audio et contrôles\)/g,
      '(prix, entrées, résolution, durée, formats et contrôles)'
    )
    .replace(
      /\(precios,\s*entradas,\s*resolución,\s*duración,\s*formatos,\s*audio y controles\)/g,
      '(precios, entradas, resolución, duración, formatos y controles)'
    );
}

const LOCALIZED_BEST_FOR: Partial<Record<AppLocale, Record<string, string>>> = {
  fr: {
    'Ads and B-roll': 'Publicités et plans B-roll',
    'Budget Veo drafts': 'Brouillons Veo à petit budget',
    'Cinematic dialogue': 'Dialogue cinématographique',
    'Cinematic motion with camera lock': 'Mouvement cinématographique avec caméra verrouillée',
    'Cinematic shots': 'Plans cinématographiques',
    'Fast Seedance drafts, reference tests, and shot planning':
      'Brouillons Seedance rapides, tests de références et préparation des plans',
    'Fast cinematic drafts with modify and reframe': 'Brouillons cinématographiques rapides avec modify et reframe',
    'Fast iterations': 'Itérations rapides',
    'Flagship multi-shot video with native audio and references':
      'Vidéo multi-plans premium avec audio natif et références',
    'General purpose video': 'Vidéo polyvalente',
    'Grounded stills and wide-format image edits': 'Stills réalistes et retouches d’images grand format',
    'Multi-shot cinematic control': 'Contrôle cinématographique multi-plans',
    'Multi-shot testing at lower cost': 'Tests multi-plans à moindre coût',
    'Premium cinematic generation with modify and reframe': 'Génération cinématographique premium avec modify et reframe',
    'Premium product stories': 'Histoires produit premium',
    'Prompts or image loops': 'Prompts ou boucles à partir d’images',
    'Rapid social clips': 'Clips sociaux rapides',
    'Studio-grade Sora renders': 'Rendus Sora de niveau studio',
    'Stylised text or image motion': 'Animation stylisée de texte ou d’image',
  },
  es: {
    'Ads and B-roll': 'Anuncios y planos B-roll',
    'Budget Veo drafts': 'Borradores Veo de bajo coste',
    'Cinematic dialogue': 'Diálogo cinematográfico',
    'Cinematic motion with camera lock': 'Movimiento cinematográfico con cámara bloqueada',
    'Cinematic shots': 'Planos cinematográficos',
    'Fast Seedance drafts, reference tests, and shot planning':
      'Borradores rápidos de Seedance, pruebas de referencias y planificación de planos',
    'Fast cinematic drafts with modify and reframe': 'Borradores cinematográficos rápidos con modify y reframe',
    'Fast iterations': 'Iteraciones rápidas',
    'Flagship multi-shot video with native audio and references':
      'Video multi-shot premium con audio nativo y referencias',
    'General purpose video': 'Video de uso general',
    'Grounded stills and wide-format image edits': 'Imágenes fijas realistas y ediciones panorámicas',
    'Multi-shot cinematic control': 'Control cinematográfico multi-shot',
    'Multi-shot testing at lower cost': 'Pruebas multi-shot con menor coste',
    'Premium cinematic generation with modify and reframe': 'Generación cinematográfica premium con modify y reframe',
    'Premium product stories': 'Historias de producto premium',
    'Prompts or image loops': 'Prompts o bucles desde imágenes',
    'Rapid social clips': 'Clips sociales rápidos',
    'Studio-grade Sora renders': 'Renders de Sora con nivel de estudio',
    'Stylised text or image motion': 'Movimiento estilizado de texto o imagen',
  },
};

const LOCALIZED_SHOWDOWN_TITLES: Partial<Record<AppLocale, Record<string, string>>> = {
  fr: {
    'Fast Motion + Physics (16:9)': 'Mouvement rapide + physique (16:9)',
    'UGC Talking Head + Lip Sync (9:16)': 'Face caméra UGC + synchronisation labiale (9:16)',
    'UGC Talking Head (9:16)': 'Face caméra UGC (9:16)',
    'Hands + Product Demo + On-screen Text': 'Mains + démo produit + texte à l’écran',
  },
  es: {
    'Fast Motion + Physics (16:9)': 'Movimiento rápido + física (16:9)',
    'UGC Talking Head + Lip Sync (9:16)': 'UGC talking head + sincronización labial (9:16)',
    'UGC Talking Head (9:16)': 'UGC talking head (9:16)',
    'Hands + Product Demo + On-screen Text': 'Manos + demo de producto + texto en pantalla',
  },
};

const LOCALIZED_SHOWDOWN_TESTS: Partial<Record<AppLocale, Record<string, string>>> = {
  fr: {
    'Human Fidelity + Audio/Lip Sync + Prompt Adherence':
      'Fidélité humaine + audio/synchronisation labiale + adhérence au prompt',
    'Human Fidelity + Prompt Adherence + Vertical Framing':
      'Fidélité humaine + adhérence au prompt + cadrage vertical',
    'Motion Realism + Temporal Consistency + Visual Quality':
      'Réalisme du mouvement + cohérence temporelle + qualité visuelle',
    'Hands/Fingers + Text & UI Legibility + Prompt Adherence':
      'Mains/doigts + lisibilité du texte et de l’interface + adhérence au prompt',
  },
  es: {
    'Human Fidelity + Audio/Lip Sync + Prompt Adherence':
      'Fidelidad humana + audio/sincronización labial + adherencia al prompt',
    'Human Fidelity + Prompt Adherence + Vertical Framing':
      'Fidelidad humana + adherencia al prompt + encuadre vertical',
    'Motion Realism + Temporal Consistency + Visual Quality':
      'Realismo del movimiento + consistencia temporal + calidad visual',
    'Hands/Fingers + Text & UI Legibility + Prompt Adherence':
      'Manos/dedos + legibilidad de texto e interfaz + adherencia al prompt',
  },
};

function localizeMappedValue(
  value: string,
  locale: AppLocale,
  translations: Partial<Record<AppLocale, Record<string, string>>>
): string {
  if (locale === 'en') return value;
  return translations[locale]?.[value] ?? value;
}

function localizeBestFor(value: string | null | undefined, locale: AppLocale): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  if (locale === 'en') return normalized;
  return LOCALIZED_BEST_FOR[locale]?.[normalized] ?? null;
}

export const dynamicParams = true;

export async function generateStaticParams(): Promise<Params[]> {
  const params: Params[] = [];
  locales.forEach((locale) => {
    TROPHY_COMPARISONS.forEach((slug) => {
      const canonical = getCanonicalCompareSlug(slug)?.canonicalSlug ?? slug;
      params.push({ locale, slug: canonical });
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
  if (['openai', 'google', 'bytedance', 'minimax', 'kling', 'runway', 'pika'].includes(words[0]?.toLowerCase())) {
    return words.slice(1).join(' ');
  }
  return fullName;
}

function formatEngineMetaName(entry: EngineCatalogEntry): string {
  let name = formatEngineName(entry);
  name = name.replace(/^(openai|google|minimax)\s+/i, '');
  name = name.replace(/\bVideo\s+(\d+(?:\.\d+)?)/i, '$1');
  name = name.replace(/\b(\d+)\.0\b/g, '$1');
  name = name.replace(/\s+text\s*&\s*image\s+to\s+video$/i, '');
  name = name.replace(/\s+text\s+to\s+video$/i, '');
  name = name.replace(/\s+image\s+to\s+video$/i, '');
  name = name.replace(/\s+First\/Last Frame$/i, ' First/Last');
  name = name.replace(/\s+standard$/i, '');
  name = name.replace(/\s+text$/i, '');
  return name.trim();
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
  if (EXCLUDED_ENGINE_SLUGS.has(leftSlug) || EXCLUDED_ENGINE_SLUGS.has(rightSlug)) {
    return null;
  }
  const left = CATALOG_BY_SLUG.get(leftSlug);
  const right = CATALOG_BY_SLUG.get(rightSlug);
  if (!left || !right) return null;
  return { left, right };
}

function getCanonicalCompareSlug(slug: string) {
  const parts = slug.split('-vs-');
  if (parts.length !== 2) return null;
  const [rawLeftSlug, rawRightSlug] = parts;
  const leftSlug = canonicalizeFalModelSlug(rawLeftSlug);
  const rightSlug = canonicalizeFalModelSlug(rawRightSlug);
  const sorted = [leftSlug, rightSlug].sort();
  return {
    canonicalSlug: `${sorted[0]}-vs-${sorted[1]}`,
    leftSlug,
    rightSlug,
  };
}

function resolveExcludedCompareRedirect({
  slug,
  order,
  locale,
}: {
  slug: string;
  order?: string | null;
  locale: AppLocale;
}) {
  const parts = slug.split('-vs-');
  if (parts.length !== 2) return null;
  const excluded = parts.filter((part) => EXCLUDED_ENGINE_SLUGS.has(part));
  if (!excluded.length) return null;
  const preferred = order && excluded.includes(order) ? order : excluded[0];
  const localePrefix = localePathnames[locale] ? `/${localePathnames[locale]}` : '';
  const modelsBase = MODELS_SLUG_MAP[locale] ?? MODELS_SLUG_MAP.en ?? 'models';
  return `${localePrefix}/${modelsBase}/${preferred}`.replace(/\/{2,}/g, '/');
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

async function hydrateShowdowns(
  entries: Array<ShowdownEntry | null>
): Promise<Array<ShowdownEntry | null>> {
  const jobIds = new Set<string>();
  entries.forEach((entry) => {
    if (!entry) return;
    if (entry.left.jobId) jobIds.add(entry.left.jobId);
    if (entry.right.jobId) jobIds.add(entry.right.jobId);
  });
  if (!jobIds.size || !isDatabaseConfigured()) {
    return entries;
  }
  try {
    const videos = await getPublicVideosByIds(Array.from(jobIds));
    return entries.map((entry) => {
      if (!entry) return entry;
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

function getPricePerSecondCents(entry: EngineCatalogEntry): number | null {
  const perSecond = entry.engine?.pricingDetails?.perSecondCents;
  const byResolution = perSecond?.byResolution ? Object.values(perSecond.byResolution) : [];
  const cents = perSecond?.default ?? (byResolution.length ? Math.min(...byResolution) : null);
  if (typeof cents === 'number') {
    return applyDisplayedPriceMarginCents(cents);
  }
  const base = entry.engine?.pricing?.base;
  if (typeof base === 'number') {
    return applyDisplayedPriceMarginCents(Math.round(base * 100));
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

function resolveVideoToVideoSupport(entry: EngineCatalogEntry) {
  const modes = entry.engine?.modes ?? [];
  if (!modes.length) return 'Data pending';
  if (modes.includes('v2v') && modes.includes('reframe')) return 'Supported (modify / reframe workflows)';
  if (modes.includes('v2v')) return 'Supported';
  if (modes.includes('reframe')) return 'Supported (reframe workflow)';
  if (modes.includes('extend') || modes.includes('retake')) {
    return 'Supported (extend / retake workflows)';
  }
  return 'Not supported';
}

function resolveFirstLastSupport(entry: EngineCatalogEntry) {
  const modes = entry.engine?.modes ?? [];
  if (modes.includes('fl2v')) return 'Supported';
  if (entry.engine?.keyframes != null) return resolveStatus(entry.engine.keyframes);
  return modes.length ? 'Not supported' : 'Data pending';
}

function resolveReferenceImageSupport(entry: EngineCatalogEntry) {
  const modes = entry.engine?.modes ?? [];
  if (!modes.length) return 'Data pending';
  if (modes.includes('ref2v') || modes.includes('r2v')) return 'Supported (multi reference stills)';
  if (modes.includes('i2v')) return 'Supported (single start image)';
  return 'Not supported';
}

function resolveReferenceVideoSupport(entry: EngineCatalogEntry) {
  const modes = entry.engine?.modes ?? [];
  if (!modes.length) return 'Data pending';
  if (modes.includes('v2v') || modes.includes('reframe')) {
    return 'Supported (source clip for modify / reframe)';
  }
  if (modes.includes('r2v')) return 'Supported';
  if (modes.includes('extend') || modes.includes('retake')) {
    return 'Supported (source clip for extend / retake)';
  }
  return 'Not supported';
}

function isPending(value: string) {
  return value.trim().toLowerCase() === 'data pending';
}

function buildSpecValues(entry: EngineCatalogEntry, specs: Record<string, unknown> | undefined) {
  return {
    textToVideo: resolveKeySpecValue(specs, 'textToVideo', resolveModeSupported(entry, 't2v')),
    imageToVideo: resolveKeySpecValue(specs, 'imageToVideo', resolveModeSupported(entry, 'i2v')),
    videoToVideo: resolveKeySpecValue(specs, 'videoToVideo', resolveVideoToVideoSupport(entry)),
    firstLastFrame: resolveKeySpecValue(specs, 'firstLastFrame', resolveFirstLastSupport(entry)),
    referenceImageStyle: resolveKeySpecValue(specs, 'referenceImageStyle', resolveReferenceImageSupport(entry)),
    referenceVideo: resolveKeySpecValue(specs, 'referenceVideo', resolveReferenceVideoSupport(entry)),
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
  const total = applyDisplayedPriceMarginCents(perSecond.default + audioOffDelta);
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

function getPrelaunchPricingLabel(locale: AppLocale) {
  if (locale === 'fr') return 'Confirmé au lancement';
  if (locale === 'es') return 'Confirmado en lanzamiento';
  return 'TBD at launch';
}

function isPrelaunchAvailability(entry: EngineCatalogEntry) {
  const availability = String(entry.availability ?? '').toLowerCase();
  return availability === 'waitlist' || availability === 'limited';
}

function getPrelaunchCompareNotice(locale: AppLocale) {
  if (locale === 'fr') {
    return {
      title: 'Comparaison pré-lancement',
      body: 'Un moteur de cette page est en pré-lancement. Les rendus runtime ne sont pas encore disponibles; les prix et sorties finales sont confirmés au lancement.',
    };
  }
  if (locale === 'es') {
    return {
      title: 'Comparación de prelanzamiento',
      body: 'Un motor de esta página está en prelanzamiento. Los renders runtime aún no están disponibles; los precios y resultados finales se confirman en el lanzamiento.',
    };
  }
  return {
    title: 'Pre-launch comparison',
    body: 'At least one engine on this page is pre-launch. Runtime renders are not available yet; final pricing and outputs are confirmed at launch.',
  };
}

function isEngineGeneratable(entry: EngineCatalogEntry) {
  const availability = String(entry.availability ?? '').toLowerCase();
  return availability === 'available' || availability === 'limited';
}

async function resolvePricingDisplay(
  entry: EngineCatalogEntry,
  locale: AppLocale,
  pricingEngine?: EngineCaps | null
) {
  const availability = String(entry.availability ?? '').toLowerCase();
  if (availability === 'waitlist') {
    return {
      headline: getPrelaunchPricingLabel(locale),
      subline: null,
      prices: [],
    };
  }

  if (pricingEngine) {
    const range = await computeMarketingPriceRange(pricingEngine, { durationSec: 5, memberTier: 'member' });
    if (range) {
      const headline = formatPriceLine(range.min.resolution, range.min.cents);
      const prices = [range.min.cents / 100];
      let subline: string | null = null;
      if (range.max.cents !== range.min.cents || range.max.resolution !== range.min.resolution) {
        subline = formatPriceLine(range.max.resolution, range.max.cents);
        prices.push(range.max.cents / 100);
      }
      return { headline, subline, prices };
    }
  }
  const perSecond = entry.engine?.pricingDetails?.perSecondCents;
  const byResolution = perSecond?.byResolution ?? {};
  const resolutionEntries = Object.entries(byResolution)
    .map(([label, cents]) => ({
      label,
      cents: typeof cents === 'number' ? applyDisplayedPriceMarginCents(cents) : null,
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
    const audioOffDelta = entry.engine?.pricingDetails?.addons?.audio_off?.perSecondCents;
    const audioOffCents =
      typeof audioOffDelta === 'number' && typeof perSecond?.default === 'number'
        ? applyDisplayedPriceMarginCents(perSecond.default + audioOffDelta)
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

function localizeSpecDetailValue(
  value: string,
  locale: AppLocale,
  labels: { pending: string; supported: string; notSupported: string }
): string {
  const normalized = value.trim();
  const lower = normalized.toLowerCase();
  if (lower === 'supported') return labels.supported;
  if (lower === 'not supported') return labels.notSupported;
  if (lower === 'data pending') return labels.pending;
  if (lower.startsWith('supported (') && normalized.endsWith(')')) {
    const detail = normalized.slice(normalized.indexOf('(') + 1, -1);
    return `${labels.supported} (${localizeSpecDetailValue(detail, locale, labels)})`;
  }
  if (lower.startsWith('not supported (') && normalized.endsWith(')')) {
    const detail = normalized.slice(normalized.indexOf('(') + 1, -1);
    return `${labels.notSupported} (${localizeSpecDetailValue(detail, locale, labels)})`;
  }
  if (lower === 'prompt-based only') {
    return locale === 'fr' ? 'Via prompt uniquement' : locale === 'es' ? 'Solo mediante prompt' : normalized;
  }
  if (lower === 'single start image') {
    return locale === 'fr' ? 'une seule image de départ' : locale === 'es' ? 'una sola imagen inicial' : normalized;
  }
  if (lower === 'multi reference stills') {
    return locale === 'fr'
      ? 'plusieurs stills de référence'
      : locale === 'es'
        ? 'varios stills de referencia'
        : normalized;
  }
  if (lower === 'source clip for extend / retake') {
    return locale === 'fr'
      ? 'clip source pour extension / retake'
      : locale === 'es'
        ? 'clip fuente para extensión / retake'
        : normalized;
  }
  if (lower === 'source clip for modify / reframe') {
    return locale === 'fr'
      ? 'clip source pour modify / reframe'
      : locale === 'es'
        ? 'clip fuente para modify / reframe'
        : normalized;
  }
  if (lower === 'start + end image in i2v') {
    return locale === 'fr'
      ? 'image de départ + image de fin en image → vidéo'
      : locale === 'es'
        ? 'imagen inicial + imagen final en imagen → video'
        : normalized;
  }
  if (lower === 'reframe workflow') {
    return locale === 'fr' ? 'workflow reframe' : locale === 'es' ? 'workflow reframe' : normalized;
  }
  if (lower === 'modify / reframe workflows') {
    return locale === 'fr'
      ? 'workflows modify / reframe'
      : locale === 'es'
        ? 'workflows modify / reframe'
        : normalized;
  }
  if (lower === 'extend / retake workflows') {
    return locale === 'fr'
      ? 'workflows extension / retake'
      : locale === 'es'
        ? 'workflows de extensión / retake'
        : normalized;
  }
  if (lower === 'no (maxvideoai)') {
    return locale === 'fr' ? 'Non (MaxVideoAI)' : locale === 'es' ? 'No (MaxVideoAI)' : normalized;
  }
  return value;
}

function renderSpecValue(
  value: string,
  locale: AppLocale,
  labels: { pending: string; supported: string; notSupported: string }
) {
  const normalized = value.toLowerCase();
  const localizedValue = localizeSpecDetailValue(value, locale, labels);
  if (
    normalized === labels.supported.toLowerCase() ||
    normalized === 'supported' ||
    normalized.startsWith('supported ') ||
    normalized.startsWith('supported (')
  ) {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 p-1">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white" aria-hidden>
          ✓
        </span>
      </span>
    );
  }
  if (
    normalized === labels.notSupported.toLowerCase() ||
    normalized === 'not supported' ||
    normalized.startsWith('not supported ') ||
    normalized.startsWith('not supported (')
  ) {
    return (
      <span className="inline-flex items-center rounded-full border border-rose-500/30 bg-rose-500/10 p-1">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white" aria-hidden>
          ✕
        </span>
      </span>
    );
  }
  if (normalized === 'data pending') {
    return <span>{labels.pending}</span>;
  }
  return <span>{localizedValue}</span>;
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

function renderShowdownMedia(
  side: ShowdownSide,
  fallbackLabel: string,
  placeholderLabel: string,
  noPreviewLabel: string,
  aspectRatio?: string,
  mediaAlt?: string
) {
  const label = side.label ?? fallbackLabel;
  const altText =
    mediaAlt ??
    getImageAlt({
      kind: 'renderThumb',
      engine: label,
      label,
      locale: 'en',
    });
  const emptyLabel = side.placeholder ? placeholderLabel : noPreviewLabel;
  const isPortrait = aspectRatio === '9:16';
  const mediaClass = isPortrait ? 'object-contain' : 'object-cover';
  return (
    <div className="stack-gap-sm">
      <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{label}</p>
      <div
        className={clsx(
          'relative aspect-video overflow-hidden rounded-card border border-hairline',
          isPortrait ? 'bg-black/10 dark:bg-black/40' : 'bg-placeholder'
        )}
      >
        {side.videoUrl ? (
          <video
            className={clsx('h-full w-full', mediaClass)}
            controls
            preload="none"
            poster={side.posterUrl}
            playsInline
            aria-label={altText}
          >
            <source src={side.videoUrl} />
          </video>
        ) : side.posterUrl ? (
          <Image
            src={side.posterUrl}
            alt={altText}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className={clsx('h-full w-full', mediaClass)}
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-text-muted">
            {emptyLabel}
          </div>
        )}
      </div>
    </div>
  );
}

function buildGenerateHref(engineSlug: string, prompt?: string | null, aspectRatio?: string | null, mode?: string | null) {
  const params = new URLSearchParams({ engine: engineSlug });
  if (prompt) {
    params.set('prompt', prompt);
  }
  if (aspectRatio) {
    params.set('ar', aspectRatio);
  }
  if (mode) {
    params.set('mode', mode);
  }
  return `/app?${params.toString()}`;
}

function pickCapabilityDifference(
  left: EngineCatalogEntry,
  right: EngineCatalogEntry,
  label: string,
  leftStatus: string,
  rightStatus: string,
  templates: { value: string; pending: string },
  validatingLabel: string
): string {
  const leftNormalized = leftStatus.toLowerCase();
  const rightNormalized = rightStatus.toLowerCase();
  const leftPending = leftNormalized.includes('pending') || leftNormalized.includes('validated');
  const rightPending = rightNormalized.includes('pending') || rightNormalized.includes('validated');
  if (!leftPending && !rightPending && leftStatus !== rightStatus) {
    return formatTemplate(templates.value, {
      label,
      left: formatEngineName(left),
      right: formatEngineName(right),
      leftValue: leftStatus.toLowerCase(),
      rightValue: rightStatus.toLowerCase(),
    });
  }
  return formatTemplate(templates.pending, {
    label,
    status: leftStatus === rightStatus ? leftStatus.toLowerCase() : validatingLabel,
  });
}

function pickOutputDifference(
  leftLabel: string,
  rightLabel: string,
  leftValue: string,
  rightValue: string,
  label: string,
  templates: { value: string; pending: string },
  validatingLabel: string
): string {
  const leftPending = leftValue.toLowerCase().includes('pending') || leftValue.toLowerCase().includes('validated');
  const rightPending = rightValue.toLowerCase().includes('pending') || rightValue.toLowerCase().includes('validated');
  if (!leftPending && !rightPending && leftValue !== rightValue) {
    return formatTemplate(templates.value, {
      label,
      left: leftLabel,
      right: rightLabel,
      leftValue,
      rightValue,
    });
  }
  return formatTemplate(templates.pending, {
    label,
    status: validatingLabel,
  });
}

type ComparePageCopy = {
  meta?: {
    title?: string;
    description?: string;
    titleFallback?: string;
    descriptionFallback?: string;
    slugOverrides?: Record<string, { title?: string; description?: string }>;
  };
  hero?: {
    back?: string;
    kicker?: string;
    intro?: string;
    introPrelaunch?: string;
    takeawaysTitle?: string;
    lastUpdatedLabel?: string;
  };
  scorecard?: {
    title?: string;
    subtitle?: string;
    provisionalNote?: string;
    strengthsLabel?: string;
    winnerSummary?: string;
    winnerSummaryPrelaunch?: string;
    generateWith?: string;
    fullProfile?: string;
  };
  labels?: {
    pending?: string;
    supported?: string;
    notSupported?: string;
    na?: string;
    prompt?: string;
    tryPrompt?: string;
    tryPromptPrelaunch?: string;
    opensGenerator?: string;
    opensGeneratorPrelaunch?: string;
    savePromptForLaunch?: string;
    whatTests?: string;
    placeholder?: string;
    copyPrompt?: string;
    copied?: string;
    expandPrompt?: string;
    collapsePrompt?: string;
  };
  keySpecs?: { title?: string; subtitle?: string; keyLabel?: string };
  specLabels?: Record<string, string>;
  showdown?: { title?: string; subtitle?: string; subtitlePrelaunch?: string; note?: string; footer?: string };
  related?: { title?: string; subtitle?: string };
  prelaunch?: { title?: string; notice?: string };
  faq?: {
    title?: string;
    subtitle?: string;
    validating?: string;
    pricingDiff?: string;
    capabilityDiff?: string;
    capabilityPending?: string;
    outputDiff?: string;
    outputPending?: string;
    capabilityLabel?: string;
    outputLabel?: string;
    q1?: string;
    a1?: string;
    q2?: string;
    a2?: string;
    q3?: string;
    a3?: string;
    q4?: string;
    a4?: string;
    q5?: string;
    a5?: string;
    q6?: string;
    a6?: string;
    q7?: string;
    a7?: string;
    q8?: string;
    a8?: string;
    q9?: string;
    a9?: string;
    q10?: string;
    a10?: string;
    q11?: string;
    a11?: string;
  };
  summary?: {
    scorecardLabel?: string;
    scorecardLabelPrelaunch?: string;
    pricingLabel?: string;
    durationLabel?: string;
    scorecardTemplate?: string;
    scorecardTemplatePrelaunch?: string;
    pricingTemplate?: string;
    durationTemplate?: string;
    specTemplate?: string;
    resolutionTemplate?: string;
    bestLabel?: string;
  };
  metrics?: Record<string, { label?: string; tooltip?: string }>;
  breadcrumb?: { root?: string };
};

type ComparePageOverride = {
  meta?: {
    title?: string;
    description?: string;
  };
  heroIntro?: string;
  topCards?: Array<{
    title: string;
    body: string;
  }>;
  primaryLinksTitle?: string;
  primaryLinks?: Array<{
    href: string;
    label: string;
  }>;
  faq?: {
    title?: string;
    subtitle?: string;
    items: Array<{
      question: string;
      answer: string | string[];
    }>;
  };
};

const COMPARE_PAGE_OVERRIDES: Partial<Record<AppLocale, Record<string, ComparePageOverride>>> = {
  en: {
    'seedance-1-5-pro-vs-seedance-2-0': {
      meta: {
        title: 'Seedance 1.5 Pro vs Seedance 2.0 | What Changed, Upgrade Path & Best Use Cases | MaxVideoAI',
        description:
          'Compare Seedance 1.5 Pro vs Seedance 2.0 on MaxVideoAI to see what changed in audio, multi-shot continuity, references, pricing, and when upgrading makes sense.',
      },
      heroIntro:
        'Compare Seedance 1.5 Pro and Seedance 2.0 to see what changed between the older Seedance Pro workflow and the current Seedance AI video model in native audio, multi-shot continuity, and reference workflows. Use this page to understand the trade-offs quickly before moving to the current Seedance model, the Seedance AI video examples page, or the exact Seedance video workflow that fits your use case.',
      topCards: [
        {
          title: 'What changed',
          body:
            'Seedance 2.0 is the newer Seedance AI video workflow with stronger multi-shot continuity, broader reference inputs, and a more current audio-first production path than Seedance 1.5 Pro.',
        },
        {
          title: 'When to stay on Seedance 1.5 Pro',
          body:
            'Stay on Seedance 1.5 Pro when you mainly need short, repeatable clips, simpler camera setups, and an older workflow that is already validated in production.',
        },
        {
          title: 'When to upgrade to Seedance 2.0',
          body:
            'Upgrade when you need better shot-to-shot continuity, richer native audio workflows, or a more flexible current model for higher-value creative work.',
        },
        {
          title: 'Best use cases',
          body:
            'Use this page to decide between a supported older Seedance workflow for short controlled clips and the current Seedance 2.0 workflow for multi-shot ads, launches, and more ambitious reference-driven sequences.',
        },
      ],
      primaryLinksTitle: 'Recommended next steps',
      primaryLinks: [
        {
          href: '/models/seedance-2-0',
          label: 'Open Seedance 2.0 model page',
        },
        {
          href: '/examples/seedance',
          label: 'View Seedance AI video examples',
        },
        {
          href: '/models/seedance-2-0-fast',
          label: 'Open Seedance 2.0 Fast model page',
        },
        {
          href: '/ai-video-engines/seedance-2-0-vs-seedance-2-0-fast',
          label: 'Compare Seedance 2.0 vs Seedance 2.0 Fast',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Short answers to help you decide whether to stay on Seedance 1.5 Pro or move to Seedance 2.0.',
        items: [
          {
            question: 'What changed between Seedance 1.5 Pro and Seedance 2.0?',
            answer:
              'Seedance 2.0 is the newer model with stronger multi-shot continuity, broader reference workflows, and the current Seedance path for production work. Seedance 1.5 Pro remains useful for shorter, simpler, repeatable clips.',
          },
          {
            question: 'Is Seedance 2.0 better than Seedance 1.5 Pro?',
            answer:
              'For most current workflows, yes. Seedance 2.0 is the better default if you want the current Seedance AI video model for continuity, flexibility, and broader production use, while Seedance 1.5 Pro remains useful as an older Seedance Pro setup for shorter clips.',
          },
          {
            question: 'When should I upgrade from Seedance 1.5 Pro to Seedance 2.0?',
            answer:
              'Upgrade when you need better multi-shot behavior, richer native audio workflows, or more headroom for current prompt and reference-driven production. If your existing 1.5 Pro workflow is already stable for short clips, you do not need to move every job immediately.',
          },
          {
            question: 'Is Seedance 1.5 Pro still good enough for some workflows?',
            answer:
              'Yes. It still fits short, repeatable cinematic clips and teams that already have validated prompt patterns on 1.5 Pro and do not need the broader 2.0 workflow yet.',
          },
          {
            question: 'Which model is better for multi-shot and native audio?',
            answer:
              'Seedance 2.0 is the better choice for multi-shot continuity and the more current native-audio workflow. Seedance 1.5 Pro is better treated as a simpler older option for shorter clips.',
          },
        ],
      },
    },
    'seedance-2-0-vs-seedance-2-0-fast': {
      heroIntro:
        'Compare Seedance 2.0 and Seedance 2.0 Fast to choose the right current Seedance AI video workflow for final multi-shot work, native audio, and workflow comparison. Use this page to see when standard Seedance is better for polished Seedance video output and when Fast is better for testing, timing checks, and cheaper iteration.',
      primaryLinksTitle: 'Recommended next steps',
      primaryLinks: [
        {
          href: '/models/seedance-2-0',
          label: 'Open Seedance 2.0 model page',
        },
        {
          href: '/examples/seedance',
          label: 'View Seedance AI video examples',
        },
        {
          href: '/models/seedance-2-0-fast',
          label: 'Open Seedance 2.0 Fast model page',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Short answers to help you choose the right current Seedance workflow.',
        items: [
          {
            question: 'Which Seedance AI video model should I use for draft work?',
            answer:
              'Use Seedance 2.0 Fast for cheaper draft passes, faster testing, and workflow comparisons. Use Seedance 2.0 when you want stronger final-quality multi-shot output, native audio, and a more production-ready workflow.',
          },
          {
            question: 'How is Seedance 2.0 different from Seedance 2.0 Fast?',
            answer:
              'Seedance 2.0 is the stronger current choice for polished multi-shot work, native audio, and more demanding reference-driven outputs, while Seedance 2.0 Fast is better for cheaper drafts, timing checks, and early iteration.',
          },
          {
            question: 'Is Seedance 2.0 better for polished Seedance video output?',
            answer:
              'Yes. Seedance 2.0 is the better fit when the goal is polished Seedance video output, while Fast is the better fit when the goal is to test ideas and compare workflows quickly.',
          },
        ],
      },
    },
    'veo-3-1-vs-veo-3-1-fast': {
      heroIntro:
        'Compare Veo 3.1 and Veo 3.1 Fast to choose the right current Veo 3 AI workflow for polished text-to-video, image-to-video, faster draft passes, and native-audio control.',
      faq: {
        title: 'FAQ',
        subtitle:
          'Short answers to help you choose the right current Veo workflow.',
        items: [
          {
            question: 'How should I use Veo 3 for text-to-video and draft testing?',
            answer:
              'Use Veo 3.1 Fast for cheaper draft passes, text-to-video prompt comparison, and quicker iteration. Use Veo 3.1 when you want stronger final-quality output, richer reference-guided control, and more polished image-to-video results.',
          },
          {
            question: 'Can I use both Veo 3.1 and Veo 3.1 Fast for image-to-video?',
            answer:
              'Yes. Both can handle image-to-video workflows, but Veo 3.1 is the better fit for more polished results while Veo 3.1 Fast is the better fit for cheaper prompt and framing tests.',
          },
          {
            question: 'When should I choose Veo 3.1 instead of Veo 3.1 Fast?',
            answer:
              'Choose Veo 3.1 when final quality, native audio polish, and stronger reference-guided control matter more than draft speed. Choose Fast when the goal is cheaper iteration and quicker workflow validation.',
          },
        ],
      },
    },
    'veo-3-1-fast-vs-veo-3-1-lite': {
      heroIntro:
        'Compare Veo 3.1 Fast and Veo 3.1 Lite to choose the right current Veo 3 AI workflow for cheaper text-to-video drafts, image-to-video tests, native-audio behavior, and faster iteration.',
      faq: {
        title: 'FAQ',
        subtitle:
          'Short answers to help you choose between the current Fast and Lite Veo tiers.',
        items: [
          {
            question: 'Which Veo 3 model is better for image-to-video tests?',
            answer:
              'Both can work, but Veo 3.1 Lite is better for the cheapest audio-ready image-to-video tests, while Veo 3.1 Fast is better when you want broader flexibility and a smoother upgrade path into full Veo 3.1.',
          },
          {
            question: 'Is Veo 3.1 Lite or Veo 3.1 Fast better for text-to-video drafts?',
            answer:
              'Veo 3.1 Lite is better when you want the lowest-cost audio-ready drafts. Veo 3.1 Fast is better when you want more output flexibility, optional audio, and a cleaner bridge into the main Veo 3.1 workflow.',
          },
          {
            question: 'When should I choose Veo 3.1 Fast instead of Veo 3.1 Lite?',
            answer:
              'Choose Fast when you want broader workflow flexibility, optional audio control, and an easier upgrade path into Veo 3.1. Choose Lite when your priority is the cheapest current Veo testing with audio always on.',
          },
        ],
      },
    },
    'kling-3-pro-vs-kling-3-standard': {
      heroIntro:
        'Compare Kling 3 Pro and Kling 3 Standard to choose the right current Kling AI model for multi-shot video, Kling image-to-video workflows, reusable Kling Elements, and native-audio output quality.',
      faq: {
        title: 'FAQ',
        subtitle:
          'Short answers to help you choose between the current Kling Pro and Standard tiers.',
        items: [
          {
            question: 'Which current Kling AI model is better for image-to-video and prompt testing?',
            answer:
              'Kling 3 Standard is better for lower-cost prompt testing and repeatable image-to-video drafts, while Kling 3 Pro is better when you need tighter scene control and higher-priority final outputs.',
          },
          {
            question: 'Do Kling 3 Pro and Kling 3 Standard both support Kling Elements?',
            answer:
              'Yes. Both current Kling models support Kling Elements for character and prop continuity, but Kling 3 Pro is the stronger choice when the sequence is more demanding or continuity matters more.',
          },
          {
            question: 'When should I choose Kling 3 Pro instead of Kling 3 Standard?',
            answer:
              'Choose Kling 3 Pro when you need stronger scene control, more demanding multi-shot continuity, and higher-priority final output. Choose Kling 3 Standard when cost control and repeatable draft testing matter more.',
          },
        ],
      },
    },
  },
  fr: {
    'seedance-1-5-pro-vs-seedance-2-0': {
      meta: {
        title: 'Seedance 1.5 Pro vs Seedance 2.0 | Ce qui change, quand passer a 2.0 et meilleurs cas d usage | MaxVideoAI',
        description:
          'Comparez Seedance 1.5 Pro et Seedance 2.0 sur MaxVideoAI pour voir ce qui change sur l audio, la continuite multi-shot, les references, le prix, et quand passer a 2.0.',
      },
      heroIntro:
        'Comparez Seedance 1.5 Pro et Seedance 2.0 pour voir ce qui change entre l ancien workflow Seedance Pro et le modele video IA Seedance actuel sur l audio natif, la continuite multi-shot et les workflows a references. Utilisez cette page pour comprendre rapidement les compromis avant d ouvrir le modele Seedance actuel, la page d exemples video IA Seedance, ou le workflow video Seedance le plus adapte a votre usage.',
      topCards: [
        {
          title: 'Ce qui change',
          body:
            'Seedance 2.0 est le workflow video IA Seedance le plus recent, avec une meilleure continuite multi-shot, des entrees de reference plus larges, et une approche audio-first plus actuelle que Seedance 1.5 Pro.',
        },
        {
          title: 'Quand rester sur Seedance 1.5 Pro',
          body:
            'Restez sur Seedance 1.5 Pro si vous avez surtout besoin de clips courts et repetables, de setups camera plus simples, et d un workflow plus ancien deja valide en production.',
        },
        {
          title: 'Quand passer a Seedance 2.0',
          body:
            'Passez a Seedance 2.0 si vous avez besoin d une meilleure continuite entre plans, de workflows audio natifs plus riches, ou d un modele actuel plus flexible pour un travail creatif a plus forte valeur.',
        },
        {
          title: 'Meilleurs cas d usage',
          body:
            'Cette page sert a choisir entre un workflow Seedance plus ancien mais encore supporte pour des clips courts et controles, et le workflow Seedance 2.0 actuel pour des pubs multi-shot, des lancements, et des sequences plus ambitieuses guidees par references.',
        },
      ],
      primaryLinksTitle: 'Parcours recommande',
      primaryLinks: [
        {
          href: '/models/seedance-2-0',
          label: 'Ouvrir la page modele Seedance 2.0',
        },
        {
          href: '/examples/seedance',
          label: 'Voir les exemples video IA Seedance',
        },
        {
          href: '/models/seedance-2-0-fast',
          label: 'Ouvrir la page modele Seedance 2.0 Fast',
        },
        {
          href: '/ai-video-engines/seedance-2-0-vs-seedance-2-0-fast',
          label: 'Comparer Seedance 2.0 vs Seedance 2.0 Fast',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Reponses rapides pour decider s il faut rester sur Seedance 1.5 Pro ou passer a Seedance 2.0.',
        items: [
          {
            question: 'Qu est-ce qui change entre Seedance 1.5 Pro et Seedance 2.0 ?',
            answer:
              'Seedance 2.0 est le modele le plus recent, avec une meilleure continuite multi-shot, des workflows de reference plus larges, et le chemin Seedance actuel pour la production. Seedance 1.5 Pro reste utile pour des clips plus courts, plus simples et repetables.',
          },
          {
            question: 'Seedance 2.0 est-il meilleur que Seedance 1.5 Pro ?',
            answer:
              'Pour la plupart des workflows actuels, oui. Seedance 2.0 est le meilleur choix par defaut si vous cherchez le modele video IA Seedance actuel pour plus de continuite, plus de flexibilite et un usage de production plus large, tandis que Seedance 1.5 Pro reste utile comme setup Seedance Pro plus ancien pour des clips courts.',
          },
          {
            question: 'Quand faut-il passer de Seedance 1.5 Pro a Seedance 2.0 ?',
            answer:
              'Passez a 2.0 si vous avez besoin d un meilleur comportement multi-shot, de workflows audio natifs plus riches, ou de plus de marge pour des productions actuelles basees sur prompts et references. Si votre workflow 1.5 Pro est deja stable sur des clips courts, vous n avez pas besoin de migrer tous les jobs tout de suite.',
          },
          {
            question: 'Seedance 1.5 Pro est-il encore suffisant pour certains workflows ?',
            answer:
              'Oui. Il reste adapte a des clips cinematographiques courts et repetables, ainsi qu aux equipes qui ont deja des prompts valides sur 1.5 Pro et n ont pas encore besoin du workflow 2.0 plus large.',
          },
          {
            question: 'Quel modele est le meilleur pour le multi-shot et l audio natif ?',
            answer:
              'Seedance 2.0 est le meilleur choix pour la continuite multi-shot et pour le workflow audio natif le plus actuel. Seedance 1.5 Pro doit plutot etre traite comme une option plus simple et plus ancienne pour des clips courts.',
          },
        ],
      },
    },
    'seedance-2-0-vs-seedance-2-0-fast': {
      heroIntro:
        'Comparez Seedance 2.0 et Seedance 2.0 Fast pour choisir le bon workflow video IA Seedance actuel selon votre besoin de rendu multi-shot final, d audio natif et de comparaison de workflow. Utilisez cette page pour voir quand le Seedance standard convient mieux a une sortie video Seedance soignee et quand Fast convient mieux aux tests, aux checks de timing et a l iteration moins couteuse.',
      primaryLinksTitle: 'Parcours recommande',
      primaryLinks: [
        {
          href: '/models/seedance-2-0',
          label: 'Ouvrir la page modele Seedance 2.0',
        },
        {
          href: '/examples/seedance',
          label: 'Voir les exemples video IA Seedance',
        },
        {
          href: '/models/seedance-2-0-fast',
          label: 'Ouvrir la page modele Seedance 2.0 Fast',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Reponses courtes pour choisir le bon workflow Seedance actuel.',
        items: [
          {
            question: 'Quel modele video IA Seedance faut-il utiliser pour le travail de draft ?',
            answer:
              'Utilisez Seedance 2.0 Fast pour des drafts moins couteux, des tests plus rapides et des comparaisons de workflow. Utilisez Seedance 2.0 quand vous voulez une sortie multi-shot plus aboutie, l audio natif et un workflow plus pret pour la production.',
          },
          {
            question: 'Quelle difference entre Seedance 2.0 et Seedance 2.0 Fast ?',
            answer:
              'Seedance 2.0 est le choix actuel le plus solide pour un rendu multi-shot soigne, l audio natif et des sorties a references plus exigeantes, tandis que Seedance 2.0 Fast convient mieux aux drafts moins couteux, aux checks de timing et a l iteration initiale.',
          },
          {
            question: 'Seedance 2.0 est-il meilleur pour une sortie video Seedance soignee ?',
            answer:
              'Oui. Seedance 2.0 convient mieux quand l objectif est une sortie video Seedance soignee, tandis que Fast convient mieux quand l objectif est de tester des idees et de comparer rapidement des workflows.',
          },
        ],
      },
    },
    'veo-3-1-vs-veo-3-1-fast': {
      heroIntro:
        'Comparez Veo 3.1 et Veo 3.1 Fast pour choisir le bon workflow video IA Veo 3 actuel selon votre besoin de texte-to-video soigne, d image-to-video, de drafts plus rapides et de controle sur l audio natif.',
      faq: {
        title: 'FAQ',
        subtitle:
          'Reponses courtes pour choisir le bon workflow Veo actuel.',
        items: [
          {
            question: 'Comment utiliser Veo 3 pour le texte-to-video et les drafts ?',
            answer:
              'Utilisez Veo 3.1 Fast pour des drafts moins chers, la comparaison de prompts texte-to-video et une iteration plus rapide. Utilisez Veo 3.1 quand vous voulez une sortie finale plus solide, un meilleur controle guide par references et des resultats image-to-video plus soignes.',
          },
          {
            question: 'Peut-on utiliser Veo 3.1 et Veo 3.1 Fast pour l image-to-video ?',
            answer:
              'Oui. Les deux peuvent gerer des workflows image-to-video, mais Veo 3.1 convient mieux a des resultats plus aboutis, tandis que Veo 3.1 Fast convient mieux a des tests de prompt et de cadrage moins chers.',
          },
          {
            question: 'Quand faut-il choisir Veo 3.1 plutot que Veo 3.1 Fast ?',
            answer:
              'Choisissez Veo 3.1 quand la qualite finale, la finition sur l audio natif et un meilleur controle guide par references comptent plus que la vitesse de draft. Choisissez Fast quand l objectif est une iteration moins chere et une validation de workflow plus rapide.',
          },
        ],
      },
    },
    'veo-3-1-fast-vs-veo-3-1-lite': {
      heroIntro:
        'Comparez Veo 3.1 Fast et Veo 3.1 Lite pour choisir le bon workflow video IA Veo 3 actuel selon votre besoin de drafts texte-to-video moins chers, de tests image-to-video, de comportement audio et d iteration plus rapide.',
      faq: {
        title: 'FAQ',
        subtitle:
          'Reponses courtes pour choisir entre les tiers Veo Fast et Lite actuels.',
        items: [
          {
            question: 'Quel modele Veo 3 convient le mieux pour des tests image-to-video ?',
            answer:
              'Les deux peuvent convenir, mais Veo 3.1 Lite est plus adapte aux tests image-to-video audio-ready les moins chers, tandis que Veo 3.1 Fast est plus adapte quand vous voulez plus de flexibilite et une montee plus fluide vers Veo 3.1.',
          },
          {
            question: 'Veo 3.1 Lite ou Veo 3.1 Fast convient mieux a des drafts texte-to-video ?',
            answer:
              'Veo 3.1 Lite convient mieux quand vous voulez les drafts audio-ready les moins chers. Veo 3.1 Fast convient mieux quand vous voulez plus de flexibilite, un audio optionnel et un pont plus propre vers le workflow principal Veo 3.1.',
          },
          {
            question: 'Quand faut-il choisir Veo 3.1 Fast plutot que Veo 3.1 Lite ?',
            answer:
              'Choisissez Fast quand vous voulez plus de flexibilite de workflow, un controle audio optionnel et un chemin de montee plus simple vers Veo 3.1. Choisissez Lite quand votre priorite est le testing Veo actuel le moins cher avec audio toujours actif.',
          },
        ],
      },
    },
    'kling-3-pro-vs-kling-3-standard': {
      heroIntro:
        'Comparez Kling 3 Pro et Kling 3 Standard pour choisir le bon modele Kling IA actuel pour la video multi-shot, les workflows Kling en image-vers-video, les Kling Elements reutilisables et la qualite de sortie avec audio natif.',
      faq: {
        title: 'FAQ',
        subtitle:
          'Reponses courtes pour choisir entre les tiers Kling Pro et Standard actuels.',
        items: [
          {
            question: 'Quel modele Kling IA actuel convient le mieux a l image-vers-video et aux tests de prompt ?',
            answer:
              'Kling 3 Standard convient mieux a des tests de prompt moins couteux et a des drafts image-vers-video repetables, tandis que Kling 3 Pro convient mieux quand vous avez besoin d un controle de scene plus serre et de sorties finales plus prioritaires.',
          },
          {
            question: 'Kling 3 Pro et Kling 3 Standard supportent-ils tous les deux les Kling Elements ?',
            answer:
              'Oui. Les deux modeles Kling actuels supportent les Kling Elements pour la continuite des personnages et des props, mais Kling 3 Pro reste le meilleur choix quand la sequence est plus exigeante ou que la continuite compte davantage.',
          },
          {
            question: 'Quand faut-il choisir Kling 3 Pro plutot que Kling 3 Standard ?',
            answer:
              'Choisissez Kling 3 Pro quand vous avez besoin d un meilleur controle de scene, d une continuite multi-shot plus exigeante et d une sortie finale plus prioritaire. Choisissez Kling 3 Standard quand le controle des couts et les tests repetables comptent davantage.',
          },
        ],
      },
    },
  },
  es: {
    'seedance-1-5-pro-vs-seedance-2-0': {
      meta: {
        title: 'Seedance 1.5 Pro vs Seedance 2.0 | Que cambio, cuando actualizar y mejores casos de uso | MaxVideoAI',
        description:
          'Compara Seedance 1.5 Pro y Seedance 2.0 en MaxVideoAI para ver que cambia en audio, continuidad multi-shot, referencias, precio y cuando conviene actualizar.',
      },
      heroIntro:
        'Compara Seedance 1.5 Pro y Seedance 2.0 para ver que cambio entre el workflow Seedance Pro anterior y el modelo de video IA de Seedance actual en audio nativo, continuidad multi-shot y workflows con referencias. Usa esta pagina para entender rapido los trade-offs antes de abrir el modelo Seedance actual, la pagina de ejemplos de video IA de Seedance o el workflow de video de Seedance que mejor encaja con tu caso de uso.',
      topCards: [
        {
          title: 'Que cambio',
          body:
            'Seedance 2.0 es el workflow de video IA de Seedance mas reciente, con mejor continuidad multi-shot, entradas de referencia mas amplias y un camino de produccion audio-first mas actual que Seedance 1.5 Pro.',
        },
        {
          title: 'Cuando quedarse en Seedance 1.5 Pro',
          body:
            'Quedate en Seedance 1.5 Pro cuando necesites sobre todo clips cortos y repetibles, setups de camara mas simples y un workflow anterior que ya esta validado en produccion.',
        },
        {
          title: 'Cuando pasar a Seedance 2.0',
          body:
            'Actualiza cuando necesites mejor continuidad entre tomas, workflows de audio nativo mas ricos o un modelo actual mas flexible para trabajo creativo de mayor valor.',
        },
        {
          title: 'Mejores casos de uso',
          body:
            'Usa esta pagina para decidir entre un workflow Seedance anterior pero aun compatible para clips cortos y controlados, y el workflow actual de Seedance 2.0 para anuncios multi-shot, lanzamientos y secuencias mas ambiciosas guiadas por referencias.',
        },
      ],
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        {
          href: '/models/seedance-2-0',
          label: 'Abrir la pagina del modelo Seedance 2.0',
        },
        {
          href: '/examples/seedance',
          label: 'Ver ejemplos de video IA de Seedance',
        },
        {
          href: '/models/seedance-2-0-fast',
          label: 'Abrir la pagina del modelo Seedance 2.0 Fast',
        },
        {
          href: '/ai-video-engines/seedance-2-0-vs-seedance-2-0-fast',
          label: 'Comparar Seedance 2.0 vs Seedance 2.0 Fast',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Respuestas rapidas para decidir si conviene quedarse en Seedance 1.5 Pro o pasar a Seedance 2.0.',
        items: [
          {
            question: 'Que cambio entre Seedance 1.5 Pro y Seedance 2.0?',
            answer:
              'Seedance 2.0 es el modelo mas nuevo, con mejor continuidad multi-shot, workflows de referencia mas amplios y el camino Seedance actual para produccion. Seedance 1.5 Pro sigue siendo util para clips mas cortos, simples y repetibles.',
          },
          {
            question: 'Es Seedance 2.0 mejor que Seedance 1.5 Pro?',
            answer:
              'Para la mayoria de workflows actuales, si. Seedance 2.0 es la mejor opcion por defecto si quieres el modelo de video IA de Seedance actual para mas continuidad, flexibilidad y un uso de produccion mas amplio, mientras que Seedance 1.5 Pro sigue siendo util como setup Seedance Pro anterior para clips mas cortos.',
          },
          {
            question: 'Cuando deberia pasar de Seedance 1.5 Pro a Seedance 2.0?',
            answer:
              'Actualiza cuando necesites mejor comportamiento multi-shot, workflows de audio nativo mas ricos o mas margen para produccion actual basada en prompts y referencias. Si tu workflow de 1.5 Pro ya es estable para clips cortos, no hace falta mover todos los trabajos de inmediato.',
          },
          {
            question: 'Sigue siendo suficiente Seedance 1.5 Pro para algunos workflows?',
            answer:
              'Si. Sigue encajando en clips cinematicos cortos y repetibles, y en equipos que ya tienen patrones de prompt validados en 1.5 Pro y todavia no necesitan el workflow mas amplio de 2.0.',
          },
          {
            question: 'Que modelo es mejor para multi-shot y audio nativo?',
            answer:
              'Seedance 2.0 es la mejor opcion para continuidad multi-shot y para el workflow de audio nativo mas actual. Seedance 1.5 Pro conviene tratarlo como una opcion anterior mas simple para clips cortos.',
          },
        ],
      },
    },
    'seedance-2-0-vs-seedance-2-0-fast': {
      heroIntro:
        'Compara Seedance 2.0 y Seedance 2.0 Fast para elegir el workflow de video IA de Seedance actual mas adecuado segun tu necesidad de trabajo multi-shot final, audio nativo y comparacion de workflow. Usa esta pagina para ver cuando el Seedance estandar encaja mejor en una salida de video de Seedance mas pulida y cuando Fast encaja mejor para pruebas, checks de timing e iteracion mas barata.',
      primaryLinksTitle: 'Siguientes pasos recomendados',
      primaryLinks: [
        {
          href: '/models/seedance-2-0',
          label: 'Abrir la pagina del modelo Seedance 2.0',
        },
        {
          href: '/examples/seedance',
          label: 'Ver ejemplos de video IA de Seedance',
        },
        {
          href: '/models/seedance-2-0-fast',
          label: 'Abrir la pagina del modelo Seedance 2.0 Fast',
        },
      ],
      faq: {
        title: 'FAQ',
        subtitle:
          'Respuestas cortas para elegir el workflow actual de Seedance adecuado.',
        items: [
          {
            question: 'Que modelo de video IA de Seedance deberia usar para trabajo de borrador?',
            answer:
              'Usa Seedance 2.0 Fast para borradores mas baratos, pruebas mas rapidas y comparaciones de workflow. Usa Seedance 2.0 cuando quieras una salida multi-shot mas pulida, audio nativo y un workflow mas listo para produccion.',
          },
          {
            question: 'En que se diferencia Seedance 2.0 de Seedance 2.0 Fast?',
            answer:
              'Seedance 2.0 es la opcion actual mas fuerte para trabajo multi-shot pulido, audio nativo y salidas mas exigentes guiadas por referencias, mientras que Seedance 2.0 Fast encaja mejor en borradores mas baratos, checks de timing e iteracion temprana.',
          },
          {
            question: 'Es mejor Seedance 2.0 para una salida de video de Seedance mas pulida?',
            answer:
              'Si. Seedance 2.0 encaja mejor cuando el objetivo es una salida de video de Seedance mas pulida, mientras que Fast encaja mejor cuando el objetivo es probar ideas y comparar workflows rapidamente.',
          },
        ],
      },
    },
    'veo-3-1-vs-veo-3-1-fast': {
      heroIntro:
        'Compara Veo 3.1 y Veo 3.1 Fast para elegir el workflow de video IA Veo 3 actual mas adecuado segun tu necesidad de text-to-video mas pulido, image-to-video, borradores mas rapidos y control sobre el audio nativo.',
      faq: {
        title: 'FAQ',
        subtitle:
          'Respuestas cortas para elegir el workflow Veo actual adecuado.',
        items: [
          {
            question: 'Como deberia usar Veo 3 para text-to-video y borradores?',
            answer:
              'Usa Veo 3.1 Fast para borradores mas baratos, comparacion de prompts text-to-video e iteracion mas rapida. Usa Veo 3.1 cuando quieras una salida final mas fuerte, mejor control guiado por referencias y resultados image-to-video mas pulidos.',
          },
          {
            question: 'Puedo usar tanto Veo 3.1 como Veo 3.1 Fast para image-to-video?',
            answer:
              'Si. Ambos pueden manejar workflows de image-to-video, pero Veo 3.1 encaja mejor en resultados mas pulidos, mientras que Veo 3.1 Fast encaja mejor en pruebas mas baratas de prompt y encuadre.',
          },
          {
            question: 'Cuando deberia elegir Veo 3.1 en lugar de Veo 3.1 Fast?',
            answer:
              'Elige Veo 3.1 cuando la calidad final, el pulido del audio nativo y un mejor control guiado por referencias importan mas que la velocidad del borrador. Elige Fast cuando el objetivo es una iteracion mas barata y una validacion de workflow mas rapida.',
          },
        ],
      },
    },
    'veo-3-1-fast-vs-veo-3-1-lite': {
      heroIntro:
        'Compara Veo 3.1 Fast y Veo 3.1 Lite para elegir el workflow de video IA Veo 3 actual mas adecuado segun tu necesidad de borradores text-to-video mas baratos, pruebas image-to-video, comportamiento del audio e iteracion mas rapida.',
      faq: {
        title: 'FAQ',
        subtitle:
          'Respuestas cortas para elegir entre los tiers Veo Fast y Lite actuales.',
        items: [
          {
            question: 'Que modelo Veo 3 es mejor para pruebas de image-to-video?',
            answer:
              'Los dos pueden servir, pero Veo 3.1 Lite encaja mejor en las pruebas image-to-video con audio mas baratas, mientras que Veo 3.1 Fast encaja mejor cuando quieres mas flexibilidad y una subida mas fluida hacia Veo 3.1.',
          },
          {
            question: 'Veo 3.1 Lite o Veo 3.1 Fast es mejor para borradores text-to-video?',
            answer:
              'Veo 3.1 Lite encaja mejor cuando quieres los borradores con audio mas baratos. Veo 3.1 Fast encaja mejor cuando quieres mas flexibilidad, audio opcional y un puente mas limpio hacia el workflow principal de Veo 3.1.',
          },
          {
            question: 'Cuando deberia elegir Veo 3.1 Fast en lugar de Veo 3.1 Lite?',
            answer:
              'Elige Fast cuando quieras mas flexibilidad de workflow, control opcional del audio y una ruta de subida mas simple hacia Veo 3.1. Elige Lite cuando tu prioridad sea el testing Veo actual mas barato con audio siempre activado.',
          },
        ],
      },
    },
    'kling-3-pro-vs-kling-3-standard': {
      heroIntro:
        'Compara Kling 3 Pro y Kling 3 Standard para elegir el modelo Kling AI actual adecuado para video multi-shot, workflows Kling de imagen-a-video, Kling Elements reutilizables y calidad de salida con audio nativo.',
      faq: {
        title: 'FAQ',
        subtitle:
          'Respuestas cortas para elegir entre los tiers actuales de Kling Pro y Standard.',
        items: [
          {
            question: '¿Que modelo Kling AI actual es mejor para imagen-a-video y pruebas de prompt?',
            answer:
              'Kling 3 Standard es mejor para pruebas de prompt de menor coste y borradores repetibles de imagen-a-video, mientras que Kling 3 Pro es mejor cuando necesitas un control de escena mas preciso y salidas finales mas prioritarias.',
          },
          {
            question: '¿Kling 3 Pro y Kling 3 Standard soportan ambos los Kling Elements?',
            answer:
              'Si. Ambos modelos Kling actuales soportan Kling Elements para continuidad de personajes y props, pero Kling 3 Pro es la mejor opcion cuando la secuencia es mas exigente o la continuidad importa mas.',
          },
          {
            question: '¿Cuando deberia elegir Kling 3 Pro en lugar de Kling 3 Standard?',
            answer:
              'Elige Kling 3 Pro cuando necesites mejor control de escena, continuidad multi-shot mas exigente y una salida final mas prioritaria. Elige Kling 3 Standard cuando importe mas controlar el coste y repetir pruebas de borrador.',
          },
        ],
      },
    },
  },
};

function getComparePageOverride(locale: AppLocale, slug: string): ComparePageOverride | undefined {
  return COMPARE_PAGE_OVERRIDES[locale]?.[slug];
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams?: { order?: string };
}): Promise<Metadata> {
  const locale = params.locale ?? 'en';
  const { dictionary } = await resolveDictionary({ locale });
  const compareCopy = (dictionary.comparePage ?? {}) as ComparePageCopy;
  const slug = params.slug;
  const canonicalInfo = getCanonicalCompareSlug(slug);
  const canonicalSlug = canonicalInfo?.canonicalSlug ?? slug;
  const pageOverride = getComparePageOverride(locale, canonicalSlug);
  const metaOverride = {
    ...(compareCopy.meta?.slugOverrides?.[canonicalSlug] ?? {}),
    ...(pageOverride?.meta ?? {}),
  };
  const resolved = canonicalInfo ? resolveEngines(canonicalInfo.canonicalSlug) : null;
  const pairHasNativeAudio = Boolean(resolved?.left.engine?.audio) || Boolean(resolved?.right.engine?.audio);
  const criteriaCount = pairHasNativeAudio ? 11 : 10;
  const titleTemplate =
    metaOverride.title ?? compareCopy.meta?.title ?? '{left} vs {right} — Side-by-Side Specs, Pricing & Prompt Test | MaxVideoAI';
  const titleFallback =
    compareCopy.meta?.titleFallback ??
    'Compare AI video engines — Side-by-Side Specs, Pricing & Prompt Test | MaxVideoAI';
  const descriptionTemplate = replaceCriteriaCount(
    metaOverride.description ??
      compareCopy.meta?.description ??
      `Compare {left} vs {right} on MaxVideoAI with identical prompts, key specs, and a scorecard across ${criteriaCount} criteria.`,
    criteriaCount
  );
  const descriptionFallback =
    compareCopy.meta?.descriptionFallback ?? 'Side-by-side comparison of AI video engines with MaxVideoAI metrics and guidance.';
  const title = resolved
    ? formatTemplate(titleTemplate, {
        left: formatEngineMetaName(resolved.left),
        right: formatEngineMetaName(resolved.right),
      })
    : titleFallback;
  const description = resolved
    ? formatTemplate(descriptionTemplate, {
        left: formatEngineName(resolved.left),
        right: formatEngineName(resolved.right),
      })
    : descriptionFallback;

  let robots: Metadata['robots'] | undefined;
  if (!isPublishedComparisonSlug(canonicalSlug)) {
    robots = { index: false, follow: true };
  }
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
  if (typeof searchParams?.order === 'string' && searchParams.order.trim()) {
    robots = { index: false, follow: true };
  }

  const meta = buildSeoMetadata({
    locale,
    title,
    description,
    englishPath: `/ai-video-engines/${canonicalSlug}`,
    robots,
  });
  return meta;
}

export default async function CompareDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams?: { order?: string };
}) {
  const activeLocale = params.locale ?? 'en';
  const { dictionary } = await resolveDictionary({ locale: activeLocale });
  const compareCopy = (dictionary.comparePage ?? {}) as ComparePageCopy;
  const labels = {
    pending: compareCopy.labels?.pending ?? 'Data pending',
    supported: compareCopy.labels?.supported ?? 'Supported',
    notSupported: compareCopy.labels?.notSupported ?? 'Not supported',
    na: compareCopy.labels?.na ?? 'N/A',
    prompt: compareCopy.labels?.prompt ?? 'Prompt',
    tryPrompt: compareCopy.labels?.tryPrompt ?? 'Try this prompt:',
    tryPromptPrelaunch: compareCopy.labels?.tryPromptPrelaunch ?? 'Prompt actions:',
    opensGenerator: compareCopy.labels?.opensGenerator ?? 'Opens the generator pre-filled.',
    opensGeneratorPrelaunch:
      compareCopy.labels?.opensGeneratorPrelaunch ??
      'Use these prompt links for planning; pre-launch engines unlock at launch.',
    savePromptForLaunch: compareCopy.labels?.savePromptForLaunch ?? 'Save this prompt for launch',
    whatTests: compareCopy.labels?.whatTests ?? 'What it tests',
    placeholder: compareCopy.labels?.placeholder ?? '',
    expandPrompt: compareCopy.labels?.expandPrompt ?? 'Show full prompt',
    collapsePrompt: compareCopy.labels?.collapsePrompt ?? 'Hide full prompt',
  };
  const slug = params.slug;
  const canonicalInfo = getCanonicalCompareSlug(slug);
  if (!canonicalInfo) {
    notFound();
  }
  const requestedOrder = typeof searchParams?.order === 'string' ? searchParams.order : null;
  const excludedRedirect = resolveExcludedCompareRedirect({
    slug: canonicalInfo.canonicalSlug,
    order: requestedOrder,
    locale: activeLocale,
  });
  if (excludedRedirect) {
    redirect(excludedRedirect);
  }
  const resolved = resolveEngines(canonicalInfo.canonicalSlug);
  if (!resolved) {
    notFound();
  }
  const localePrefix = localePathnames[activeLocale] ? `/${localePathnames[activeLocale]}` : '';
  const compareBase = COMPARE_SLUG_MAP[activeLocale] ?? COMPARE_SLUG_MAP.en ?? 'ai-video-engines';
  const compareHubHref = `${localePrefix}/${compareBase}`.replace(/\/{2,}/g, '/');
  const canonicalSlug = canonicalInfo.canonicalSlug;
  const pageOverride = getComparePageOverride(activeLocale, canonicalSlug);
  const compareHubCanonicalUrl = buildMetadataUrls(activeLocale, undefined, { englishPath: '/ai-video-engines' }).canonical;
  const comparisonCanonicalUrl = buildMetadataUrls(activeLocale, undefined, {
    englishPath: `/ai-video-engines/${canonicalSlug}`,
  }).canonical;
  const metaOverride = {
    ...(compareCopy.meta?.slugOverrides?.[canonicalSlug] ?? {}),
    ...(pageOverride?.meta ?? {}),
  };
  if (canonicalSlug !== slug) {
    const orderParam = requestedOrder ?? canonicalInfo.leftSlug;
    const query = orderParam ? `?order=${orderParam}` : '';
    permanentRedirect(`${localePrefix}/${compareBase}/${canonicalSlug}${query}`.replace(/\/{2,}/g, '/'));
  }
  let { left, right } = resolved;
  const shouldSwapDisplayOrder = Boolean(requestedOrder && requestedOrder === right.modelSlug);
  if (shouldSwapDisplayOrder) {
    [left, right] = [right, left];
  }
  const averageDurations = isDatabaseConfigured() ? await fetchEngineAverageDurations() : [];
  const averageMap = new Map(averageDurations.map((entry) => [entry.engineId, entry.averageDurationMs]));
  const leftAverage = averageMap.get(left.engineId) ?? left.engine?.avgDurationMs ?? null;
  const rightAverage = averageMap.get(right.engineId) ?? right.engine?.avgDurationMs ?? null;
  left = { ...left, engine: { ...left.engine, avgDurationMs: leftAverage } };
  right = { ...right, engine: { ...right.engine, avgDurationMs: rightAverage } };
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
  const pairHasNativeAudio = Boolean(left.engine?.audio) || Boolean(right.engine?.audio);
  const criteriaCount = pairHasNativeAudio ? 11 : 10;
  const compareShowdowns = getCompareShowdowns({ pairHasNativeAudio });
  const exposeSourcePrompt = activeLocale === 'en';
  const [leftPricingDisplay, rightPricingDisplay] = await Promise.all([
    resolvePricingDisplay(left, activeLocale, PRICING_ENGINES.get(left.modelSlug)),
    resolvePricingDisplay(right, activeLocale, PRICING_ENGINES.get(right.modelSlug)),
  ]);
  const leftOverall = computeOverall(leftScore);
  const rightOverall = computeOverall(rightScore);
  const hasPrelaunchEngine = isPrelaunchAvailability(left) || isPrelaunchAvailability(right);
  const prelaunchNotice = hasPrelaunchEngine
    ? {
        title: compareCopy.prelaunch?.title ?? getPrelaunchCompareNotice(activeLocale).title,
        body: compareCopy.prelaunch?.notice ?? getPrelaunchCompareNotice(activeLocale).body,
      }
    : null;
  const heroIntroTemplate = replaceCriteriaCount(
    hasPrelaunchEngine
      ? (compareCopy.hero?.introPrelaunch ??
        `This page compares {left} vs {right} on MaxVideoAI using the same prompts, side-by-side prompts and renders (when available), key specs, and a scorecard across ${criteriaCount} criteria. Use it to shortlist the best fit — then open each engine profile for full specs and prompt examples.`)
      : (pageOverride?.heroIntro ??
        compareCopy.hero?.intro ??
        `This page compares {left} vs {right} on MaxVideoAI using the same prompts, side-by-side renders, key specs, and a scorecard across ${criteriaCount} criteria. Use it to shortlist the best fit — then open each engine profile for full specs and prompt examples.`),
    criteriaCount
  );
  const showdownSubtitle = hasPrelaunchEngine
    ? (compareCopy.showdown?.subtitlePrelaunch ??
      'Side-by-side prompts and renders (when available) on MaxVideoAI. Prompts are identical; outputs may vary by model.')
    : (compareCopy.showdown?.subtitle ??
      'Side-by-side renders from the same prompt on MaxVideoAI. Prompts are identical; outputs may vary by model.');
  const scorecardProvisionalNote = hasPrelaunchEngine
    ? (compareCopy.scorecard?.provisionalNote ??
      'Pre-launch scores are provisional and will update once runtime renders and final pricing are available.')
    : null;
  const prelaunchTryPromptLabel = hasPrelaunchEngine ? labels.tryPromptPrelaunch : labels.tryPrompt;
  const prelaunchOpensGeneratorLabel = hasPrelaunchEngine ? labels.opensGeneratorPrelaunch : labels.opensGenerator;
  const showdownActionLabel = exposeSourcePrompt
    ? prelaunchTryPromptLabel
    : activeLocale === 'fr'
      ? 'Ouvrir le générateur :'
      : activeLocale === 'es'
        ? 'Abrir el generador:'
        : 'Open generator:';
  const showdownActionHint = exposeSourcePrompt
    ? prelaunchOpensGeneratorLabel
    : activeLocale === 'fr'
      ? 'Ouvre le générateur avec ce modèle.'
      : activeLocale === 'es'
        ? 'Abre el generador con este modelo.'
        : 'Opens the generator with this model.';
  const localizedPromptNote = activeLocale === 'fr'
    ? 'Les prompts source restent en anglais pour conserver le meme test entre moteurs.'
    : activeLocale === 'es'
      ? 'Los prompts originales se mantienen en ingles para conservar la misma prueba entre motores.'
      : 'Source prompts stay in English to keep the same test across engines.';
  const winnerSummaryHeading = hasPrelaunchEngine
    ? (compareCopy.scorecard?.winnerSummaryPrelaunch ?? 'Current leader (pre-launch)')
    : (compareCopy.scorecard?.winnerSummary ?? 'Winner summary');
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
  const reversedShowdownSlug = reverseCompareSlug(canonicalSlug);
  const showdownSourceSlug =
    SHOWDOWNS[canonicalSlug] != null ? canonicalSlug : reversedShowdownSlug && SHOWDOWNS[reversedShowdownSlug] != null
      ? reversedShowdownSlug
      : canonicalSlug;
  const showdowns = await hydrateShowdowns(
    SHOWDOWNS[showdownSourceSlug] ?? []
  );
  const normalizePrompt = (value?: string | null) => (value ?? '').trim().toLowerCase();
  const normalizedShowdowns = showdowns.filter(
    (entry): entry is ShowdownEntry => Boolean(entry)
  );
  const showdownsByPrompt = new Map(
    normalizedShowdowns.map((entry) => [normalizePrompt(entry.prompt), entry])
  );
  const showdownsBySlotId = new Map(
    normalizedShowdowns
      .filter((entry) => Boolean(entry.slotId))
      .map((entry) => [entry.slotId as string, entry])
  );
  const orderedShowdowns = compareShowdowns.map((template) => {
    const bySlot = showdownsBySlotId.get(template.id);
    if (bySlot) return bySlot;
    const byPrompt = showdownsByPrompt.get(normalizePrompt(template.prompt));
    if (byPrompt) return byPrompt;
    return null;
  });
  const overrideJobs = new Set<string>();
  compareShowdowns.forEach((template) => {
    const leftOverride = SHOWDOWN_OVERRIDES[left.modelSlug]?.[template.id];
    if (leftOverride) overrideJobs.add(leftOverride);
    const rightOverride = SHOWDOWN_OVERRIDES[right.modelSlug]?.[template.id];
    if (rightOverride) overrideJobs.add(rightOverride);
  });
  const overrideVideos =
    overrideJobs.size && isDatabaseConfigured()
      ? await getPublicVideosByIds(Array.from(overrideJobs))
      : new Map<string, GalleryVideo>();
  const hasMedia = (side?: ShowdownSide | null) => Boolean(side?.videoUrl || side?.posterUrl);
  const fallbackByTemplateId = new Map<string, { left?: GalleryVideo; right?: GalleryVideo }>();
  if (isDatabaseConfigured()) {
    const lookupTasks: Array<Promise<void>> = [];
    compareShowdowns.forEach((template, index) => {
      const entry = orderedShowdowns[index];
      const needsLeft = !hasMedia(entry?.left);
      const needsRight = !hasMedia(entry?.right);
      if (!needsLeft && !needsRight) return;
      if (needsLeft) {
        lookupTasks.push(
          getLatestPublicVideoByPromptAndEngine(template.prompt, left.engineId || left.modelSlug).then((video) => {
            if (!video) return;
            const current = fallbackByTemplateId.get(template.id) ?? {};
            fallbackByTemplateId.set(template.id, { ...current, left: video });
          })
        );
      }
      if (needsRight) {
        lookupTasks.push(
          getLatestPublicVideoByPromptAndEngine(template.prompt, right.engineId || right.modelSlug).then((video) => {
            if (!video) return;
            const current = fallbackByTemplateId.get(template.id) ?? {};
            fallbackByTemplateId.set(template.id, { ...current, right: video });
          })
        );
      }
    });
    if (lookupTasks.length) {
      await Promise.all(lookupTasks);
    }
  }
  type ShowdownSlot = CompareShowdown & { left: ShowdownSide; right: ShowdownSide };
  const showdownSlots = compareShowdowns.map((template, index) => {
    const entry = orderedShowdowns[index];
    const shouldSwapShowdownSides = showdownSourceSlug === canonicalSlug ? shouldSwapDisplayOrder : !shouldSwapDisplayOrder;
    const entryLeft = shouldSwapShowdownSides ? entry?.right : entry?.left;
    const entryRight = shouldSwapShowdownSides ? entry?.left : entry?.right;
    const fallback = fallbackByTemplateId.get(template.id);
    const fallbackLeft = fallback?.left;
    const fallbackRight = fallback?.right;
    const leftOverrideId = SHOWDOWN_OVERRIDES[left.modelSlug]?.[template.id];
    const rightOverrideId = SHOWDOWN_OVERRIDES[right.modelSlug]?.[template.id];
    const leftOverrideVideo = leftOverrideId ? overrideVideos.get(leftOverrideId) : undefined;
    const rightOverrideVideo = rightOverrideId ? overrideVideos.get(rightOverrideId) : undefined;
    const leftSide = {
      ...(entryLeft ?? {}),
      label: formatEngineName(left),
      videoUrl: entryLeft?.videoUrl ?? leftOverrideVideo?.videoUrl ?? fallbackLeft?.videoUrl,
      posterUrl: entryLeft?.posterUrl ?? leftOverrideVideo?.thumbUrl ?? fallbackLeft?.thumbUrl,
      placeholder: false,
    };
    const rightSide = {
      ...(entryRight ?? {}),
      label: formatEngineName(right),
      videoUrl: entryRight?.videoUrl ?? rightOverrideVideo?.videoUrl ?? fallbackRight?.videoUrl,
      posterUrl: entryRight?.posterUrl ?? rightOverrideVideo?.thumbUrl ?? fallbackRight?.thumbUrl,
      placeholder: false,
    };
    leftSide.placeholder = !hasMedia(leftSide);
    rightSide.placeholder = !hasMedia(rightSide);
    return {
      ...template,
      title: localizeMappedValue(entry?.title ?? template.title, activeLocale, LOCALIZED_SHOWDOWN_TITLES),
      whatItTests: localizeMappedValue(template.whatItTests, activeLocale, LOCALIZED_SHOWDOWN_TESTS),
      prompt: entry?.prompt ?? template.prompt,
      left: leftSide,
      right: rightSide,
    };
  }).filter(Boolean) as ShowdownSlot[];
  const leftAccent = getEngineAccent(left);
  const rightAccent = getEngineAccent(right);
  const leftButtonStyle = getEngineButtonStyle(left);
  const rightButtonStyle = getEngineButtonStyle(right);
  const leftIsPrelaunch = isPrelaunchAvailability(left);
  const rightIsPrelaunch = isPrelaunchAvailability(right);
  const leftCanGenerate = isEngineGeneratable(left);
  const rightCanGenerate = isEngineGeneratable(right);
  const priceScores = {
    leftScore: computePricingScore(leftPricingDisplay.prices),
    rightScore: computePricingScore(rightPricingDisplay.prices),
  };
  const speedScores = computePairScores(left.engine?.avgDurationMs ?? null, right.engine?.avgDurationMs ?? null, true);
  const resolvedLeftOptions = ENGINE_OPTIONS;
  const resolvedRightOptions = ENGINE_OPTIONS;
  const specLabels = compareCopy.specLabels ?? {};
  const specRows = [
    {
      label: specLabels.pricing ?? 'Pricing (MaxVideoAI)',
      left: leftPricingDisplay.headline,
      right: rightPricingDisplay.headline,
      subline: leftPricingDisplay.subline,
      rightSubline: rightPricingDisplay.subline,
    },
    { label: specLabels.textToVideo ?? 'Text-to-Video', left: leftSpecs.textToVideo, right: rightSpecs.textToVideo },
    { label: specLabels.imageToVideo ?? 'Image-to-Video', left: leftSpecs.imageToVideo, right: rightSpecs.imageToVideo },
    { label: specLabels.videoToVideo ?? 'Video-to-Video', left: leftSpecs.videoToVideo, right: rightSpecs.videoToVideo },
    { label: specLabels.firstLastFrame ?? 'First/Last frame', left: leftSpecs.firstLastFrame, right: rightSpecs.firstLastFrame },
    {
      label: specLabels.referenceImageStyle ?? 'Reference image / style reference',
      left: leftSpecs.referenceImageStyle,
      right: rightSpecs.referenceImageStyle,
    },
    { label: specLabels.referenceVideo ?? 'Reference video', left: leftSpecs.referenceVideo, right: rightSpecs.referenceVideo },
    { label: specLabels.maxResolution ?? 'Max resolution', left: leftSpecs.maxResolution, right: rightSpecs.maxResolution },
    { label: specLabels.maxDuration ?? 'Max duration', left: leftSpecs.maxDuration, right: rightSpecs.maxDuration },
    {
      label: specLabels.avgRenderTime ?? 'Avg render time',
      left: formatSpeedChip(left),
      right: formatSpeedChip(right),
    },
    { label: specLabels.aspectRatios ?? 'Aspect ratios', left: leftSpecs.aspectRatios, right: rightSpecs.aspectRatios },
    { label: specLabels.fpsOptions ?? 'FPS options', left: leftSpecs.fpsOptions, right: rightSpecs.fpsOptions },
    { label: specLabels.outputFormats ?? 'Output format', left: leftSpecs.outputFormats, right: rightSpecs.outputFormats },
    ...(pairHasNativeAudio
      ? [
          { label: specLabels.audioOutput ?? 'Audio output', left: leftSpecs.audioOutput, right: rightSpecs.audioOutput },
          {
            label: specLabels.nativeAudioGeneration ?? 'Native audio generation',
            left: leftSpecs.nativeAudioGeneration,
            right: rightSpecs.nativeAudioGeneration,
          },
          { label: specLabels.lipSync ?? 'Lip sync', left: leftSpecs.lipSync, right: rightSpecs.lipSync },
        ]
      : []),
    {
      label: specLabels.cameraMotionControls ?? 'Camera / motion controls',
      left: leftSpecs.cameraMotionControls,
      right: rightSpecs.cameraMotionControls,
    },
    { label: specLabels.watermark ?? 'Watermark', left: leftSpecs.watermark, right: rightSpecs.watermark },
  ].filter((row) => !(isPending(row.left) && isPending(row.right)));

  const relatedSlugs = RELATED_COMPARISONS[canonicalSlug] ?? [];
  const relatedLinks = relatedSlugs
    .map((pairSlug) => {
      const resolvedPair = resolveEngines(pairSlug);
      if (!resolvedPair) return null;
      const canonicalPair = getCanonicalCompareSlug(pairSlug)?.canonicalSlug ?? pairSlug;
      if (!isPublishedComparisonSlug(canonicalPair)) return null;
      return {
        href: { pathname: '/ai-video-engines/[slug]', params: { slug: canonicalPair } },
        label: `${formatEngineName(resolvedPair.left)} vs ${formatEngineName(resolvedPair.right)}`,
      };
    })
    .filter(
      (item): item is { href: { pathname: string; params: { slug: string } }; label: string } => Boolean(item)
    );

  const validatingLabel = compareCopy.faq?.validating ?? 'still being validated';
  const formatFaqValue = (value: string) =>
    isPending(value) ? validatingLabel : localizeSpecDetailValue(value, activeLocale, labels);
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
  const capabilityTemplates = {
    value:
      compareCopy.faq?.capabilityDiff ??
      '{label}: {left} is {leftValue} vs {right} is {rightValue}.',
    pending:
      compareCopy.faq?.capabilityPending ??
      '{label}: both are {status}.',
  };
  const outputTemplates = {
    value:
      compareCopy.faq?.outputDiff ??
      '{label}: {left} is {leftValue} vs {right} is {rightValue}.',
    pending:
      compareCopy.faq?.outputPending ??
      '{label}: data is still being validated for one or both engines.',
  };
  const faqCapabilityDiff = pickCapabilityDifference(
    left,
    right,
    compareCopy.faq?.capabilityLabel ?? 'Capability',
    faqV2vLeft,
    faqV2vRight,
    capabilityTemplates,
    validatingLabel
  );
  const faqOutputDiff = pickOutputDifference(
    formatEngineName(left),
    formatEngineName(right),
    faqResLeft,
    faqResRight,
    compareCopy.faq?.outputLabel ?? 'Max resolution',
    outputTemplates,
    validatingLabel
  );
  const faqTemplates = compareCopy.faq ?? {};
  const generatedFaqItems = [
    {
      question: formatTemplate(
        faqTemplates.q1 ?? 'What are {left} and {right}?',
        { left: formatEngineName(left), right: formatEngineName(right) }
      ),
      answer: formatTemplate(
        faqTemplates.a1 ??
          '{left} and {right} are AI video generation engines available on MaxVideoAI. This page compares them side-by-side using the same prompts, key specs, and performance data shown above.',
        { left: formatEngineName(left), right: formatEngineName(right) }
      ),
    },
    {
      question: formatTemplate(
        faqTemplates.q2 ?? 'Which is better: {left} or {right}?',
        { left: formatEngineName(left), right: formatEngineName(right) }
      ),
      answer:
        faqTemplates.a2 ??
        'It depends on your workflow. Use the scorecard and the “same prompt” showdowns to compare prompt adherence, motion realism, human fidelity, and text legibility — then open each engine profile for full details.',
    },
    {
      question: faqTemplates.q3 ?? 'Which is cheaper on MaxVideoAI?',
      answer: formatTemplate(
        stripAudioReferencesForSilentPair(
          faqTemplates.a3 ??
          (pairHasNativeAudio
            ? 'Pricing varies by engine and settings (duration, resolution, audio). Currently, {left} starts at {leftValue} and {right} starts at {rightValue} (see “Pricing (MaxVideoAI)” for details).'
            : 'Pricing varies by engine and settings (duration and resolution). Currently, {left} starts at {leftValue} and {right} starts at {rightValue} (see “Pricing (MaxVideoAI)” for details).'),
          pairHasNativeAudio
        ),
        {
          left: formatEngineName(left),
          right: formatEngineName(right),
          leftValue: faqPricingLeft,
          rightValue: faqPricingRight,
        }
      ),
    },
    {
      question: formatTemplate(
        faqTemplates.q4 ?? 'What are the biggest differences between {left} and {right}?',
        { left: formatEngineName(left), right: formatEngineName(right) }
      ),
      answer: [faqCapabilityDiff, faqOutputDiff],
    },
    {
      question:
        faqTemplates.q5 ?? 'Do they support Text-to-Video / Image-to-Video / Video-to-Video?',
      answer: formatTemplate(
        faqTemplates.a5 ??
          'On MaxVideoAI: Text-to-Video is {t2vLeft} vs {t2vRight}; Image-to-Video is {i2vLeft} vs {i2vRight}; Video-to-Video is {v2vLeft} vs {v2vRight}. Some fields may still be under validation.',
        {
          t2vLeft: faqT2vLeft,
          t2vRight: faqT2vRight,
          i2vLeft: faqI2vLeft,
          i2vRight: faqI2vRight,
          v2vLeft: faqV2vLeft,
          v2vRight: faqV2vRight,
        }
      ),
    },
    {
      question: faqTemplates.q6 ?? 'Do they support First/Last frame or references?',
      answer: formatTemplate(
        faqTemplates.a6 ??
          'First/Last frame is {firstLeft} vs {firstRight}. Reference image/style is {refImgLeft} vs {refImgRight}; Reference video is {refVidLeft} vs {refVidRight}.',
        {
          firstLeft: faqFirstLastLeft,
          firstRight: faqFirstLastRight,
          refImgLeft: faqRefImgLeft,
          refImgRight: faqRefImgRight,
          refVidLeft: faqRefVidLeft,
          refVidRight: faqRefVidRight,
        }
      ),
    },
    {
      question: faqTemplates.q7 ?? 'What are the max resolution, duration, and aspect ratios?',
      answer: formatTemplate(
        faqTemplates.a7 ??
          'Max output is {resLeft} / {durLeft} for {left} and {resRight} / {durRight} for {right}. Supported aspect ratios include {arLeft} vs {arRight} (see Key Specs for the full list).',
        {
          resLeft: faqResLeft,
          durLeft: faqDurLeft,
          left: formatEngineName(left),
          resRight: faqResRight,
          durRight: faqDurRight,
          right: formatEngineName(right),
          arLeft: faqArLeft,
          arRight: faqArRight,
        }
      ),
    },
    ...(pairHasNativeAudio
      ? [
          {
            question: faqTemplates.q8 ?? 'Do they support audio generation and lip sync?',
            answer: formatTemplate(
              faqTemplates.a8 ??
                'Audio output is {audioOutLeft} vs {audioOutRight}. Native audio generation is {audioGenLeft} vs {audioGenRight}, and lip sync is {lipLeft} vs {lipRight} (some fields may still be under validation).',
              {
                audioOutLeft: faqAudioOutLeft,
                audioOutRight: faqAudioOutRight,
                audioGenLeft: faqAudioGenLeft,
                audioGenRight: faqAudioGenRight,
                lipLeft: faqLipLeft,
                lipRight: faqLipRight,
              }
            ),
          },
        ]
      : []),
    {
      question: faqTemplates.q9 ?? 'Does MaxVideoAI add a watermark?',
      answer:
        faqTemplates.a9 ??
        'No. MaxVideoAI exports are watermark-free (“Watermark: No (MaxVideoAI)”).',
    },
    {
      question: faqTemplates.q10 ?? 'Why do results look different with the same prompt?',
      answer:
        faqTemplates.a10 ??
        'Even with identical prompts, models interpret instructions differently and use different training data and generation strategies. That’s why the Showdown section exists: same prompt, side-by-side outputs.',
    },
    {
      question: faqTemplates.q11 ?? 'Where can I find full specs, controls, and more prompt examples?',
      answer: formatTemplate(
        faqTemplates.a11 ??
          'Open the full engine profiles for complete specs, controls, and more prompts: /models/{leftSlug} and /models/{rightSlug}. You can also browse more outputs in the engine galleries.',
        { leftSlug: left.modelSlug, rightSlug: right.modelSlug }
      ),
    },
  ];
  const faqItems = pageOverride?.faq?.items ?? generatedFaqItems;

  const faqJsonLdItems = faqItems.filter((item) => {
    const text = Array.isArray(item.answer) ? item.answer.join(' ') : item.answer;
    return !text.toLowerCase().includes('data pending');
  });

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqJsonLdItems.slice(0, 6).map((item) => ({
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
      {
        '@type': 'ListItem',
        position: 1,
        name: compareCopy.breadcrumb?.root ?? 'Comparisons',
        item: compareHubCanonicalUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: `${formatEngineName(left)} vs ${formatEngineName(right)}`,
        item: comparisonCanonicalUrl,
      },
    ],
  };

  const webPageDescriptionTemplate = replaceCriteriaCount(
    metaOverride?.description ??
      compareCopy.meta?.description ??
      `Compare {left} vs {right} with the same prompts, key specs, and a scorecard across ${criteriaCount} criteria on MaxVideoAI.`,
    criteriaCount
  );

  const webPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: formatTemplate(
      metaOverride?.title ?? compareCopy.meta?.title ?? '{left} vs {right}: specs, pricing & prompt test',
      { left: formatEngineName(left), right: formatEngineName(right) }
    ),
    url: comparisonCanonicalUrl,
    description: formatTemplate(webPageDescriptionTemplate, {
      left: formatEngineName(left),
      right: formatEngineName(right),
    }),
  };

  const comparisonMetrics = [
    {
      id: 'prompt_adherence',
      label: compareCopy.metrics?.prompt_adherence?.label ?? 'Prompt Adherence',
      tooltip: compareCopy.metrics?.prompt_adherence?.tooltip ?? 'prompt alignment / instruction following',
      leftValue: leftScore?.fidelity ?? null,
      rightValue: rightScore?.fidelity ?? null,
    },
    {
      id: 'visual_quality',
      label: compareCopy.metrics?.visual_quality?.label ?? 'Visual Quality',
      tooltip:
        compareCopy.metrics?.visual_quality?.tooltip ??
        'image quality / aesthetic quality / realism / artifacts / flicker',
      leftValue: leftScore?.visualQuality ?? null,
      rightValue: rightScore?.visualQuality ?? null,
    },
    {
      id: 'motion_realism',
      label: compareCopy.metrics?.motion_realism?.label ?? 'Motion Realism',
      tooltip: compareCopy.metrics?.motion_realism?.tooltip ?? 'motion smoothness / physics plausibility',
      leftValue: leftScore?.motion ?? null,
      rightValue: rightScore?.motion ?? null,
    },
    {
      id: 'temporal_consistency',
      label: compareCopy.metrics?.temporal_consistency?.label ?? 'Temporal Consistency',
      tooltip:
        compareCopy.metrics?.temporal_consistency?.tooltip ?? 'temporal coherence / identity consistency',
      leftValue: leftScore?.consistency ?? null,
      rightValue: rightScore?.consistency ?? null,
    },
    {
      id: 'human_fidelity',
      label: compareCopy.metrics?.human_fidelity?.label ?? 'Human Fidelity',
      tooltip: compareCopy.metrics?.human_fidelity?.tooltip ?? 'faces / hands / body realism',
      leftValue: leftScore?.anatomy ?? null,
      rightValue: rightScore?.anatomy ?? null,
    },
    {
      id: 'text_ui_legibility',
      label: compareCopy.metrics?.text_ui_legibility?.label ?? 'Text & UI Legibility',
      tooltip: compareCopy.metrics?.text_ui_legibility?.tooltip ?? 'text rendering / readability',
      leftValue: leftScore?.textRendering ?? null,
      rightValue: rightScore?.textRendering ?? null,
    },
    ...(pairHasNativeAudio
      ? [
          {
            id: 'audio_lip_sync',
            label: compareCopy.metrics?.audio_lip_sync?.label ?? 'Audio & Lip Sync',
            tooltip: compareCopy.metrics?.audio_lip_sync?.tooltip ?? 'lip sync quality / dialogue sync',
            leftValue: leftScore?.lipsyncQuality ?? null,
            rightValue: rightScore?.lipsyncQuality ?? null,
          },
        ]
      : []),
    {
      id: 'multi_shot_sequencing',
      label: compareCopy.metrics?.multi_shot_sequencing?.label ?? 'Multi-Shot Sequencing',
      tooltip:
        compareCopy.metrics?.multi_shot_sequencing?.tooltip ?? 'shot-to-shot continuity / multi-shot',
      leftValue: leftScore?.sequencingQuality ?? null,
      rightValue: rightScore?.sequencingQuality ?? null,
    },
    {
      id: 'controllability',
      label: compareCopy.metrics?.controllability?.label ?? 'Controllability',
      tooltip: compareCopy.metrics?.controllability?.tooltip ?? 'camera control / constraint following',
      leftValue: leftScore?.controllability ?? null,
      rightValue: rightScore?.controllability ?? null,
    },
    {
      id: 'speed_stability',
      label: compareCopy.metrics?.speed_stability?.label ?? 'Speed & Stability',
      tooltip: compareCopy.metrics?.speed_stability?.tooltip ?? 'latency / success rate',
      leftValue: leftScore?.speedStability ?? speedScores.leftScore,
      rightValue: rightScore?.speedStability ?? speedScores.rightScore,
    },
    {
      id: 'pricing',
      label: compareCopy.metrics?.pricing?.label ?? 'Pricing',
      tooltip:
        compareCopy.metrics?.pricing?.tooltip ?? 'price per second / credits / estimated cost',
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
  const summaryCopy = compareCopy.summary ?? {};
  const scorecardTemplate = hasPrelaunchEngine
    ? (summaryCopy.scorecardTemplatePrelaunch ??
      'Currently leads on scorecard (provisional): {engine} leads on {wins}/{total}{best}.')
    : (summaryCopy.scorecardTemplate ??
      'Scorecard winner: {engine} leads on {wins}/{total}{best}.');
  const scorecardSummaryLabel = hasPrelaunchEngine
    ? (summaryCopy.scorecardLabelPrelaunch ?? 'Currently leads on scorecard (provisional)')
    : (summaryCopy.scorecardLabel ?? 'Scorecard winner');
  const pricingTemplate =
    summaryCopy.pricingTemplate ??
    'Cheaper: {engine} ({pricing}).';
  const durationTemplate =
    summaryCopy.durationTemplate ??
    'Max duration: {engine} ({duration}).';
  const specTemplate =
    summaryCopy.specTemplate ??
    '{label}: {engine} ({leftValue} vs {rightValue}).';
  const resolutionTemplate =
    summaryCopy.resolutionTemplate ??
    'Max resolution: {engine} ({leftValue} vs {rightValue}).';
  const specWinnerRow: { id: string; icon: string; label: string; value: string; accent: OverallTone } | null = (() => {
    const valueForSupport = (label: string, leftValue: string, rightValue: string) => {
      const leftNormalized = leftValue.toLowerCase();
      const rightNormalized = rightValue.toLowerCase();
      const leftIsSupported = leftNormalized === 'supported' || leftNormalized.startsWith('supported ');
      const rightIsSupported = rightNormalized === 'supported' || rightNormalized.startsWith('supported ');
      if (leftIsSupported === rightIsSupported) return null;
      const winner = leftIsSupported ? 'left' : 'right';
      return {
        id: 'spec',
        icon: 'spec',
        label,
        value: formatTemplate(specTemplate, {
          label,
          engine: formatEngineName(winner === 'left' ? left : right),
          leftValue,
          rightValue,
        }),
        accent: winner as OverallTone,
      };
    };
    if (!isPending(leftSpecs.videoToVideo) && !isPending(rightSpecs.videoToVideo)) {
      const row = valueForSupport(
        specLabels.videoToVideo ?? 'Video-to-Video',
        leftSpecs.videoToVideo,
        rightSpecs.videoToVideo
      );
      if (row) return row;
    }
    if (!isPending(leftSpecs.firstLastFrame) && !isPending(rightSpecs.firstLastFrame)) {
      const row = valueForSupport(
        specLabels.firstLastFrame ?? 'First/Last frame',
        leftSpecs.firstLastFrame,
        rightSpecs.firstLastFrame
      );
      if (row) return row;
    }
    const leftRes = parseResolutionValue(leftSpecs.maxResolution);
    const rightRes = parseResolutionValue(rightSpecs.maxResolution);
    if (leftRes && rightRes && leftRes !== rightRes) {
      const winner = leftRes > rightRes ? 'left' : 'right';
      return {
        id: 'spec',
        icon: 'spec',
        label: specLabels.maxResolution ?? 'Max resolution',
        value: formatTemplate(resolutionTemplate, {
          engine: formatEngineName(winner === 'left' ? left : right),
          leftValue: leftSpecs.maxResolution,
          rightValue: rightSpecs.maxResolution,
        }),
        accent: winner as OverallTone,
      };
    }
    if (durationWinner) {
      return {
        id: 'duration',
        icon: 'duration',
        label: summaryCopy.durationLabel ?? 'Max duration',
        value: formatTemplate(durationTemplate, {
          engine: formatEngineName(durationWinner === 'left' ? left : right),
          duration: durationSummary,
        }),
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
      label: scorecardSummaryLabel,
      value: formatTemplate(scorecardTemplate, {
        engine: formatEngineName(topWinner),
        wins: String(scoreLeader === 'left' ? leftWins : rightWins),
        total: String(totalScored),
        best: topDeltas.length ? ` (${compareCopy.summary?.bestLabel ?? 'best'}: ${topDeltas.join(', ')})` : '',
      }),
      accent: scoreLeader,
    });
  }
  if (pricingWinner) {
    winnerSummaryRows.push({
      id: 'pricing',
      icon: 'pricing',
      label: summaryCopy.pricingLabel ?? 'Pricing',
      value: formatTemplate(pricingTemplate, {
        engine: formatEngineName(pricingWinner === 'left' ? left : right),
        pricing: pricingSummary,
      }),
      accent: pricingWinner,
    });
  }
  if (specWinnerRow) {
    winnerSummaryRows.push(specWinnerRow);
  } else if (durationWinner) {
    winnerSummaryRows.push({
      id: 'duration',
      icon: 'duration',
      label: summaryCopy.durationLabel ?? 'Max duration',
      value: formatTemplate(durationTemplate, {
        engine: formatEngineName(durationWinner === 'left' ? left : right),
        duration: durationSummary,
      }),
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
          <Link href={compareHubHref} className="font-semibold text-brand hover:text-brandHover">
            {compareCopy.hero?.back ?? 'Back to comparisons'}
          </Link>
        </div>
        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">
            {compareCopy.hero?.kicker ?? 'Compare engines'}
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-text-primary sm:text-5xl">
            {formatEngineName(left)} vs {formatEngineName(right)}
          </h1>
          <p className="mt-4 text-sm text-text-secondary">
            {formatTemplate(
              heroIntroTemplate,
              { left: formatEngineName(left), right: formatEngineName(right) }
            )}
          </p>
          {prelaunchNotice ? (
            <div className="mx-auto mt-4 max-w-3xl rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-left shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-micro text-amber-900">{prelaunchNotice.title}</p>
              <p className="mt-1 text-sm text-amber-950">{prelaunchNotice.body}</p>
            </div>
          ) : null}
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
                    const bestFor = localizeBestFor(left.bestFor, activeLocale);
                    const derived = deriveStrengths('left').join(', ');
                    const strengths = bestFor && !isPending(bestFor) ? bestFor : derived;
                    return strengths ? (
                      <p className="text-center text-xs text-text-secondary sm:text-sm">
                        {compareCopy.scorecard?.strengthsLabel ?? 'Strengths'}: {strengths}
                      </p>
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
                    const bestFor = localizeBestFor(right.bestFor, activeLocale);
                    const derived = deriveStrengths('right').join(', ');
                    const strengths = bestFor && !isPending(bestFor) ? bestFor : derived;
                    return strengths ? (
                      <p className="text-center text-xs text-text-secondary sm:text-sm">
                        {compareCopy.scorecard?.strengthsLabel ?? 'Strengths'}: {strengths}
                      </p>
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
              <h2 className="text-xl font-semibold text-text-primary">
                {compareCopy.scorecard?.title ?? 'Scorecard (Side-by-Side)'}
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                {replaceCriteriaCount(
                  compareCopy.scorecard?.subtitle ??
                    `Scores reflect quality and control on MaxVideoAI across ${criteriaCount} criteria.`,
                  criteriaCount
                )}
              </p>
              {scorecardProvisionalNote ? (
                <p className="mt-2 text-xs font-semibold text-text-muted">{scorecardProvisionalNote}</p>
              ) : null}
            </div>
            <CompareScoreboard
              metrics={comparisonMetrics}
              className="mt-6"
              naLabel={labels.na}
              pendingLabel={labels.pending}
            />

            <div className="mt-6 mx-auto max-w-3xl">
              <div className="rounded-card bg-surface/95 px-3 py-4 text-center shadow-card">
                <div className="flex items-center justify-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-hairline bg-surface-2">
                    {summaryIcons.scorecard}
                  </span>
                  <h3 className="text-sm font-semibold text-text-primary">
                    {winnerSummaryHeading}
                  </h3>
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
                {leftCanGenerate ? (
                  <ButtonLink
                    href={`/app?engine=${left.modelSlug}`}
                    size="sm"
                    style={leftButtonStyle}
                    className={clsx(
                      'w-full max-w-[180px] justify-center hover:brightness-95 active:brightness-90',
                      !leftButtonStyle && leftAccent.buttonClass
                    )}
                  >
                    {formatTemplate(compareCopy.scorecard?.generateWith ?? 'Generate with {engine}', {
                      engine: formatEngineShortName(left),
                    })}
                  </ButtonLink>
                ) : null}
                <Link
                  href={{ pathname: '/models/[slug]', params: { slug: left.modelSlug } }}
                  className="text-xs font-semibold text-brand hover:text-brandHover"
                >
                  {compareCopy.scorecard?.fullProfile ?? 'Full engine profile'}
                </Link>
              </div>
              <div className="flex flex-col items-center gap-2">
                {rightCanGenerate ? (
                  <ButtonLink
                    href={`/app?engine=${right.modelSlug}`}
                    size="sm"
                    style={rightButtonStyle}
                    className={clsx(
                      'w-full max-w-[180px] justify-center hover:brightness-95 active:brightness-90',
                      !rightButtonStyle && rightAccent.buttonClass
                    )}
                  >
                    {formatTemplate(compareCopy.scorecard?.generateWith ?? 'Generate with {engine}', {
                      engine: formatEngineShortName(right),
                    })}
                  </ButtonLink>
                ) : null}
                <Link
                  href={{ pathname: '/models/[slug]', params: { slug: right.modelSlug } }}
                  className="text-xs font-semibold text-brand hover:text-brandHover"
                >
                  {compareCopy.scorecard?.fullProfile ?? 'Full engine profile'}
                </Link>
              </div>
            </div>

            <div className="mt-10 border-t border-hairline pt-8">
              <h2 className="text-center text-2xl font-semibold text-text-primary">
                {compareCopy.keySpecs?.title ?? 'Key Specs (Side-by-Side)'}
              </h2>
              <p className="mt-2 text-center text-sm text-text-secondary">
                {stripAudioReferencesForSilentPair(
                  compareCopy.keySpecs?.subtitle ??
                    'Compare key AI video model specs side-by-side (pricing, inputs, resolution, duration, aspect ratios, audio, and core controls). This is a high-level snapshot — see the full engine profile for the complete feature set and prompt examples.',
                  pairHasNativeAudio
                )}
              </p>

              <div className="mt-4 rounded-card border border-hairline bg-surface shadow-card">
                <div className="grid grid-cols-[minmax(90px,1fr)_minmax(80px,0.8fr)_minmax(90px,1fr)] gap-2 border-b border-hairline px-3 py-3 text-[10px] font-semibold uppercase tracking-micro text-text-muted min-[840px]:grid-cols-[minmax(200px,2fr)_minmax(220px,1fr)_minmax(200px,2fr)] min-[840px]:gap-4 min-[840px]:px-6 min-[840px]:py-4 min-[840px]:text-xs">
                  <span className="text-left">{formatEngineName(left)}</span>
                  <span className="text-center">{compareCopy.keySpecs?.keyLabel ?? 'Key spec'}</span>
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
                        {renderSpecValue(row.left, activeLocale, {
                          pending: labels.pending,
                          supported: labels.supported,
                          notSupported: labels.notSupported,
                        })}
                        {'subline' in row && row.subline ? (
                          <div className="mt-1 text-[10px] text-text-muted">{row.subline}</div>
                        ) : null}
                      </div>
                      <span className="text-center text-text-primary">{row.label}</span>
                      <div className="rounded-md px-1 py-0.5 text-right text-text-secondary sm:px-2 sm:py-1">
                        {renderSpecValue(row.right, activeLocale, {
                          pending: labels.pending,
                          supported: labels.supported,
                          notSupported: labels.notSupported,
                        })}
                        {'rightSubline' in row && row.rightSubline ? (
                          <div className="mt-1 text-[10px] text-text-muted">{row.rightSubline}</div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {pageOverride?.topCards?.length ? (
                <section className="mt-6 rounded-[24px] border border-hairline bg-surface-2/70 p-4 shadow-sm sm:p-5">
                  <div className="grid gap-3 md:grid-cols-2">
                    {pageOverride.topCards.map((card) => (
                      <article
                        key={card.title}
                        className="rounded-[18px] border border-hairline bg-surface/90 px-4 py-3"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">
                          {card.title}
                        </p>
                        <p className="mt-1.5 text-sm leading-6 text-text-secondary">{card.body}</p>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              {pageOverride?.primaryLinks?.length ? (
                <section className="mt-4 rounded-[24px] border border-hairline bg-surface/90 px-4 py-4 shadow-sm sm:px-5">
                  <h2 className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">
                    {pageOverride.primaryLinksTitle ?? 'Recommended next steps'}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                    {pageOverride.primaryLinks.map((item) => (
                      <Link key={item.label} href={item.href} className="font-semibold text-brand hover:text-brandHover">
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </section>

        

        {showdownSlots.length ? (
          <section className="stack-gap-sm">
            <h2 className="text-2xl font-semibold text-text-primary">
              {compareCopy.showdown?.title ?? 'Showdown (same prompt)'}
            </h2>
            <p className="text-sm text-text-secondary">
              {showdownSubtitle}
            </p>
            <p className="text-xs text-text-muted">{compareCopy.showdown?.note ?? 'Showing up to 3 prompt pairs for clarity.'}</p>

            <div className="stack-gap-lg">
              {showdownSlots.map((entry) => {
                const leftLabel = entry.left.label ?? formatEngineName(left);
                const rightLabel = entry.right.label ?? formatEngineName(right);
                const leftAlt = getImageAlt({
                  kind: 'compareThumb',
                  engine: leftLabel,
                  compareEngine: rightLabel,
                  label: `${entry.title} - ${leftLabel}`,
                  locale: activeLocale,
                });
                const rightAlt = getImageAlt({
                  kind: 'compareThumb',
                  engine: rightLabel,
                  compareEngine: leftLabel,
                  label: `${entry.title} - ${rightLabel}`,
                  locale: activeLocale,
                });
                return (
                  <article
                    key={`${slug}-showdown-${entry.id}`}
                    className="rounded-card border border-hairline bg-surface p-6 shadow-card"
                  >
                    <div className="stack-gap-sm">
                    <div>
                      <h3 className="text-lg font-semibold text-text-primary">{entry.title}</h3>
                      <p className="text-sm text-text-secondary">
                        {labels.whatTests}: {entry.whatItTests}
                      </p>
                    </div>
                    <div className="rounded-card border border-hairline bg-surface-2 p-3 text-sm text-text-secondary">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">{labels.prompt}</span>
                        {exposeSourcePrompt ? (
                          <CopyPromptButton
                            prompt={entry.prompt}
                            copyLabel={compareCopy.labels?.copyPrompt ?? 'Copy prompt'}
                            copiedLabel={compareCopy.labels?.copied ?? 'Copied'}
                          />
                        ) : null}
                      </div>
                      {exposeSourcePrompt ? (
                        <DeferredSourcePrompt
                          locale={activeLocale}
                          prompt={entry.prompt}
                          mode="details"
                          className="mt-2"
                          summaryClassName="cursor-pointer list-none text-xs font-semibold text-brand"
                          promptClassName="mt-2 whitespace-pre-wrap text-text-primary"
                          fallbackClassName="mt-2 text-sm text-text-secondary"
                        />
                      ) : (
                        <p className="mt-2 text-sm text-text-secondary">{localizedPromptNote}</p>
                      )}
                    </div>
                    <div className="grid grid-gap lg:grid-cols-2">
                      {renderShowdownMedia(
                        entry.left,
                        formatEngineName(left),
                        labels.placeholder,
                        labels.placeholder,
                        entry.aspectRatio,
                        leftAlt
                      )}
                      {renderShowdownMedia(
                        entry.right,
                        formatEngineName(right),
                        labels.placeholder,
                        labels.placeholder,
                        entry.aspectRatio,
                        rightAlt
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
                      <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">{showdownActionLabel}</span>
                      <Link
                        href={buildGenerateHref(
                          left.modelSlug,
                          exposeSourcePrompt ? entry.prompt : null,
                          entry.aspectRatio,
                          entry.mode
                        )}
                        rel="nofollow"
                        prefetch={false}
                        className="rounded-full border border-hairline bg-surface px-3 py-1 text-xs font-semibold text-text-primary transition hover:bg-surface-2"
                      >
                        {leftIsPrelaunch
                          ? labels.savePromptForLaunch
                          : formatTemplate(compareCopy.scorecard?.generateWith ?? 'Generate with {engine}', {
                              engine: formatEngineShortName(left),
                            })}
                      </Link>
                      <Link
                        href={buildGenerateHref(
                          right.modelSlug,
                          exposeSourcePrompt ? entry.prompt : null,
                          entry.aspectRatio,
                          entry.mode
                        )}
                        rel="nofollow"
                        prefetch={false}
                        className="rounded-full border border-hairline bg-surface px-3 py-1 text-xs font-semibold text-text-primary transition hover:bg-surface-2"
                      >
                        {rightIsPrelaunch
                          ? labels.savePromptForLaunch
                          : formatTemplate(compareCopy.scorecard?.generateWith ?? 'Generate with {engine}', {
                              engine: formatEngineShortName(right),
                            })}
                      </Link>
                      <span className="text-xs text-text-muted">{showdownActionHint}</span>
                    </div>
                  </div>
                  </article>
                );
              })}
            </div>
            <p className="text-sm text-text-secondary">
              {compareCopy.showdown?.footer ??
                'This side-by-side AI video comparison uses identical prompts to highlight differences in motion, realism, human fidelity, and text legibility. For full specs, controls, and more prompt examples, open each engine profile.'}
            </p>
          </section>
        ) : null}

        {relatedLinks.length ? (
          <section className="stack-gap-sm">
            <h2 className="text-2xl font-semibold text-text-primary">
              {compareCopy.related?.title ?? 'Related comparisons'}
            </h2>
            <p className="text-sm text-text-secondary">
              {compareCopy.related?.subtitle ??
                'Explore a few more popular side-by-side matchups.'}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {relatedLinks.map((item) => (
                <Link
                  key={item.href.params.slug}
                  href={item.href}
                  className="rounded-card border border-hairline bg-surface px-4 py-3 text-sm font-semibold text-text-primary transition hover:bg-surface-2"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="stack-gap-sm">
          <h2 className="text-2xl font-semibold text-text-primary">
            {pageOverride?.faq?.title ?? compareCopy.faq?.title ?? 'FAQ'}
          </h2>
          <p className="text-sm text-text-secondary">
            {formatTemplate(
              pageOverride?.faq?.subtitle ??
                compareCopy.faq?.subtitle ??
                'Quick answers about {left} vs {right} on MaxVideoAI (pricing, modes, specs, and why results differ).',
              { left: formatEngineName(left), right: formatEngineName(right) }
            )}
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
          <Link href={compareHubHref} className="font-semibold text-brand hover:text-brandHover">
            {compareCopy.hero?.back ?? 'Back to comparisons'}
          </Link>
        </div>
      </div>
    </div>
  );
}
