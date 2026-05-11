import type { FalEngineEntry } from '@/config/falEngines';
import type { EngineCaps, Mode, Resolution } from '@/types/engines';
import { getEngineSelectFamilyRank } from '@/lib/engine-family-priority';
import { getLocalizedModeLabel, normalizeUiLocale } from '@/lib/ltx-localization';
import type { EngineRegistryMeta } from './engine-select-types';

let engineRegistryMetaCache: EngineRegistryMeta | null = null;
let engineRegistryMetaPromise: Promise<EngineRegistryMeta> | null = null;

export function getCachedEngineRegistryMeta(): EngineRegistryMeta | null {
  return engineRegistryMetaCache;
}

export async function ensureEngineRegistryMeta(): Promise<EngineRegistryMeta> {
  if (engineRegistryMetaCache) return engineRegistryMetaCache;
  if (!engineRegistryMetaPromise) {
    engineRegistryMetaPromise = import('@/config/falEngines')
      .then((mod) => {
        const registry = mod.listFalEngines();
        const meta: EngineRegistryMeta = {
          order: new Map(registry.map((entry, index) => [entry.id, index])),
          meta: new Map(registry.map((entry) => [entry.id, entry])),
        };
        engineRegistryMetaCache = meta;
        return meta;
      })
      .catch((error) => {
        engineRegistryMetaPromise = null;
        throw error;
      });
  }
  return engineRegistryMetaPromise;
}

export const ENGINE_VARIANT_LABEL_OVERRIDES: Record<string, string> = {
  'kling-3-standard': 'Standard',
  'kling-3-pro': 'Pro',
  'ltx-2-3': 'Pro',
  'ltx-2-3-fast': 'Fast',
};

const ENGINE_VARIANT_SORT_ORDER = new Map<string, number>([
  ['ltx-2-3', 0],
  ['ltx-2-3-fast', 1],
]);

export const ENGINE_LEGACY_STORAGE_KEY = 'engineSelect.showLegacy';

export const DEFAULT_MODE_OPTIONS: Mode[] = ['t2v', 'i2v', 'v2v', 'reframe', 'ref2v', 'fl2v', 'extend', 'a2v', 'retake', 'r2v'];

const SEEDREAM_BROWSE_RESOLUTIONS: Resolution[] = ['2K', '3K', '4K'];
const NON_RESOLUTION_BROWSE_VALUES = new Set([
  'auto',
  'custom',
  'square',
  'square_hd',
  'portrait_4_3',
  'portrait_16_9',
  'landscape_4_3',
  'landscape_16_9',
  'portrait_hd',
  'landscape_hd',
]);

const ENGINE_MODE_LABEL_OVERRIDES: Record<string, Partial<Record<Mode, string>>> = {
  lumaRay2: {
    v2v: 'Modify',
    reframe: 'Reframe',
  },
  lumaRay2_flash: {
    v2v: 'Modify',
    reframe: 'Reframe',
  },
  'veo-3-1': {
    ref2v: 'Reference',
    fl2v: 'First/Last',
    extend: 'Extend',
  },
  'veo-3-1-fast': {
    fl2v: 'First/Last',
    extend: 'Extend',
  },
  'veo-3-1-lite': {
    fl2v: 'First/Last',
  },
  'kling-2-5-turbo': {
    t2v: 'Pro · Text',
    i2v: 'Pro · Image',
    i2i: 'Standard · Image',
  },
  'wan-2-5': {
    t2v: 'Text · Audio-ready',
    i2v: 'Image · Audio-ready',
  },
  'wan-2-6': {
    t2v: 'Text · Multi-shot',
    i2v: 'Image · Animate',
    r2v: 'Reference · Consistency',
  },
};

export function getModeLabel(
  engineId: string | undefined,
  value: Mode,
  locale: string | undefined,
  overrides?: Partial<Record<Mode, string>>
): string {
  const custom = overrides?.[value];
  if (custom) return custom;
  const engineOverrides = engineId ? ENGINE_MODE_LABEL_OVERRIDES[engineId] : undefined;
  return engineOverrides?.[value] ?? getLocalizedModeLabel(value, normalizeUiLocale(locale));
}

export function getModeDisplayOrder(engineId: string | undefined, modes: Mode[]): Mode[] {
  if (engineId === 'lumaRay2' || engineId === 'lumaRay2_flash') {
    const order: Mode[] = ['t2v', 'i2v', 'v2v', 'reframe'];
    return order.filter((mode) => modes.includes(mode));
  }
  if (engineId === 'veo-3-1') {
    const order: Mode[] = ['t2v', 'i2v', 'ref2v', 'fl2v', 'extend'];
    return order.filter((mode) => modes.includes(mode));
  }
  if (engineId === 'veo-3-1-fast') {
    const order: Mode[] = ['t2v', 'i2v', 'fl2v', 'extend'];
    return order.filter((mode) => modes.includes(mode));
  }
  if (engineId === 'veo-3-1-lite') {
    const order: Mode[] = ['t2v', 'i2v', 'fl2v'];
    return order.filter((mode) => modes.includes(mode));
  }
  return modes;
}

export function formatAvgDuration(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  const seconds = value / 1000;
  const precision = seconds < 10 ? 1 : 0;
  return `${seconds.toFixed(precision)}s`;
}

