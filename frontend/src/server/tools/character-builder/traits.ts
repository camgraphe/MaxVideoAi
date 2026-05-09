import type { CharacterBuilderTraits } from '@/types/character-builder';
import { trimString, uniqueStrings } from './utils';

export function isHairEnabled(traits: CharacterBuilderTraits): boolean {
  return (
    trimString(traits.customHairDescription).length > 0 ||
    [traits.hairColor.value, traits.hairLength.value, traits.hairstyle.value].some(
      (value) => typeof value === 'string' && value !== 'auto'
    )
  );
}

export function isOutfitEnabled(traits: CharacterBuilderTraits): boolean {
  return (
    trimString(traits.customOutfitDescription).length > 0 ||
    (typeof traits.outfitStyle.value === 'string' && traits.outfitStyle.value !== 'auto')
  );
}

export function getCustomHairDescription(traits: CharacterBuilderTraits): string {
  return trimString(traits.customHairDescription);
}

export function getCustomOutfitDescription(traits: CharacterBuilderTraits): string {
  return trimString(traits.customOutfitDescription);
}

export function joinPromptList(values: string[]): string {
  const filtered = values.filter(Boolean);
  if (filtered.length <= 1) return filtered[0] ?? '';
  if (filtered.length === 2) return `${filtered[0]} and ${filtered[1]}`;
  return `${filtered.slice(0, -1).join(', ')}, and ${filtered[filtered.length - 1]}`;
}

function getCloseUpDetailLabels(traits: CharacterBuilderTraits): string[] {
  const labels: string[] = [];

  for (const value of traits.accessories) {
    switch (value) {
      case 'earrings':
        labels.push('earrings');
        break;
      case 'glasses':
        labels.push('glasses');
        break;
      case 'sunglasses':
        labels.push('sunglasses');
        break;
      case 'hat':
        labels.push('hat');
        break;
      case 'headscarf':
        labels.push('headscarf');
        break;
    }
  }

  for (const value of traits.distinctiveFeatures) {
    switch (value) {
      case 'makeup':
        labels.push('makeup');
        break;
      case 'freckles':
        labels.push('freckles');
        break;
      case 'scar':
        labels.push('scar');
        break;
      case 'piercing':
        labels.push('piercing');
        break;
      case 'beard':
        labels.push('beard');
        break;
      case 'beauty-mark':
        labels.push('beauty mark');
        break;
      case 'wrinkles':
        labels.push('wrinkles');
        break;
    }
  }

  return uniqueStrings(labels);
}

export function buildCloseUpIdentityParts(traits: CharacterBuilderTraits): string {
  const parts = ['same face'];
  if (isHairEnabled(traits)) parts.push('hairstyle');
  parts.push(...getCloseUpDetailLabels(traits));
  parts.push('distinctive identity cues');
  return joinPromptList(parts);
}

export function buildAnchorParts(traits: CharacterBuilderTraits): string {
  const parts = ['face', 'proportions'];
  if (isHairEnabled(traits)) parts.push('hairstyle');
  return parts.join(', ');
}

export function buildPreservationParts(traits: CharacterBuilderTraits): string {
  const parts = ['same face'];
  if (isHairEnabled(traits)) parts.push('hairstyle');
  parts.push('proportions');
  if (isOutfitEnabled(traits)) parts.push('outfit identity');
  parts.push('distinctive visible markers');
  return parts.join(', ');
}

export function buildLightingPreservationParts(traits: CharacterBuilderTraits): string {
  const parts = ['same person', 'facial identity'];
  if (isHairEnabled(traits)) parts.push('hairstyle');
  parts.push('proportions');
  if (isOutfitEnabled(traits)) parts.push('outfit');
  parts.push('signature details');
  return parts.join(', ');
}
