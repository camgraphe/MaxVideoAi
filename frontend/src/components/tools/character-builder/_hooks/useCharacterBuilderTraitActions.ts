import type { Dispatch, SetStateAction } from 'react';
import { useCallback } from 'react';
import { normalizeTraitsForSourceMode } from '@/lib/character-builder';
import type {
  CharacterBuilderState,
  CharacterBuilderTraitSource,
  CharacterBuilderTraits,
  CharacterBuilderReferenceImage,
} from '@/types/character-builder';
import type { BuildLookSectionKey } from '../_components/character-builder-workspace-components';
import type { CharacterCopy } from '../_lib/character-builder-copy';
import {
  getRefByRole,
  hasCustomHairSettings,
  hasCustomOutfitSettings,
  normalizeTag,
} from '../_lib/character-builder-helpers';

type TraitChoiceKey = keyof Pick<
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

type UseCharacterBuilderTraitActionsOptions = {
  copy: CharacterCopy;
  mustRemainDraft: string;
  resetState: CharacterBuilderState;
  setActiveBuildSection: Dispatch<SetStateAction<BuildLookSectionKey>>;
  setAdvancedOpen: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setHairOpen: Dispatch<SetStateAction<boolean>>;
  setMustRemainDraft: Dispatch<SetStateAction<string>>;
  setShowStyleReferenceSlot: Dispatch<SetStateAction<boolean>>;
  setState: Dispatch<SetStateAction<CharacterBuilderState>>;
  setStatusMessage: Dispatch<SetStateAction<string | null>>;
};

export function useCharacterBuilderTraitActions({
  copy,
  mustRemainDraft,
  resetState,
  setActiveBuildSection,
  setAdvancedOpen,
  setError,
  setHairOpen,
  setMustRemainDraft,
  setShowStyleReferenceSlot,
  setState,
  setStatusMessage,
}: UseCharacterBuilderTraitActionsOptions) {
  const updateTrait = useCallback(<K extends TraitChoiceKey>(key: K, value: string | 'auto') => {
    setState((previous) => {
      const nextTraits = {
        ...previous.traits,
        [key]: {
          value,
          source: (value === 'auto' ? 'auto' : 'manual') as CharacterBuilderTraitSource,
        },
      } as CharacterBuilderTraits;

      if (key === 'hairColor' || key === 'hairLength' || key === 'hairstyle') {
        nextTraits.hairEnabled = hasCustomHairSettings(nextTraits);
      }

      if (key === 'outfitStyle') {
        nextTraits.outfitEnabled = hasCustomOutfitSettings(nextTraits);
      }

      return {
        ...previous,
        traits: nextTraits,
      };
    });
  }, [setState]);

  const toggleListValue = useCallback((key: 'accessories' | 'distinctiveFeatures', value: string) => {
    setState((previous) => {
      const current = previous.traits[key];
      const nextValues = current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value];
      return {
        ...previous,
        traits: {
          ...previous.traits,
          [key]: nextValues,
        },
      };
    });
  }, [setState]);

  const handleResetBuilder = useCallback(() => {
    setState(resetState);
    setAdvancedOpen(false);
    setHairOpen(false);
    setActiveBuildSection('identity');
    setShowStyleReferenceSlot(Boolean(getRefByRole(resetState.referenceImages, 'style')));
    setMustRemainDraft('');
    setError(null);
    setStatusMessage(copy.resetDone);
  }, [
    copy.resetDone,
    resetState,
    setActiveBuildSection,
    setAdvancedOpen,
    setError,
    setHairOpen,
    setMustRemainDraft,
    setShowStyleReferenceSlot,
    setState,
    setStatusMessage,
  ]);

  const addMustRemainTag = useCallback(() => {
    const tag = normalizeTag(mustRemainDraft);
    if (!tag) return;
    setState((previous) => ({
      ...previous,
      mustRemainVisible: previous.mustRemainVisible.includes(tag)
        ? previous.mustRemainVisible
        : [...previous.mustRemainVisible, tag],
    }));
    setMustRemainDraft('');
  }, [mustRemainDraft, setMustRemainDraft, setState]);

  const removeMustRemainTag = useCallback((tag: string) => {
    setState((previous) => ({
      ...previous,
      mustRemainVisible: previous.mustRemainVisible.filter((entry) => entry !== tag),
    }));
  }, [setState]);

  const handleSelectResult = useCallback((resultId: string) => {
    setState((previous) => ({
      ...previous,
      selectedResultId: resultId,
    }));
  }, [setState]);

  const removeIdentityReference = useCallback(() => {
    setState((previous) => ({
      ...previous,
      sourceMode: previous.sourceMode === 'reference-image' ? 'scratch' : previous.sourceMode,
      referenceStrength: previous.sourceMode === 'reference-image' ? null : previous.referenceStrength,
      referenceImages: previous.referenceImages.filter(
        (image: CharacterBuilderReferenceImage) => image.role !== 'identity'
      ),
      traits:
        previous.sourceMode === 'reference-image'
          ? normalizeTraitsForSourceMode(previous.traits, 'scratch')
          : previous.traits,
    }));
  }, [setState]);

  const removeStyleReference = useCallback(() => {
    setShowStyleReferenceSlot(false);
    setState((previous) => ({
      ...previous,
      referenceImages: previous.referenceImages.filter(
        (image: CharacterBuilderReferenceImage) => image.role !== 'style'
      ),
    }));
  }, [setShowStyleReferenceSlot, setState]);

  return {
    addMustRemainTag,
    handleResetBuilder,
    handleSelectResult,
    removeIdentityReference,
    removeMustRemainTag,
    removeStyleReference,
    toggleListValue,
    updateTrait,
  };
}
