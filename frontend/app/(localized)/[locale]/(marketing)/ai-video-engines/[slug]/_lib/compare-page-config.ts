import compareConfig from '@/config/compare-config.json';
import engineCatalog from '@/config/engine-catalog.json';
import { listFalEngines } from '@/config/falEngines';
import { buildSlugMap } from '@/lib/i18nSlugs';
import type { EngineCaps } from '@/types/engines';
import type { EngineCatalogEntry, ShowdownEntry } from './compare-page-types';

export const COMPARE_SLUG_MAP = buildSlugMap('compare');
export const MODELS_SLUG_MAP = buildSlugMap('models');
export const TROPHY_COMPARISONS = compareConfig.trophyComparisons as string[];
export const RELATED_COMPARISONS =
  (compareConfig as { relatedComparisons?: Record<string, string[]> }).relatedComparisons ?? {};
export const EXCLUDED_ENGINE_SLUGS = new Set(['nano-banana', 'nano-banana-pro', 'nano-banana-2', 'gpt-image-2', 'seedream']);
export const SHOWDOWNS =
  (compareConfig as { showdowns?: Record<string, Array<ShowdownEntry | null>> }).showdowns ?? {};
export const SHOWDOWN_OVERRIDES =
  (compareConfig as { showdownOverrides?: Record<string, Record<string, string>> }).showdownOverrides ?? {};

type CompareCatalogEntry = EngineCatalogEntry & {
  engine?: EngineCatalogEntry['engine'] & { status?: string };
  surfaces?: {
    compare?: {
      includeInHub?: boolean;
    };
  };
};

const PUBLIC_COMPARE_STATUSES = new Set(['live', 'early_access']);
const PUBLIC_COMPARE_AVAILABILITIES = new Set(['available']);

function isPublicCompareEngine(entry: CompareCatalogEntry): boolean {
  if (!entry.modelSlug || EXCLUDED_ENGINE_SLUGS.has(entry.modelSlug)) return false;
  if (entry.surfaces?.compare?.includeInHub !== true) return false;
  const status = String(entry.engine?.status ?? '').toLowerCase();
  if (!PUBLIC_COMPARE_STATUSES.has(status)) return false;
  return PUBLIC_COMPARE_AVAILABILITIES.has(String(entry.availability ?? '').toLowerCase());
}

export const CATALOG = engineCatalog as unknown as CompareCatalogEntry[];
const PUBLIC_COMPARE_CATALOG = CATALOG.filter(isPublicCompareEngine);
export const CATALOG_BY_SLUG = new Map(PUBLIC_COMPARE_CATALOG.map((entry) => [entry.modelSlug, entry]));
export const ENGINE_OPTIONS = PUBLIC_COMPARE_CATALOG
  .map((entry) => ({ value: entry.modelSlug, label: entry.marketingName }))
  .sort((a, b) => a.label.localeCompare(b.label, 'en'));
export const PRICING_ENGINES = new Map<string, EngineCaps>(
  listFalEngines().map((entry) => [entry.modelSlug, entry.engine])
);
