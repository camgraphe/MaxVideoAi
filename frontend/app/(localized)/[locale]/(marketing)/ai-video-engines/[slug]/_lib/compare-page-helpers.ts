import type { CSSProperties } from 'react';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { AppLocale } from '@/i18n/locales';
import { localePathnames } from '@/i18n/locales';
import { canonicalizeFalModelSlug } from '@/config/falEngines';
import { isDatabaseConfigured } from '@/lib/db';
import { computeMarketingPriceRange } from '@/lib/pricing-marketing';
import { applyDisplayedPriceMarginCents } from '@/lib/pricing-display';
import { getPublicVideosByIds } from '@/server/videos';
import type { EngineCaps } from '@/types/engines';
import { CATALOG_BY_SLUG, EXCLUDED_ENGINE_SLUGS, MODELS_SLUG_MAP } from './compare-page-config';
import type {
  ComparePricingDisplay,
  CompareSpecValues,
  EngineCatalogEntry,
  EngineKeySpecsEntry,
  EngineKeySpecsFile,
  EngineScore,
  EngineScoresFile,
  ShowdownEntry,
} from './compare-page-types';

export function reverseCompareSlug(slug: string) {
  const parts = slug.split('-vs-');
  if (parts.length !== 2) return null;
  return `${parts[1]}-vs-${parts[0]}`;
}

export function formatTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
}

export function replaceCriteriaCount(template: string, count: number) {
  return template
    .replace(/\b11 criteria\b/g, `${count} criteria`)
    .replace(/\b11 critères\b/g, `${count} critères`)
    .replace(/\b11 criterios\b/g, `${count} criterios`);
}

