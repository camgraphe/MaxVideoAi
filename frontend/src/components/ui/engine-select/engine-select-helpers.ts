import type { FalEngineEntry } from '@/config/falEngines';
import type { EngineCaps, Mode, Resolution } from '@/types/engines';
import { getModelFamilyDefinition } from '@/config/model-families';
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

const FAMILY_LABEL_OVERRIDES: Record<string, string> = {
  generic: 'Other',
  'gpt-image': 'GPT Image',
  'luma-uni': 'Luma Uni',
  'nano-banana': 'Nano Banana',
  seedream: 'Seedream',
};

export type EngineFamilyGroup = {
  id: string;
  label: string;
  brandId?: string;
  rank: number;
  engines: EngineCaps[];
};

export type EngineScoreMap = Record<string, number | null | undefined>;

type BuildEngineFamilyGroupsArgs = {
  engines: EngineCaps[];
  engineScores?: EngineScoreMap;
  registryMeta: EngineRegistryMeta | null;
  selectedEngineId?: string | null;
  showLegacy?: boolean;
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

export function getCompactModeLabel(value: Mode): string {
  const labels: Record<Mode, string> = {
    a2v: 'A2V',
    extend: 'EXT',
    fl2v: 'FL',
    i2i: 'IMG',
    i2v: 'I2V',
    ref2v: 'REF',
    reframe: 'REFR',
    retake: 'RET',
    r2v: 'R2V',
    t2i: 'IMG',
    t2v: 'T',
    v2v: 'V2V',
  };
  return labels[value] ?? value.toUpperCase();
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

function getEngineScoreValue(engine: EngineCaps, engineScores?: EngineScoreMap): number | null {
  const value = engineScores?.[engine.id];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function compareEngineScores(a: EngineCaps, b: EngineCaps, engineScores?: EngineScoreMap): number {
  const scoreA = getEngineScoreValue(a, engineScores);
  const scoreB = getEngineScoreValue(b, engineScores);
  if (scoreA == null && scoreB == null) return 0;
  if (scoreA == null) return 1;
  if (scoreB == null) return -1;
  if (scoreA !== scoreB) return scoreB - scoreA;
  return 0;
}

function toTitleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getFallbackFamilyId(engine: EngineCaps, meta: FalEngineEntry | undefined): string {
  const raw =
    meta?.family ??
    meta?.brandId ??
    engine.brandId ??
    engine.providerMeta?.provider ??
    engine.provider ??
    engine.id.split('-')[0] ??
    'generic';
  return raw.trim().toLowerCase().replace(/\s+/g, '-');
}

function getFamilyLabel(familyId: string): string {
  const family = getModelFamilyDefinition(familyId);
  return family?.label ?? FAMILY_LABEL_OVERRIDES[familyId] ?? toTitleCase(familyId);
}

function getFamilyBrandId(familyId: string, firstEngine: EngineCaps, firstMeta: FalEngineEntry | undefined): string | undefined {
  const family = getModelFamilyDefinition(familyId);
  return family?.brandId ?? firstMeta?.brandId ?? firstEngine.brandId;
}

function getFamilyRank(familyId: string, engines: EngineCaps[], registryMeta: EngineRegistryMeta | null): number {
  const rankedEntries = engines
    .map((engine) => getEngineSelectFamilyRank(registryMeta?.meta.get(engine.id)))
    .filter((rank) => rank !== Number.MAX_SAFE_INTEGER);
  if (rankedEntries.length) return Math.min(...rankedEntries);

  const syntheticRank = getEngineSelectFamilyRank({ family: familyId } as Pick<FalEngineEntry, 'family'>);
  return syntheticRank;
}

export function buildEngineFamilyGroups({
  engines,
  engineScores,
  registryMeta,
  selectedEngineId = null,
  showLegacy = false,
}: BuildEngineFamilyGroupsArgs): EngineFamilyGroup[] {
  const sortedEngines = engines
    .filter((engine) => engine.availability !== 'paused')
    .filter((engine) => {
      const meta = registryMeta?.meta.get(engine.id);
      if (!meta?.isLegacy) return true;
      if (showLegacy) return true;
      return engine.id === selectedEngineId;
    })
    .sort((a, b) => compareEnginesByDefaultPriority(a, b, registryMeta, undefined, engineScores));

  const groupsById = new Map<string, EngineCaps[]>();
  sortedEngines.forEach((engine) => {
    const meta = registryMeta?.meta.get(engine.id);
    const familyId = getFallbackFamilyId(engine, meta);
    const group = groupsById.get(familyId) ?? [];
    group.push(engine);
    groupsById.set(familyId, group);
  });

  return Array.from(groupsById.entries())
    .map(([familyId, groupEngines]) => {
      const firstEngine = groupEngines[0];
      const firstMeta = registryMeta?.meta.get(firstEngine.id);
      return {
        id: familyId,
        label: getFamilyLabel(familyId),
        brandId: getFamilyBrandId(familyId, firstEngine, firstMeta),
        rank: getFamilyRank(familyId, groupEngines, registryMeta),
        engines: groupEngines,
      };
    })
    .sort((a, b) => {
      if (a.rank !== b.rank) {
        if (a.rank === Number.MAX_SAFE_INTEGER) return 1;
        if (b.rank === Number.MAX_SAFE_INTEGER) return -1;
        return a.rank - b.rank;
      }
      const discoveryA = getEngineDiscoveryRank(a.engines[0].id, registryMeta);
      const discoveryB = getEngineDiscoveryRank(b.engines[0].id, registryMeta);
      if (discoveryA !== discoveryB) return discoveryA - discoveryB;
      return a.label.localeCompare(b.label);
    });
}

export function formatEngineSelectScore(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value.toFixed(1);
}

export function formatEngineSelectScorePercent(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return String(Math.round(value * 10));
}

export function compareEnginesByDefaultPriority(
  a: EngineCaps,
  b: EngineCaps,
  registryMeta: EngineRegistryMeta | null,
  engineMeta?: Map<string, FalEngineEntry>,
  engineScores?: EngineScoreMap
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
  const scoreOrder = compareEngineScores(a, b, engineScores);
  if (scoreOrder !== 0) return scoreOrder;
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
