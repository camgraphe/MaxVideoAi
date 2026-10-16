import { normalizeEngineId } from '@/lib/engine-alias';
import type { ExampleVersionSample } from '@/server/videos-examples';

type FamilyModel = { slug: string; engineId: string; label: string };
export type ExamplesVersionLink = { href: string; engineLabel: string; current: boolean };

/** Registry identities and real prompt-bearing membership are both required. */
export function buildExamplesVersionLinks(
  models: readonly FamilyModel[],
  samples: readonly ExampleVersionSample[],
  currentSlugs: readonly string[],
): ExamplesVersionLink[] {
  const canonical = (value: string) => (normalizeEngineId(value) ?? value).trim().toLowerCase();
  const current = new Set(currentSlugs.map(canonical));
  const byModel = new Map<string, ExampleVersionSample>();
  for (const sample of samples) {
    const id = canonical(sample.engineId);
    if (!byModel.has(id) && sample.videoId.trim()) byModel.set(id, sample);
  }
  return models.flatMap(model => {
    const id = canonical(model.engineId);
    const sample = byModel.get(id);
    return sample ? [{ href: `/video/${encodeURIComponent(sample.videoId)}`, engineLabel: model.label,
      current: current.has(canonical(model.slug)) || current.has(id) }] : [];
  });
}
