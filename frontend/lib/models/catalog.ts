import type { FalEngineEntry } from '@/config/falEngines';
import type { EngineCaps, Mode } from '@/types/engines';

export type ModelCatalogScope = 'all' | 'video' | 'image' | 'audio';

type EngineLike = FalEngineEntry | EngineCaps;

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
