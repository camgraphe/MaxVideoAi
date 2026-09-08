import type { FalEngineEntry } from '@/config/falEngines';
import type { ModelFamilyId } from '@/config/model-families';

export const ENGINE_SELECT_FAMILY_PRIORITY: readonly ModelFamilyId[] = [
  'hailuo',
  'grok',
  'seedance',
  'veo',
  'kling',
  'wan',
  'happy-horse',
  'ltx',
  'sora',
  'luma',
  'pika',
  'flux',
] as const;

const ENGINE_SELECT_FAMILY_RANK = new Map(
  ENGINE_SELECT_FAMILY_PRIORITY.map((familyId, index) => [familyId, index] as const)
);

export function getEngineSelectFamilyRank(entry: Pick<FalEngineEntry, 'family'> | null | undefined): number {
  if (!entry?.family) return Number.MAX_SAFE_INTEGER;
  return ENGINE_SELECT_FAMILY_RANK.get(entry.family as ModelFamilyId) ?? Number.MAX_SAFE_INTEGER;
}
