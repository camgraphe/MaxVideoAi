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
    // An unversioned engine identity can now route to a newer generation. Keep
    // recorded numeric versions out of Current versions without treating a
    // provider prefix or other harmless label formatting as a version change.
    const recordedVersion = sample?.engineLabel?.match(/\b\d+(?:\.\d+)*\b/g)?.join('.');
    const currentVersion = model.label.match(/\b\d+(?:\.\d+)*\b/g)?.join('.');
    const historicalVersion = Boolean(recordedVersion && currentVersion && recordedVersion !== currentVersion);
    return sample ? [{ href: `/video/${encodeURIComponent(sample.videoId)}`, engineLabel: sample.engineLabel || model.label,
      current: !historicalVersion && (current.has(canonical(model.slug)) || current.has(id)) }] : [];
  });
}
