import { getFalEngineById, getFalEngineBySlug, type FalEngineEntry } from '@/config/falEngines';
import { DEFAULT_ENGINE_GUIDE } from '@/lib/engine-guides';
import { normalizeEngineId } from '@/lib/engine-alias';

export function resolveEngineEntry(engineId?: string | null): FalEngineEntry | null {
  if (!engineId) return null;
  const normalized = normalizeEngineId(engineId) ?? engineId;
  return getFalEngineById(normalized) ?? getFalEngineBySlug(normalized) ?? null;
}

export function buildEngineBadges(engineEntry: FalEngineEntry | null): string[] {
  if (!engineEntry) return [];
  const guide = DEFAULT_ENGINE_GUIDE[engineEntry.modelSlug];
  if (guide?.badges?.length) return guide.badges.slice(0, 3);

  const badges: string[] = [];
  if (engineEntry.engine.modes.includes('i2v')) badges.push('Image input');
  if (engineEntry.engine.modes.includes('r2v')) badges.push('Reference video');
  if (engineEntry.engine.audio) badges.push('Audio option');
  if (engineEntry.engine.motionControls) badges.push('Motion controls');
  if (engineEntry.engine.maxDurationSec) badges.push(`${engineEntry.engine.maxDurationSec}s max`);
  return badges.slice(0, 3);
}
