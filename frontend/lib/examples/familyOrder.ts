import type { ModelFamilyId } from '@/config/model-families';

export const EXAMPLES_HUB_FAMILY_PRIORITY: readonly ModelFamilyId[] = [
  'veo',
  'seedance',
  'ltx',
  'kling',
  'wan',
  'sora',
] as const;

export function orderExamplesHubFamilyIds(familyIds: readonly ModelFamilyId[]): ModelFamilyId[] {
  const uniqueIds = familyIds.filter((familyId, index) => familyIds.indexOf(familyId) === index);
  const prioritizedIds = EXAMPLES_HUB_FAMILY_PRIORITY.filter((familyId) => uniqueIds.includes(familyId));
  const remainingIds = uniqueIds.filter((familyId) => !prioritizedIds.includes(familyId));
  return [...prioritizedIds, ...remainingIds];
}
