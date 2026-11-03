import { createDefaultCharacterBuilderState } from '@/lib/character-builder';
import type { CharacterBuilderState } from '@/types/character-builder';

export const CHARACTER_INSPIRATIONS = [
  {
    name: 'Alba',
    tile: 0,
    gender: 'woman',
    age: 'adult',
    hair: 'wavy-bob',
    color: 'brown',
    skin: 'medium',
    outfit: 'business',
    scene: 'brown_photostudio_01',
  },
  {
    name: 'Noor',
    tile: 1,
    gender: 'woman',
    age: 'adult',
    hair: 'afro',
    color: 'black',
    skin: 'rich',
    outfit: 'casual',
    scene: 'homecoming_center_rooftop',
  },
  {
    name: 'Sora',
    tile: 2,
    gender: 'androgynous',
    age: 'adult',
    hair: 'short-crop',
    color: 'black',
    skin: 'light',
    outfit: 'casual',
    scene: 'blue_photo_studio',
  },
  {
    name: 'Elias',
    tile: 3,
    gender: 'man',
    age: 'senior',
    hair: 'short-crop',
    color: 'gray',
    skin: 'medium',
    outfit: 'casual',
    scene: 'art_studio',
  },
  {
    name: 'Mateo',
    tile: 6,
    gender: 'man',
    age: 'adult',
    hair: 'curly',
    color: 'brown',
    skin: 'olive',
    outfit: 'casual',
    scene: 'brown_photostudio_01',
  },
  {
    name: 'Iris',
    tile: 7,
    gender: 'woman',
    age: 'adult',
    hair: 'curly',
    color: 'red',
    skin: 'fair',
    outfit: 'bohemian',
    scene: 'epping_forest_02',
  },
] as const;

/** A new draft must never delete finished images or interfere with pending jobs. */
export function startNewCharacter(previous: CharacterBuilderState): CharacterBuilderState {
  return {
    ...createDefaultCharacterBuilderState(),
    runs: previous.runs,
    refinementHistory: previous.refinementHistory,
  };
}

export function applyCharacterInspiration(previous: CharacterBuilderState, name: string): CharacterBuilderState {
  const preset = CHARACTER_INSPIRATIONS.find((entry) => entry.name === name);
  if (!preset) return previous;
  const next = startNewCharacter(previous);
  const manual = <T extends string>(value: T) => ({ value, source: 'manual' as const });
  return {
    ...next,
    traits: {
      ...next.traits,
      genderPresentation: manual(preset.gender),
      ageRange: manual(preset.age),
      hairstyle: manual(preset.hair),
      hairColor: manual(preset.color),
      hairEnabled: true,
      skinTone: manual(preset.skin),
      outfitStyle: manual(preset.outfit),
      outfitEnabled: true,
      sceneId: preset.scene,
      distinctiveFeatures: preset.name === 'Iris' ? ['freckles'] : preset.name === 'Elias' ? ['beard'] : [],
    },
  };
}
