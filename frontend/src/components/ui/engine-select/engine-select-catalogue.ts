import type { EngineCaps } from '@/types/engines';
import {
  buildEngineFamilyGroups,
  type EngineFamilyGroup,
} from './engine-select-helpers';
import type { EngineRegistryMeta } from './engine-select-types';

type CatalogueSummaryArgs = {
  engines: EngineCaps[];
  visibleEngines: EngineCaps[];
  registryMeta: EngineRegistryMeta | null;
};

export type EngineSelectCatalogueSummary = {
  totalCount: number;
  visibleCount: number;
  legacyCount: number;
  hiddenLegacyCount: number;
  familyCount: number;
};

type FilterEngineFamilyGroupsArgs = {
  groups: EngineFamilyGroup[];
  query: string;
  registryMeta: EngineRegistryMeta | null;
};

function getEligibleEngines(engines: EngineCaps[]): EngineCaps[] {
  const seen = new Set<string>();
  return engines.filter((engine) => {
    if (engine.availability === 'paused' || seen.has(engine.id)) return false;
    seen.add(engine.id);
    return true;
  });
}

export function getEngineSelectCatalogueSummary({
  engines,
  visibleEngines,
  registryMeta,
}: CatalogueSummaryArgs): EngineSelectCatalogueSummary {
  const eligibleEngines = getEligibleEngines(engines);
  const eligibleIds = new Set(eligibleEngines.map((engine) => engine.id));
  const visibleIds = new Set(
    visibleEngines
      .filter((engine) => eligibleIds.has(engine.id))
      .map((engine) => engine.id),
  );
  const legacyIds = eligibleEngines
    .filter((engine) => registryMeta?.meta.get(engine.id)?.isLegacy)
    .map((engine) => engine.id);
  const familyCount = buildEngineFamilyGroups({
    engines: eligibleEngines,
    registryMeta,
    showLegacy: true,
  }).length;

  return {
    totalCount: eligibleEngines.length,
    visibleCount: visibleIds.size,
    legacyCount: legacyIds.length,
    hiddenLegacyCount: legacyIds.filter((id) => !visibleIds.has(id)).length,
    familyCount,
  };
}

export function normalizeEngineSelectQuery(value: string): string {
  return value.trim().toLowerCase();
}

function engineMatchesQuery(
  engine: EngineCaps,
  meta: EngineRegistryMeta | null,
  query: string,
  familyLabel: string,
): boolean {
  if (!query) return true;
  const entry = meta?.meta.get(engine.id);
  const haystack = [
    engine.id,
    engine.label,
    engine.provider,
    engine.providerMeta?.provider,
    engine.providerMeta?.modelSlug,
    entry?.marketingName,
    entry?.cardTitle,
    entry?.provider,
    entry?.family,
    familyLabel,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

export function filterEngineFamilyGroups({
  groups,
  query,
  registryMeta,
}: FilterEngineFamilyGroupsArgs): EngineFamilyGroup[] {
  const normalizedQuery = normalizeEngineSelectQuery(query);
  if (!normalizedQuery) return groups;

  return groups
    .map((group) => {
      const familyMatches =
        group.label.toLowerCase().includes(normalizedQuery) ||
        group.id.toLowerCase().includes(normalizedQuery);
      return {
        ...group,
        engines: familyMatches
          ? group.engines
          : group.engines.filter((engine) =>
              engineMatchesQuery(engine, registryMeta, normalizedQuery, group.label),
            ),
      };
    })
    .filter((group) => group.engines.length > 0);
}
