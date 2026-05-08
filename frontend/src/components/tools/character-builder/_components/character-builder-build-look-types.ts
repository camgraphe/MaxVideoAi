import type { CharacterBuilderTraits } from '@/types/character-builder';

export type TraitChoiceKey = keyof Pick<
  CharacterBuilderTraits,
  | 'genderPresentation'
  | 'ageRange'
  | 'skinTone'
  | 'faceCues'
  | 'hairColor'
  | 'hairLength'
  | 'hairstyle'
  | 'eyeColor'
  | 'bodyBuild'
  | 'outfitStyle'
>;
