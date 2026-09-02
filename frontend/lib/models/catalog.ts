import type { FalEngineEntry } from '@/config/falEngines';
import { isRuntimeModelPublicCurrent, type RuntimeModelEntry } from '@/config/model-runtime';
import type { EngineCaps, Mode } from '@/types/engines';

export type ModelCatalogScope = 'all' | 'video' | 'image' | 'audio';

type EngineLike = FalEngineEntry | EngineCaps;

export const CURRENT_MODEL_CATALOG_PRIORITY = [
  'seedance-2-5',
  'minimax-h3',
  'ltx-2-5-pro',
  'ltx-2-5-fast',
  'wan-3-prime',
  'wan-3',
  'grok-imagine-video-1-5',
  'flux-3',
  'flux-3-draft',
  'seedance-2-0',
  'kling-3-pro',
  'veo-3-1',
  'happy-horse-1-1',
  'ltx-2-3-pro',
  'ltx-2-3-fast',
  'wan-2-6',
  'seedance-2-0-fast',
  'kling-3-standard',
  'kling-3-4k',
  'veo-3-1-fast',
  'veo-3-1-lite',
  'luma-ray-3-2',
  'sora-2',
  'sora-2-pro',
  'seedance-1-5-pro',
  'luma-ray-2',
  'luma-ray-2-flash',
  'pika-text-to-video',
  'kling-2-6-pro',
  'kling-2-5-turbo',
  'minimax-hailuo-02-text',
  'happy-horse-1-0',
  'gpt-image-2',
  'seedream',
  'seedream-5-0-pro',
  'nano-banana-lite',
  'nano-banana-2',
  'nano-banana-pro',
  'nano-banana',
] as const;

export function selectCurrentModelCatalogSlugs(
  models: readonly RuntimeModelEntry[],
): string[] {
  const priority = new Map<string, number>(
    CURRENT_MODEL_CATALOG_PRIORITY.map((slug, index) => [slug, index]),
  );

  return models
    .filter(
      (model) =>
        isRuntimeModelPublicCurrent(model) ||
        (model.lifecycle === 'legacy' &&
          model.publication.model.published &&
          model.publication.model.indexable),
    )
    .slice()
    .sort((left, right) => {
      const lifecycleDifference = Number(left.lifecycle === 'legacy') - Number(right.lifecycle === 'legacy');
      if (lifecycleDifference !== 0) return lifecycleDifference;
      const leftRank = priority.get(left.slug) ?? Number.MAX_SAFE_INTEGER;
      const rightRank = priority.get(right.slug) ?? Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) return leftRank - rightRank;
      const leftDiscovery = left.publication.app.discoveryRank ?? Number.MAX_SAFE_INTEGER;
      const rightDiscovery = right.publication.app.discoveryRank ?? Number.MAX_SAFE_INTEGER;
      if (leftDiscovery !== rightDiscovery) return leftDiscovery - rightDiscovery;
      return left.slug.localeCompare(right.slug, 'en');
    })
    .map((model) => model.slug);
}

function getEngineCaps(engine: EngineLike): EngineCaps {
  return 'engine' in engine ? engine.engine : engine;
}

function getEngineCategory(engine: EngineLike): FalEngineEntry['category'] | null {
  return 'category' in engine ? engine.category ?? null : null;
}

function getModeSet(engine: EngineLike): Set<Mode> {
  return new Set(getEngineCaps(engine).modes ?? []);
}

export function supportsVideoGeneration(engine: EngineLike): boolean {
  const category = getEngineCategory(engine);
  if (category === 'video' || category === 'multimodal') return true;
  const modes = getModeSet(engine);
  return (
    modes.has('t2v') ||
    modes.has('i2v') ||
    modes.has('a2v') ||
    modes.has('r2v') ||
    modes.has('extend') ||
    modes.has('retake')
  );
}

export function supportsImageGeneration(engine: EngineLike): boolean {
  const category = getEngineCategory(engine);
  if (category === 'image' || category === 'multimodal') return true;
  if (category === 'video' || category === 'audio') return false;
  const modes = getModeSet(engine);
  const hasImageGenerationMode = modes.has('t2i') || modes.has('i2i');
  if (!hasImageGenerationMode) return false;
  return !supportsVideoGeneration(engine);
}

export function supportsAudioGeneration(engine: EngineLike): boolean {
  const category = getEngineCategory(engine);
  if (category === 'audio' || category === 'multimodal') return true;
  return false;
}

export function isImageOnlyModel(engine: EngineLike): boolean {
  return supportsImageGeneration(engine) && !supportsVideoGeneration(engine) && !supportsAudioGeneration(engine);
}

export function isModelInScope(engine: EngineLike, scope: ModelCatalogScope): boolean {
  if (scope === 'all') return true;
  if (scope === 'video') return supportsVideoGeneration(engine);
  if (scope === 'image') return supportsImageGeneration(engine);
  if (scope === 'audio') return supportsAudioGeneration(engine);
  return false;
}
