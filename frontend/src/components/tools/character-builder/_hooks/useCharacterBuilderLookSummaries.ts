import { useMemo } from 'react';
import type { CharacterBuilderState } from '@/types/character-builder';
import type { CharacterCopy } from '../_lib/character-builder-copy';
import type { ChoiceOption, ToggleItem } from '../_lib/character-builder-types';
import {
  buildResetCharacterBuilderState,
  countConfiguredSecondaryControls,
  findChoiceLabel,
  getHairSummary,
  getOutfitSummary,
  serializeResettableCharacterBuilderState,
  summarizeCustomText,
} from '../_lib/character-builder-summary-helpers';

type UseCharacterBuilderLookSummariesOptions = {
  accessoryOptions: ToggleItem[];
  ageOptions: ChoiceOption[];
  copy: CharacterCopy;
  distinctiveOptions: ToggleItem[];
  genderOptions: ChoiceOption[];
  hairColorOptions: ChoiceOption[];
  hairLengthOptions: ChoiceOption[];
  hairstyleOptions: ChoiceOption[];
  hasIdentityReference: boolean;
  outfitOptions: ChoiceOption[];
  realismOptions: ChoiceOption[];
  state: CharacterBuilderState;
};

export function useCharacterBuilderLookSummaries({
  accessoryOptions,
  ageOptions,
  copy,
  distinctiveOptions,
  genderOptions,
  hairColorOptions,
  hairLengthOptions,
  hairstyleOptions,
  hasIdentityReference,
  outfitOptions,
  realismOptions,
  state,
}: UseCharacterBuilderLookSummariesOptions) {
  const secondaryControlsCount = countConfiguredSecondaryControls(state, hasIdentityReference);
  const resetState = useMemo(() => buildResetCharacterBuilderState(state), [state]);
  const canResetBuilder = useMemo(
    () => serializeResettableCharacterBuilderState(state) !== serializeResettableCharacterBuilderState(resetState),
    [resetState, state]
  );
  const hairSummary = getHairSummary(
    state.traits,
    { hairColor: hairColorOptions, hairLength: hairLengthOptions, hairstyle: hairstyleOptions },
    copy
  );
  const outfitSummary = getOutfitSummary(state.traits, outfitOptions, copy);
  const accessoriesFeaturesSummary = [
    ...accessoryOptions.filter((option) => state.traits.accessories.includes(option.id)).map((option) => option.label),
    ...distinctiveOptions
      .filter((option) => state.traits.distinctiveFeatures.includes(option.id))
      .map((option) => option.label),
    summarizeCustomText(state.traits.customDetailsDescription),
  ]
    .filter(Boolean)
    .join(' · ');
  const identitySummary = `${findChoiceLabel(genderOptions, state.traits.genderPresentation.value) ?? copy.open} · ${findChoiceLabel(ageOptions, state.traits.ageRange.value) ?? copy.open}`;
  const realismSummary = findChoiceLabel(realismOptions, state.traits.realismStyle) ?? copy.summary.photoreal;

  return {
    accessoriesFeaturesSummary,
    canResetBuilder,
    hairSummary,
    identitySummary,
    outfitSummary,
    realismSummary,
    resetState,
    secondaryControlsCount,
  };
}
