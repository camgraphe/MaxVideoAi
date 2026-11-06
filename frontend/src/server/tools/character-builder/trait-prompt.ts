import { STUDIO_EYES, STUDIO_CHARACTER_TYPES } from '@/lib/character-studio-catalog';
import {
  getAccessoryPrompt,
  getDistinctiveFeaturePrompt,
  getRealismPrompt,
  getTraitOptionPrompt,
} from '@/lib/character-builder';
import type { CharacterBuilderTraits } from '@/types/character-builder';
import {
  getCustomHairDescription,
  getCustomOutfitDescription,
  hasFlexibleCharacterAnatomy,
  isHairEnabled,
  isOutfitEnabled,
} from './traits';
import { trimString } from './utils';

export function buildTraitPrompt(traits: CharacterBuilderTraits): string[] {
  const parts: string[] = [];
  const pushValue = (value: string | null) => {
    if (value) parts.push(value);
  };
  const pushTrait = (
    key: keyof Pick<
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
    >,
  ) => {
    const trait = traits[key];
    if (!trait || typeof trait !== 'object' || !('value' in trait)) return;
    if (trait.value == null || trait.value === 'auto') return;
    if (key === 'genderPresentation' && trait.value === 'custom') {
      const customGenderDescription = trimString(traits.customGenderDescription);
      if (customGenderDescription) {
        parts.push(customGenderDescription);
      }
      return;
    }
    pushValue(getTraitOptionPrompt(key, trait.value));
  };

  pushTrait('genderPresentation');
  pushTrait('ageRange');
  pushTrait('skinTone');
  pushTrait('faceCues');
  if (isHairEnabled(traits)) {
    const customHairDescription = getCustomHairDescription(traits);
    if (customHairDescription) {
      parts.push(customHairDescription);
    } else {
      if (traits.hairstyle.value !== 'bald') {
        pushTrait('hairColor');
        pushTrait('hairLength');
      }
      pushTrait('hairstyle');
    }
  }
  pushTrait('eyeColor');
  pushValue(STUDIO_EYES.find((entry) => entry.id === traits.eyeShape?.value)?.prompt ?? null);
  pushTrait('bodyBuild');
  if (isOutfitEnabled(traits)) {
    const customOutfitDescription = getCustomOutfitDescription(traits);
    if (customOutfitDescription) {
      parts.push(customOutfitDescription);
    } else {
      pushTrait('outfitStyle');
    }
  }

  traits.accessories.forEach((value) => pushValue(getAccessoryPrompt(value)));
  traits.distinctiveFeatures.forEach((value) => pushValue(getDistinctiveFeaturePrompt(value)));
  if (trimString(traits.customDetailsDescription)) {
    pushValue(trimString(traits.customDetailsDescription));
  }
  pushValue(getRealismPrompt(traits.realismStyle));

  const customConcept = trimString(traits.customCharacterDescription);
  const concept =
    customConcept || STUDIO_CHARACTER_TYPES.find((entry) => entry.id === traits.characterType?.value)?.prompt;
  if (hasFlexibleCharacterAnatomy(traits)) {
    return [
      `Character concept: ${concept}`,
      'The character concept takes priority over conflicting appearance choices. Preserve its species, head shape and material. For a nonhuman concept, do not force human anatomy or depict a person wearing a mask',
      `Supporting appearance directions, only where compatible with this concept: ${parts.join(', ')}`,
    ];
  }
  return concept ? [concept, ...parts] : parts;
}