export function stripAudioReferencesForSilentPair(template: string, pairHasNativeAudio: boolean) {
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
    'Budget Veo drafts': 'Tests Veo à petit budget',
    'Cinematic dialogue': 'Dialogue cinématographique',
    'Cinematic motion with camera lock': 'Mouvement cinématographique avec caméra verrouillée',
    'Cinematic shots': 'Plans cinématographiques',
    'Fast Seedance tests, reference tests, and shot planning':
      'Tests Seedance rapides, tests de références et préparation des plans',
    'Fast cinematic drafts with modify and reframe': 'Tests cinématographiques rapides avec modify et reframe',
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
    'Fast Seedance tests, reference tests, and shot planning':
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

export const LOCALIZED_SHOWDOWN_TITLES: Partial<Record<AppLocale, Record<string, string>>> = {
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

export const LOCALIZED_SHOWDOWN_TESTS: Partial<Record<AppLocale, Record<string, string>>> = {
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

export function localizeMappedValue(
  value: string,
  locale: AppLocale,
  translations: Partial<Record<AppLocale, Record<string, string>>>
): string {
  if (locale === 'en') return value;
  return translations[locale]?.[value] ?? value;
}

export function localizeBestFor(value: string | null | undefined, locale: AppLocale): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  if (locale === 'en') return normalized;
  return LOCALIZED_BEST_FOR[locale]?.[normalized] ?? null;
}

export function formatEngineName(entry: EngineCatalogEntry): string {
  return entry.marketingName || entry.modelSlug.replace(/-/g, ' ');
}

export function formatEngineShortName(entry: EngineCatalogEntry): string {
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

export function formatEngineMetaName(entry: EngineCatalogEntry): string {
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

export type EngineAccent = {
  barClass: string;
  badgeClass: string;
  buttonClass: string;
  columnTintClass: string;
};

export type OverallTone = 'left' | 'right' | 'tie' | 'none';

export function getEngineAccent(entry: EngineCatalogEntry): EngineAccent {
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

export function getEngineToneVars(entry: EngineCatalogEntry, sweep: number | null): CSSProperties {
  const brandId = entry.brandId?.trim();
  const accent = brandId ? `var(--engine-${brandId}-bg)` : 'var(--brand)';
  const ink = brandId ? `var(--engine-${brandId}-ink)` : 'var(--on-brand)';
  const scoreSweep = typeof sweep === 'number' ? `${Math.max(0, Math.min(10, sweep)) * 36}deg` : '360deg';
  return {
    '--compare-accent': accent,
    '--compare-ink': ink,
    background: `conic-gradient(from 220deg, color-mix(in srgb, var(--compare-accent) 78%, var(--brand) 22%) 0deg ${scoreSweep}, color-mix(in srgb, var(--compare-accent) 18%, transparent) ${scoreSweep} 360deg)`,
    boxShadow:
      '0 0 0 8px color-mix(in srgb, var(--compare-accent) 10%, transparent), 0 20px 52px color-mix(in srgb, var(--compare-accent) 42%, transparent), 0 8px 18px rgba(15, 23, 42, 0.06)',
  } as CSSProperties;
}


export function resolveEngines(slug: string) {
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

export function getCanonicalCompareSlug(slug: string) {
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

export function resolveExcludedCompareRedirect({
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

export async function loadEngineScores(): Promise<Map<string, EngineScore>> {
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

export async function loadEngineKeySpecs(): Promise<Map<string, EngineKeySpecsEntry>> {
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

export async function hydrateShowdowns(
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

export function getPricePerSecondCents(entry: EngineCatalogEntry): number | null {
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

export function formatSpeedChip(entry: EngineCatalogEntry) {
  const avg = entry.engine?.avgDurationMs ?? null;
  if (avg == null) return 'Data pending';
  return `${Math.round(avg / 1000)}s avg`;
}

export function formatMaxResolution(entry: EngineCatalogEntry) {
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

export function formatDuration(entry: EngineCatalogEntry) {
  const max = entry.engine?.maxDurationSec;
  return typeof max === 'number' ? `${max}s max` : 'Data pending';
}

export function formatAspectRatios(entry: EngineCatalogEntry) {
  const ratios = entry.engine?.aspectRatios ?? [];
  return ratios.length ? ratios.join(' / ') : 'Data pending';
}

export function formatFps(entry: EngineCatalogEntry) {
  const fps = entry.engine?.fps ?? [];
  return fps.length ? fps.join(' / ') : 'Data pending';
}

export function resolveStatus(value?: boolean | null) {
  if (value === true) return 'Supported';
  if (value === false) return 'Not supported';
  return 'Data pending';
}

export function resolveModeSupported(entry: EngineCatalogEntry, mode: string) {
  const modes = entry.engine?.modes ?? [];
  if (!modes.length) return 'Data pending';
  return modes.includes(mode) ? 'Supported' : 'Not supported';
}

export function resolveVideoToVideoSupport(entry: EngineCatalogEntry) {
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

export function resolveFirstLastSupport(entry: EngineCatalogEntry) {
  const modes = entry.engine?.modes ?? [];
  if (modes.includes('fl2v')) return 'Supported';
  if (entry.engine?.keyframes != null) return resolveStatus(entry.engine.keyframes);
  return modes.length ? 'Not supported' : 'Data pending';
}

export function resolveReferenceImageSupport(entry: EngineCatalogEntry) {
  const modes = entry.engine?.modes ?? [];
  if (!modes.length) return 'Data pending';
  if (modes.includes('ref2v') || modes.includes('r2v')) return 'Supported (multi reference stills)';
  if (modes.includes('i2v')) return 'Supported (single start image)';
  return 'Not supported';
}

export function resolveReferenceVideoSupport(entry: EngineCatalogEntry) {
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

export function isPending(value: string) {
  return value.trim().toLowerCase() === 'data pending';
}

export function buildSpecValues(
  entry: EngineCatalogEntry,
  specs: Record<string, unknown> | undefined
): CompareSpecValues {
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

export function parseFirstNumber(value: string) {
  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const num = Number(match[1]);
  return Number.isNaN(num) ? null : num;
}

export function parseResolutionValue(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes('4k')) return 2160;
  const matches = normalized.match(/(\d{3,4})/g) ?? [];
  const numbers = matches.map((entry) => Number(entry)).filter((entry) => !Number.isNaN(entry));
  return numbers.length ? Math.max(...numbers) : null;
}

export function resolveAudioOffPrice(entry: EngineCatalogEntry): string | null {
  const perSecond = entry.engine?.pricingDetails?.perSecondCents;
  if (!perSecond || typeof perSecond.default !== 'number') return null;
  const audioOffDelta = entry.engine?.pricingDetails?.addons?.audio_off?.perSecondCents;
  if (typeof audioOffDelta !== 'number') return null;
  const total = applyDisplayedPriceMarginCents(perSecond.default + audioOffDelta);
  return `Audio off: $${(total / 100).toFixed(2)}/s`;
}

const PRICING_SCORE_MIN = 0.03;
const PRICING_SCORE_MAX = 1.0;

export function computePricingScore(prices: number[]): number | null {
  if (!prices.length) return null;
  const avg = prices.reduce((sum, value) => sum + value, 0) / prices.length;
  const normalized =
    10 * (PRICING_SCORE_MAX - avg) / (PRICING_SCORE_MAX - PRICING_SCORE_MIN);
  const clamped = Math.max(0, Math.min(10, normalized));
  return Math.round(clamped * 10) / 10;
}

export function parseResolutionLabel(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes('4k')) return 2160;
  const match = normalized.match(/(\d{3,4})/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isNaN(value) ? null : value;
}

export function formatPriceLabel(label: string) {
  const normalized = label.trim().toLowerCase();
  if (normalized === '4k') return '4K';
  if (normalized === '2k') return '2K';
  if (normalized === '1k') return '1K';
  return label;
}

export function formatPriceLine(label: string | null, cents: number) {
  const value = `$${(cents / 100).toFixed(2)}/s`;
  return label ? `${formatPriceLabel(label)}: ${value}` : value;
}

export function getPrelaunchPricingLabel(locale: AppLocale) {
  if (locale === 'fr') return 'Confirmé au lancement';
  if (locale === 'es') return 'Confirmado en lanzamiento';
  return 'TBD at launch';
}

export function isPrelaunchAvailability(entry: EngineCatalogEntry) {
  const availability = String(entry.availability ?? '').toLowerCase();
  return availability === 'waitlist' || availability === 'limited';
}

export function getPrelaunchCompareNotice(locale: AppLocale) {
  if (locale === 'fr') {
    return {
      title: 'Comparaison pré-lancement',
      body: 'Un modèle de cette page est en pré-lancement. Les rendus runtime ne sont pas encore disponibles; les prix et sorties finales sont confirmés au lancement.',
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

export function isEngineGeneratable(entry: EngineCatalogEntry) {
  const availability = String(entry.availability ?? '').toLowerCase();
  return availability === 'available' || availability === 'limited';
}

export async function resolvePricingDisplay(
  entry: EngineCatalogEntry,
  locale: AppLocale,
  pricingEngine?: EngineCaps | null
): Promise<ComparePricingDisplay> {
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

export function resolveKeySpecValue(
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

export function localizeSpecDetailValue(
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
  if (lower === 'not listed for native 4k route') {
    return locale === 'fr'
      ? 'Non listé pour la route 4K native'
      : locale === 'es'
        ? 'No listado para la ruta 4K nativa'
        : 'Not listed for native 4K route';
  }
  return value;
}

export function computeOverall(score?: EngineScore | null) {
  if (!score) return null;
  const values = [score.fidelity, score.motion, score.consistency].filter(
    (value): value is number => typeof value === 'number'
  );
  if (!values.length) return null;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.round(avg * 10) / 10;
}

export function computePairScores(leftValue: number | null, rightValue: number | null, preferLower = false) {
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

export function buildGenerateHref(engineSlug: string, prompt?: string | null, aspectRatio?: string | null, mode?: string | null) {
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

export function pickCapabilityDifference(
  left: EngineCatalogEntry,
  right: EngineCatalogEntry,
  label: string,
  leftStatus: string,
  rightStatus: string,
  templates: { value: string; pending: string },
  validatingLabel: string
): string | null {
  const leftNormalized = leftStatus.toLowerCase();
  const rightNormalized = rightStatus.toLowerCase();
  const leftPending = leftNormalized.includes('pending') || leftNormalized.includes('validated');
  const rightPending = rightNormalized.includes('pending') || rightNormalized.includes('validated');
  if (!leftPending && !rightPending && leftStatus !== rightStatus) {
    return formatTemplate(templates.value, {
      label,
      left: formatEngineName(left),
      right: formatEngineName(right),
      leftValue: formatCapabilityValue(leftStatus),
      rightValue: formatCapabilityValue(rightStatus),
    });
  }
  if (leftPending || rightPending) {
    return formatTemplate(templates.pending, {
      label,
      status: leftStatus === rightStatus ? formatCapabilityValue(leftStatus) : validatingLabel,
    });
  }
  return null;
}

export function formatCapabilityValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return value;
  return `${trimmed.charAt(0).toLocaleLowerCase()}${trimmed.slice(1)}`.replace(/\b4k\b/gi, '4K');
}

export function getFallbackCapabilityDifference(locale: AppLocale) {
  if (locale === 'fr') {
    return 'Modes clés : les deux modèles couvrent les mêmes routes principales; la vraie différence se joue sur la résolution, le coût et le niveau de finition.';
  }
  if (locale === 'es') {
    return 'Modos clave: ambos motores cubren las mismas rutas principales; la diferencia real está en la resolución, el costo y el nivel de acabado.';
  }
  return 'Core modes: both engines cover the same main routes; the real difference is resolution, cost, and delivery polish.';
}

export function pickFirstCapabilityDifference(
  left: EngineCatalogEntry,
  right: EngineCatalogEntry,
  candidates: Array<{ label: string; leftStatus: string; rightStatus: string }>,
  templates: { value: string; pending: string },
  validatingLabel: string,
  locale: AppLocale
) {
  for (const candidate of candidates) {
    const diff = pickCapabilityDifference(
      left,
      right,
      candidate.label,
      candidate.leftStatus,
      candidate.rightStatus,
      templates,
      validatingLabel
    );
    if (diff) return diff;
  }
  return getFallbackCapabilityDifference(locale);
}

export function pickOutputDifference(
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