function isSeedreamEngine(engine: Pick<EngineCaps, 'id'>): boolean {
  return engine.id === 'seedream';
}

function normalizeBrowseResolutionValue(value: Resolution): Resolution | null {
  const trimmed = value.toString().trim();
  if (!trimmed) return null;
  const raw = trimmed.toLowerCase();
  if (NON_RESOLUTION_BROWSE_VALUES.has(raw)) return null;
  if (/^\d+x\d+$/i.test(raw)) return null;

  const kMatch = raw.match(/^(\d+(?:\.\d+)?)k$/);
  if (kMatch) return `${kMatch[1]}K` as Resolution;

  const pMatch = raw.match(/^(\d+)p$/);
  if (pMatch) return `${pMatch[1]}p` as Resolution;

  const upperPMatch = trimmed.match(/^(\d+)P$/);
  if (upperPMatch) return trimmed as Resolution;

  return trimmed as Resolution;
}

function resolutionRank(value: Resolution) {
  const raw = value.toString().toLowerCase();
  if (raw.endsWith('k')) {
    const numeric = Number(raw.replace('k', ''));
    return Number.isFinite(numeric) ? numeric * 1000 : 0;
  }

  const match = raw.match(/(\d+)\s*p/);
  if (match) return Number(match[1]);
  const fallback = Number(raw.replace(/[^\d.]/g, ''));
  return Number.isFinite(fallback) ? fallback : 0;
}

function sortResolutionsByRank(values: Resolution[]): Resolution[] {
  return values.slice().sort((a, b) => {
    const aRank = resolutionRank(a);
    const bRank = resolutionRank(b);
    if (aRank !== bRank) return bRank - aRank;
    return a.localeCompare(b);
  });
}

export function getBrowseEngineResolutionValues(engine: EngineCaps): Resolution[] {
  if (isSeedreamEngine(engine)) {
    const available = new Set(engine.resolutions ?? []);
    return SEEDREAM_BROWSE_RESOLUTIONS.filter((resolution) => available.has(resolution));
  }
  const values: Resolution[] = [];
  const seen = new Set<string>();
  (engine.resolutions ?? []).forEach((resolution) => {
    const normalized = normalizeBrowseResolutionValue(resolution);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    values.push(normalized);
  });
  return values;
}

export function getBrowseResolutionOptions(engines: EngineCaps[]): Resolution[] {
  const set = new Set<Resolution>();
  engines.forEach((engine) => {
    getBrowseEngineResolutionValues(engine).forEach((resolution) => set.add(resolution));
  });
  return sortResolutionsByRank(Array.from(set));
}

export function engineMatchesBrowseResolution(engine: EngineCaps, resolution: Resolution): boolean {
  const normalizedFilter = normalizeBrowseResolutionValue(resolution);
  if (!normalizedFilter) return false;
  return getBrowseEngineResolutionValues(engine).some(
    (engineResolution) => engineResolution.toLowerCase() === normalizedFilter.toLowerCase()
  );
}

function getEngineDiscoveryRank(engineId: string, registryMeta: EngineRegistryMeta | null): number {
  return registryMeta?.meta.get(engineId)?.surfaces.app.discoveryRank ?? Number.MAX_SAFE_INTEGER;
}

export function compareEnginesByDefaultPriority(
  a: EngineCaps,
  b: EngineCaps,
  registryMeta: EngineRegistryMeta | null,
  engineMeta?: Map<string, FalEngineEntry>
): number {
  const metaA = engineMeta?.get(a.id) ?? registryMeta?.meta.get(a.id);
  const metaB = engineMeta?.get(b.id) ?? registryMeta?.meta.get(b.id);
  const familyRankA = getEngineSelectFamilyRank(metaA);
  const familyRankB = getEngineSelectFamilyRank(metaB);
  if (familyRankA !== familyRankB) {
    if (familyRankA === Number.MAX_SAFE_INTEGER) return 1;
    if (familyRankB === Number.MAX_SAFE_INTEGER) return -1;
    return familyRankA - familyRankB;
  }
  const variantOrderA = ENGINE_VARIANT_SORT_ORDER.get(a.id);
  const variantOrderB = ENGINE_VARIANT_SORT_ORDER.get(b.id);
  if (variantOrderA != null || variantOrderB != null) {
    if (variantOrderA == null) return 1;
    if (variantOrderB == null) return -1;
    if (variantOrderA !== variantOrderB) return variantOrderA - variantOrderB;
  }
  const priorityOrderA = getEngineDiscoveryRank(a.id, registryMeta);
  const priorityOrderB = getEngineDiscoveryRank(b.id, registryMeta);
  if (priorityOrderA !== priorityOrderB) {
    if (priorityOrderA === Number.MAX_SAFE_INTEGER) return 1;
    if (priorityOrderB === Number.MAX_SAFE_INTEGER) return -1;
    return priorityOrderA - priorityOrderB;
  }
  const orderA = registryMeta?.order.get(a.id) ?? Number.MAX_SAFE_INTEGER;
  const orderB = registryMeta?.order.get(b.id) ?? Number.MAX_SAFE_INTEGER;
  return orderA - orderB;
}
