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
export const EXCLUDED_ENGINE_SLUGS = new Set([
  'nano-banana',
  'nano-banana-pro',
  'nano-banana-2',
  'gpt-image-2',
  'seedream',
  'luma-uni-1',
  'luma-uni-1-max',
]);
export const SHOWDOWNS =
  (compareConfig as { showdowns?: Record<string, Array<ShowdownEntry | null>> }).showdowns ?? {};
export const SHOWDOWN_OVERRIDES =
  (compareConfig as { showdownOverrides?: Record<string, Record<string, string>> }).showdownOverrides ?? {};
export const CATALOG = engineCatalog as unknown as EngineCatalogEntry[];
export const CATALOG_BY_SLUG = new Map(CATALOG.map((entry) => [entry.modelSlug, entry]));
export const ENGINE_OPTIONS = [...CATALOG]
  .filter((entry) => !EXCLUDED_ENGINE_SLUGS.has(entry.modelSlug))
  .map((entry) => ({ value: entry.modelSlug, label: entry.marketingName }))
  .sort((a, b) => a.label.localeCompare(b.label, 'en'));
export const PRICING_ENGINES = new Map<string, EngineCaps>(
  listFalEngines().map((entry) => [entry.modelSlug, entry.engine])
);
