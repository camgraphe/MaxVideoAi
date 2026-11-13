import type { CharacterBuilderSettingsSnapshot } from '@/types/character-builder';

/** Human-reviewable recipe; full original URLs stay only in the private job/binding. */
export function projectCharacterBuilderRecipe(recipe:CharacterBuilderSettingsSnapshot) {
  return {...recipe,builder:{...recipe.builder,referenceImages:recipe.builder.referenceImages.map(image=>({
    assetId:image.id,role:image.role,
  }))}};
}
