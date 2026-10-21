import { getCurationAliases } from './curation-store';
import { expandCatalogAliases } from './curation-eligibility';
import { getExamplesHubPlaylistSlug } from './slugs';
import { listRuntimeModels, type RuntimeModelEntry } from '@/config/model-runtime';
import { isDiscoverableExampleEngine } from '@/lib/examples/discovery';
import { getExampleFamilyIds, getExampleModelEngineAliases } from '@/lib/model-families';

export const usesCatalogCurationAliases = (slug: string) =>
  slug === getExamplesHubPlaylistSlug() || slug.startsWith('family-');

/** Admin can prepare family membership before asset readiness. Public readers keep their separate readiness gate. */
export function getCurationCandidateAliases(slug: string, models: readonly RuntimeModelEntry[] = listRuntimeModels()): string[] | null {
  if (slug.startsWith('family-')) {
    const familyId = slug.slice(7);
    if (!getExampleFamilyIds().some(id => id === familyId)) return null;
    return [...new Set(models.filter(model => model.family === familyId && isDiscoverableExampleEngine(model.id,models))
      .flatMap(model => [model.id,model.slug,...model.aliases.internal,...getExampleModelEngineAliases(model.slug)])
      .map(alias => alias.toLowerCase()))];
  }
  const aliases = getCurationAliases(slug);
  if (!aliases) return null;
  return usesCatalogCurationAliases(slug) ? expandCatalogAliases(aliases) : aliases.map(alias => alias.toLowerCase());
}
