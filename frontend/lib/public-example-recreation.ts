import { listFalEngines } from '@/config/falEngines';
import { normalizeEngineId } from '@/lib/engine-alias';
import { getBaseEngines } from '@/lib/engines';

const published = new Set(
  listFalEngines()
    .filter((entry) => entry.surfaces.app.enabled && entry.surfaces.modelPage.indexable)
    .map((entry) => entry.id)
);
const recreatableEngines = new Set(getBaseEngines().filter((engine) => published.has(engine.id)).map((engine) => engine.id));

export function canRecreatePublicExample(engineId: string | null | undefined): boolean {
  if (!engineId) return false;
  const sourceId = normalizeEngineId(engineId) ?? engineId;
  return recreatableEngines.has(sourceId);
}
