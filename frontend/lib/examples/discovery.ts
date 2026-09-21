import { listRuntimeModels, type RuntimeModelEntry } from '@/config/model-runtime';
import { normalizeEngineId } from '@/lib/engine-alias';
import { getExampleModelEngineAliases } from '@/lib/model-families';

/** Public archive routes do not make a model eligible for acquisition surfaces. */
export function isDiscoverableExampleEngine(id: string, models: readonly RuntimeModelEntry[] = listRuntimeModels()): boolean {
  const canonical = normalizeEngineId(id)?.trim().toLowerCase();
  const model = models.find(candidate => candidate.id === canonical || candidate.slug === canonical);
  return Boolean(model && model.lifecycle !== 'deep_legacy' && model.lifecycle !== 'retired'
    && model.publication.app.published && model.publication.examples.published);
}

/** Include provider and historical input aliases before SQL LIMIT, never after pagination. */
export function getDiscoverableExampleEngineAliases(): string[] {
  return [...new Set(listRuntimeModels().filter(model => isDiscoverableExampleEngine(model.id)).flatMap(model => [
    model.id, model.slug, ...model.aliases.internal,
    ...getExampleModelEngineAliases(model.slug),
  ]).map(alias => alias.trim().toLowerCase()))];
}
