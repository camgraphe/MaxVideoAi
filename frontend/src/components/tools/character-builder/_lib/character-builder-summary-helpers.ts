import { createDefaultCharacterBuilderState } from '@/lib/character-builder';
import type {
  CharacterBuilderState,
  CharacterBuilderTraits,
} from '@/types/character-builder';
import type { CharacterCopy } from './character-builder-copy';
import {
  hasCustomHairSettings,
  hasCustomOutfitSettings,
} from './character-builder-helpers';

export function findChoiceLabel(options: Array<{ id: string; label: string }>, value: string | null | undefined): string | null {
  if (!value) return null;
  return options.find((option) => option.id === value)?.label ?? null;
}

export function describeTraitValue(
  options: Array<{ id: string; label: string }>,
  value: string | null | undefined,
  copy: CharacterCopy
): string {
  if (value === 'auto') return copy.auto;
  return findChoiceLabel(options, value) ?? copy.notSet;
}

export function summarizeCustomText(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '';
  return trimmed.length > 44 ? `${trimmed.slice(0, 41).trim()}...` : trimmed;
}

export function findChoiceSwatch(
  options: Array<{ id: string; swatch?: string }>,
  value: string | null | undefined
): string | null {
  if (!value || value === 'auto') return null;
  return options.find((option) => option.id === value)?.swatch ?? null;
}

export function getHairSummary(
  traits: CharacterBuilderTraits,
  options: {
    hairColor: Array<{ id: string; label: string }>;
    hairLength: Array<{ id: string; label: string }>;
    hairstyle: Array<{ id: string; label: string }>;
  },
  copy: CharacterCopy
): string {
  if (!hasCustomHairSettings(traits)) {
    return copy.auto;
  }

  const customSummary = summarizeCustomText(traits.customHairDescription);
  if (customSummary) {
    return customSummary;
  }

  const values = [
    describeTraitValue(options.hairColor, traits.hairColor.value, copy),
    describeTraitValue(options.hairLength, traits.hairLength.value, copy),
    describeTraitValue(options.hairstyle, traits.hairstyle.value, copy),
  ];

  const filteredValues = values.filter(
    (value, index, array) => value !== copy.notSet || array.every((entry) => entry === copy.notSet)
  );

  const meaningfulValues = filteredValues.filter((value) => value !== copy.notSet);
  if (!meaningfulValues.length) return copy.notSet;
  return meaningfulValues.join(' / ');
}

export function getOutfitSummary(
  traits: CharacterBuilderTraits,
  options: Array<{ id: string; label: string }>,
  copy: CharacterCopy
): string {
  if (!hasCustomOutfitSettings(traits)) {
    return copy.auto;
  }

  const customSummary = summarizeCustomText(traits.customOutfitDescription);
  if (customSummary) {
    return customSummary;
  }

  return describeTraitValue(options, traits.outfitStyle.value, copy);
}

export function countConfiguredSecondaryControls(state: CharacterBuilderState, hasIdentityReference: boolean): number {
  let count = 0;

  const traitValues: Array<string | null> = [
    state.traits.skinTone.value,
    state.traits.faceCues.value,
    state.traits.eyeColor.value,
    state.traits.bodyBuild.value,
  ];
  count += traitValues.filter((value) => value != null && value !== 'auto').length;
  count += state.traits.accessories.length;
  count += state.traits.distinctiveFeatures.length;
  if (state.traits.customDetailsDescription?.trim().length) count += 1;
  count += state.mustRemainVisible.length;
  if (state.consistencyMode !== 'balanced') count += 1;
  if (hasIdentityReference && state.referenceStrength && state.referenceStrength !== 'balanced') count += 1;
  if (state.advancedNotes.trim().length) count += 1;
  if (state.outputMode === 'character-sheet' && !state.outputOptions.includeCloseUps) count += 1;
  if (!state.outputOptions.neutralStudioBackground) count += 1;
  if (!state.outputOptions.preserveFacialDetails) count += 1;
  if (!state.outputOptions.avoid3dRenderLook) count += 1;

  return count;
}

export function buildResetCharacterBuilderState(state: CharacterBuilderState): CharacterBuilderState {
  const defaults = createDefaultCharacterBuilderState(state.sourceMode);
  return {
    ...state,
    traits: defaults.traits,
    outputMode: defaults.outputMode,
    consistencyMode: defaults.consistencyMode,
    referenceStrength: defaults.referenceStrength,
    qualityMode: defaults.qualityMode,
    formatMode: defaults.formatMode,
    outputOptions: defaults.outputOptions,
    advancedNotes: defaults.advancedNotes,
    mustRemainVisible: defaults.mustRemainVisible,
    selectedResultId: null,
    pinnedReferenceResultId: null,
  };
}

export function serializeResettableCharacterBuilderState(state: CharacterBuilderState): string {
  return JSON.stringify({
    sourceMode: state.sourceMode,
    traits: state.traits,
    outputMode: state.outputMode,
    consistencyMode: state.consistencyMode,
    referenceStrength: state.referenceStrength,
    qualityMode: state.qualityMode,
    formatMode: state.formatMode,
    outputOptions: state.outputOptions,
    advancedNotes: state.advancedNotes,
    mustRemainVisible: state.mustRemainVisible,
    selectedResultId: state.selectedResultId,
    pinnedReferenceResultId: state.pinnedReferenceResultId,
  });
}
