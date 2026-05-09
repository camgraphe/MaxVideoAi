import { randomUUID } from 'crypto';
import { normalizeCharacterFormatMode } from '@/lib/character-builder';
import type {
  CharacterBuilderReferenceImage,
  CharacterBuilderRequest,
  CharacterBuilderTraits,
  CharacterBuilderTraitSource,
  TraitValue,
} from '@/types/character-builder';
import { CharacterBuilderError } from './error';
import { isHairEnabled, isOutfitEnabled } from './traits';
import type { RunCharacterBuilderInput } from './types';
import { collectReferenceImages, trimString, uniqueStrings } from './utils';

function validateTraitSource(value: unknown): CharacterBuilderTraitSource {
  return value === 'auto' ? 'auto' : 'manual';
}

function sanitizeTraits(traits: CharacterBuilderRequest['traits'] | undefined): CharacterBuilderTraits {
  if (!traits) {
    throw new CharacterBuilderError('Character traits are required.', {
      status: 400,
      code: 'invalid_traits',
    });
  }

  const sanitizeTrait = <T extends string>(value: TraitValue<T> | undefined): TraitValue<T> => ({
    value:
      value && (typeof value.value === 'string' || value.value === null)
        ? (value.value as T | 'auto' | null)
        : null,
    source: validateTraitSource(value?.source),
  });

  return {
    genderPresentation: sanitizeTrait(traits.genderPresentation),
    customGenderDescription: trimString(traits.customGenderDescription),
    ageRange: sanitizeTrait(traits.ageRange),
    skinTone: sanitizeTrait(traits.skinTone),
    faceCues: sanitizeTrait(traits.faceCues),
    hairEnabled: isHairEnabled(traits),
    customHairDescription: trimString(traits.customHairDescription),
    hairColor: sanitizeTrait(traits.hairColor),
    hairLength: sanitizeTrait(traits.hairLength),
    hairstyle: sanitizeTrait(traits.hairstyle),
    eyeColor: sanitizeTrait(traits.eyeColor),
    bodyBuild: sanitizeTrait(traits.bodyBuild),
    outfitEnabled: isOutfitEnabled(traits),
    customOutfitDescription: trimString(traits.customOutfitDescription),
    outfitStyle: sanitizeTrait(traits.outfitStyle),
    accessories: uniqueStrings(Array.isArray(traits.accessories) ? traits.accessories : []),
    distinctiveFeatures: uniqueStrings(Array.isArray(traits.distinctiveFeatures) ? traits.distinctiveFeatures : []),
    customDetailsDescription: trimString(traits.customDetailsDescription),
    realismStyle:
      traits.realismStyle === 'cinematic' ||
      traits.realismStyle === 'stylized' ||
      traits.realismStyle === 'animated'
        ? traits.realismStyle
        : 'photoreal',
  };
}

function sanitizeReferenceImages(referenceImages: CharacterBuilderRequest['referenceImages'] | undefined) {
  if (!Array.isArray(referenceImages)) return [];
  return referenceImages
    .reduce<CharacterBuilderReferenceImage[]>((acc, image) => {
      const url = trimString(image?.url);
      if (!url) return acc;
      acc.push({
        id: trimString(image.id) || `ref_${randomUUID()}`,
        url,
        role: image.role === 'style' ? 'style' : 'identity',
        name: trimString(image.name) || null,
        width: typeof image.width === 'number' ? image.width : null,
        height: typeof image.height === 'number' ? image.height : null,
      });
      return acc;
    }, [])
    .slice(0, 2);
}

export function sanitizeRequest(input: RunCharacterBuilderInput): CharacterBuilderRequest {
  const referenceImages = sanitizeReferenceImages(input.referenceImages);
  const sourceMode = input.sourceMode === 'reference-image' ? 'reference-image' : 'scratch';
  const action = input.action === 'full-body-fix' || input.action === 'lighting-variant' ? input.action : 'generate';
  const outputMode = input.outputMode === 'character-sheet' ? 'character-sheet' : 'portrait-reference';
  const consistencyMode =
    input.consistencyMode === 'exploratory' || input.consistencyMode === 'strict'
      ? input.consistencyMode
      : 'balanced';
  const referenceStrength =
    input.referenceStrength === 'loose' || input.referenceStrength === 'strong'
      ? input.referenceStrength
      : input.referenceStrength === 'balanced'
        ? 'balanced'
        : null;
  const qualityMode = input.qualityMode === 'final' ? 'final' : 'draft';
  const formatMode = normalizeCharacterFormatMode(
    input.formatMode === '2k' || input.formatMode === '4k' ? input.formatMode : 'standard',
    qualityMode
  );
  const traits = sanitizeTraits(input.traits);
  const outputOptions = {
    fullBodyRequired: outputMode === 'character-sheet' ? input.outputOptions?.fullBodyRequired === true : false,
    includeCloseUps: input.outputOptions?.includeCloseUps === true,
    neutralStudioBackground: input.outputOptions?.neutralStudioBackground !== false,
    preserveFacialDetails: input.outputOptions?.preserveFacialDetails !== false,
    avoid3dRenderLook: input.outputOptions?.avoid3dRenderLook !== false,
  };

  const request: CharacterBuilderRequest = {
    action,
    sourceMode,
    outputMode,
    consistencyMode,
    referenceStrength,
    qualityMode,
    formatMode,
    referenceImages,
    traits,
    outputOptions,
    advancedNotes: trimString(input.advancedNotes),
    mustRemainVisible: uniqueStrings(Array.isArray(input.mustRemainVisible) ? input.mustRemainVisible : []),
    generateCount: input.generateCount === 4 ? 4 : 1,
    selectedResultId: trimString(input.selectedResultId) || null,
    selectedResultUrl: trimString(input.selectedResultUrl) || null,
    pinnedReferenceResultId: trimString(input.pinnedReferenceResultId) || null,
    pinnedReferenceResultUrl: trimString(input.pinnedReferenceResultUrl) || null,
    lineage: {
      parentResultId: trimString(input.lineage?.parentResultId) || null,
      parentRunId: trimString(input.lineage?.parentRunId) || null,
      pinnedReferenceResultId: trimString(input.lineage?.pinnedReferenceResultId) || null,
    },
  };

  if (request.sourceMode === 'reference-image' && !collectReferenceImages(request.referenceImages, 'identity').length) {
    throw new CharacterBuilderError('An identity reference image is required in reference-image mode.', {
      status: 400,
      code: 'identity_reference_required',
    });
  }

  if (request.action !== 'generate' && !request.selectedResultUrl) {
    throw new CharacterBuilderError('Select a result before running a refinement.', {
      status: 400,
      code: 'selected_result_required',
    });
  }

  return request;
}
