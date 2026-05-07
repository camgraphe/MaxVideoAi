import { useMemo } from 'react';
import {
  ACCESSORY_OPTIONS,
  AGE_RANGE_OPTIONS,
  BODY_BUILD_OPTIONS,
  CHARACTER_CONSISTENCY_OPTIONS,
  CHARACTER_OUTPUT_OPTIONS,
  CHARACTER_QUALITY_OPTIONS,
  CHARACTER_REFERENCE_STRENGTH_OPTIONS,
  DISTINCTIVE_FEATURE_OPTIONS,
  EYE_COLOR_OPTIONS,
  FACE_CUES_OPTIONS,
  GENDER_PRESENTATION_OPTIONS,
  HAIR_COLOR_OPTIONS,
  HAIR_LENGTH_OPTIONS,
  HAIRSTYLE_OPTIONS,
  getAvailableCharacterFormatOptions,
  OUTFIT_STYLE_OPTIONS,
  REALISM_STYLE_OPTIONS,
  SKIN_TONE_OPTIONS,
} from '@/lib/character-builder';
import type { CharacterBuilderState } from '@/types/character-builder';
import { getFormatDisplayLabel } from '../_lib/character-builder-helpers';
import type { CharacterCopy } from '../_lib/character-builder-copy';

export function useCharacterBuilderOptions(copy: CharacterCopy, qualityMode: CharacterBuilderState['qualityMode']) {
  const genderOptions = useMemo(
    () => GENDER_PRESENTATION_OPTIONS.map((option) => ({ ...option, label: copy.options.gender[option.id as keyof typeof copy.options.gender] ?? option.label })),
    [copy]
  );
  const ageOptions = useMemo(
    () => AGE_RANGE_OPTIONS.map((option) => ({ ...option, label: copy.options.age[option.id as keyof typeof copy.options.age] ?? option.label })),
    [copy]
  );
  const skinToneOptions = useMemo(
    () => SKIN_TONE_OPTIONS.map((option) => ({ ...option, label: copy.options.skinTone[option.id as keyof typeof copy.options.skinTone] ?? option.label })),
    [copy]
  );
  const faceCueOptions = useMemo(
    () => FACE_CUES_OPTIONS.map((option) => ({ ...option, label: copy.options.faceCues[option.id as keyof typeof copy.options.faceCues] ?? option.label })),
    [copy]
  );
  const hairColorOptions = useMemo(
    () => HAIR_COLOR_OPTIONS.map((option) => ({ ...option, label: copy.options.hairColor[option.id as keyof typeof copy.options.hairColor] ?? option.label })),
    [copy]
  );
  const hairLengthOptions = useMemo(
    () => HAIR_LENGTH_OPTIONS.map((option) => ({ ...option, label: copy.options.hairLength[option.id as keyof typeof copy.options.hairLength] ?? option.label })),
    [copy]
  );
  const hairstyleOptions = useMemo(
    () => HAIRSTYLE_OPTIONS.map((option) => ({ ...option, label: copy.options.hairstyle[option.id as keyof typeof copy.options.hairstyle] ?? option.label })),
    [copy]
  );
  const eyeColorOptions = useMemo(
    () => EYE_COLOR_OPTIONS.map((option) => ({ ...option, label: copy.options.eyeColor[option.id as keyof typeof copy.options.eyeColor] ?? option.label })),
    [copy]
  );
  const bodyBuildOptions = useMemo(
    () => BODY_BUILD_OPTIONS.map((option) => ({ ...option, label: copy.options.bodyBuild[option.id as keyof typeof copy.options.bodyBuild] ?? option.label })),
    [copy]
  );
  const outfitOptions = useMemo(
    () => OUTFIT_STYLE_OPTIONS.map((option) => ({ ...option, label: copy.options.outfit[option.id as keyof typeof copy.options.outfit] ?? option.label })),
    [copy]
  );
  const realismOptions = useMemo(
    () => REALISM_STYLE_OPTIONS.map((option) => ({ ...option, label: copy.options.realism[option.id as keyof typeof copy.options.realism] ?? option.label })),
    [copy]
  );
  const accessoryOptions = useMemo(
    () => ACCESSORY_OPTIONS.map((option) => ({ ...option, label: copy.options.accessories[option.id as keyof typeof copy.options.accessories] ?? option.label })),
    [copy]
  );
  const distinctiveOptions = useMemo(
    () => DISTINCTIVE_FEATURE_OPTIONS.map((option) => ({ ...option, label: copy.options.distinctive[option.id as keyof typeof copy.options.distinctive] ?? option.label })),
    [copy]
  );
  const outputModeOptions = useMemo(
    () =>
      CHARACTER_OUTPUT_OPTIONS.map((option) => ({
        ...option,
        label: copy.options.outputMode[option.id].label,
        description: copy.options.outputMode[option.id].description,
      })),
    [copy]
  );
  const consistencyOptions = useMemo(
    () =>
      CHARACTER_CONSISTENCY_OPTIONS.map((option) => ({
        ...option,
        label: copy.options.consistency[option.id].label,
        description: copy.options.consistency[option.id].description,
      })),
    [copy]
  );
  const referenceStrengthOptions = useMemo(
    () =>
      CHARACTER_REFERENCE_STRENGTH_OPTIONS.map((option) => ({
        ...option,
        label: copy.options.referenceStrength[option.id].label,
        description: copy.options.referenceStrength[option.id].description,
      })),
    [copy]
  );
  const qualityOptions = useMemo(
    () =>
      CHARACTER_QUALITY_OPTIONS.map((option) => ({
        ...option,
        label: copy.options.quality[option.id].label,
        description: copy.options.quality[option.id].description,
      })),
    [copy]
  );
  const formatOptions = useMemo(
    () =>
      getAvailableCharacterFormatOptions(qualityMode).map((option) => ({
        ...option,
        label: getFormatDisplayLabel(copy, option.id, qualityMode),
        description: copy.options.format[option.id].description,
      })),
    [copy, qualityMode]
  );

  const outputModeLabelOptions = useMemo(
    () => outputModeOptions.map((option) => ({ id: option.id, label: option.label })),
    [outputModeOptions]
  );
  const qualityLabelOptions = useMemo(
    () => qualityOptions.map((option) => ({ id: option.id, label: option.label })),
    [qualityOptions]
  );
  const formatLabelOptions = useMemo(
    () => formatOptions.map((option) => ({ id: option.id, label: option.label })),
    [formatOptions]
  );

  return {
    genderOptions,
    ageOptions,
    skinToneOptions,
    faceCueOptions,
    hairColorOptions,
    hairLengthOptions,
    hairstyleOptions,
    eyeColorOptions,
    bodyBuildOptions,
    outfitOptions,
    realismOptions,
    accessoryOptions,
    distinctiveOptions,
    outputModeOptions,
    consistencyOptions,
    referenceStrengthOptions,
    qualityOptions,
    formatOptions,
    outputModeLabelOptions,
    qualityLabelOptions,
    formatLabelOptions,
  };
}
