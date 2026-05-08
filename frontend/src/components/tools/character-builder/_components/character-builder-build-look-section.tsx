'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/Button';
import { normalizeCharacterFormatMode } from '@/lib/character-builder';
import type {
  CharacterBuilderReferenceImage,
  CharacterBuilderState,
} from '@/types/character-builder';
import {
  CharacterBuilderStickyDock,
  SectionTitle,
  type BuildLookSectionKey,
} from './character-builder-workspace-components';
import type { CharacterCopy } from '../_lib/character-builder-copy';
import type { ChoiceOption, ToggleItem } from '../_lib/character-builder-types';
import { CharacterBuilderAdvancedControls } from './character-builder-build-look-advanced-controls';
import {
  CharacterBuilderActiveLookPanel,
  CharacterBuilderBuildLookTabs,
} from './character-builder-build-look-panels';
import type { TraitChoiceKey } from './character-builder-build-look-types';

interface CharacterBuilderBuildLookSectionProps {
  accessoryOptions: ToggleItem[];
  accessoriesFeaturesSummary: string;
  activeBuildSection: BuildLookSectionKey;
  addMustRemainTag: () => void;
  advancedOpen: boolean;
  ageOptions: ChoiceOption[];
  bodyBuildOptions: ChoiceOption[];
  canResetBuilder: boolean;
  consistencyOptions: ChoiceOption[];
  copy: CharacterCopy;
  distinctiveOptions: ToggleItem[];
  estimatedImageCostUsd: number | null;
  eyeColorOptions: ChoiceOption[];
  faceCueOptions: ChoiceOption[];
  formatLabelOptions: Array<{ id: string; label: string }>;
  genderOptions: ChoiceOption[];
  hairColorOptions: ChoiceOption[];
  hairLengthOptions: ChoiceOption[];
  hairOpen: boolean;
  hairSummary: string;
  hairstyleOptions: ChoiceOption[];
  hasIdentityReference: boolean;
  identityReference: CharacterBuilderReferenceImage | null;
  identitySummary: string;
  loadingGenerateFour: boolean;
  loadingGenerateOne: boolean;
  mustRemainDraft: string;
  onGenerateFour: () => void;
  onGenerateOne: () => void;
  onResetBuilder: () => void;
  outfitOptions: ChoiceOption[];
  outfitSummary: string;
  outputModeOptions: ChoiceOption[];
  qualityOptions: ChoiceOption[];
  realismOptions: ChoiceOption[];
  realismSummary: string;
  referenceStrengthOptions: ChoiceOption[];
  removeMustRemainTag: (tag: string) => void;
  secondaryControlsCount: number;
  setActiveBuildSection: Dispatch<SetStateAction<BuildLookSectionKey>>;
  setAdvancedOpen: Dispatch<SetStateAction<boolean>>;
  setHairOpen: Dispatch<SetStateAction<boolean>>;
  setMustRemainDraft: Dispatch<SetStateAction<string>>;
  setState: Dispatch<SetStateAction<CharacterBuilderState>>;
  skinToneOptions: ChoiceOption[];
  state: CharacterBuilderState;
  toggleListValue: (key: 'accessories' | 'distinctiveFeatures', value: string) => void;
  updateTrait: <K extends TraitChoiceKey>(key: K, value: string | 'auto') => void;
}

export function CharacterBuilderBuildLookSection({
  accessoryOptions,
  accessoriesFeaturesSummary,
  activeBuildSection,
  addMustRemainTag,
  advancedOpen,
  ageOptions,
  bodyBuildOptions,
  canResetBuilder,
  consistencyOptions,
  copy,
  distinctiveOptions,
  estimatedImageCostUsd,
  eyeColorOptions,
  faceCueOptions,
  formatLabelOptions,
  genderOptions,
  hairColorOptions,
  hairLengthOptions,
  hairOpen,
  hairSummary,
  hairstyleOptions,
  hasIdentityReference,
  identityReference,
  identitySummary,
  loadingGenerateFour,
  loadingGenerateOne,
  mustRemainDraft,
  onGenerateFour,
  onGenerateOne,
  onResetBuilder,
  outfitOptions,
  outfitSummary,
  outputModeOptions,
  qualityOptions,
  realismOptions,
  realismSummary,
  referenceStrengthOptions,
  removeMustRemainTag,
  secondaryControlsCount,
  setActiveBuildSection,
  setAdvancedOpen,
  setHairOpen,
  setMustRemainDraft,
  setState,
  skinToneOptions,
  state,
  toggleListValue,
  updateTrait,
}: CharacterBuilderBuildLookSectionProps) {
  return (
    <section className="space-y-4 border-t border-border pt-6">
      <SectionTitle title={copy.top.buildLook}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onResetBuilder}
          disabled={!canResetBuilder}
          className="shrink-0"
        >
          {copy.reset}
        </Button>
      </SectionTitle>
      <div className="space-y-4">
        <CharacterBuilderBuildLookTabs
          accessoriesFeaturesSummary={accessoriesFeaturesSummary}
          activeBuildSection={activeBuildSection}
          copy={copy}
          hairSummary={hairSummary}
          identitySummary={identitySummary}
          outfitSummary={outfitSummary}
          realismSummary={realismSummary}
          setActiveBuildSection={setActiveBuildSection}
        />

        <CharacterBuilderActiveLookPanel
          accessoryOptions={accessoryOptions}
          accessoriesFeaturesSummary={accessoriesFeaturesSummary}
          activeBuildSection={activeBuildSection}
          ageOptions={ageOptions}
          copy={copy}
          distinctiveOptions={distinctiveOptions}
          genderOptions={genderOptions}
          hairColorOptions={hairColorOptions}
          hairLengthOptions={hairLengthOptions}
          hairOpen={hairOpen}
          hairSummary={hairSummary}
          hairstyleOptions={hairstyleOptions}
          outfitOptions={outfitOptions}
          outfitSummary={outfitSummary}
          realismOptions={realismOptions}
          setHairOpen={setHairOpen}
          setState={setState}
          state={state}
          toggleListValue={toggleListValue}
          updateTrait={updateTrait}
        />
      </div>

      <button
        type="button"
        onClick={() => setAdvancedOpen((previous) => !previous)}
        className="flex w-full items-center justify-between rounded-[20px] border border-border bg-bg/40 px-4 py-3 text-left transition hover:border-border-hover"
      >
        <div>
          <p className="text-sm font-semibold text-text-primary">{copy.sections.moreControls}</p>
        </div>
        <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">
          {secondaryControlsCount
            ? copy.sections.setCount.replace('{count}', String(secondaryControlsCount))
            : copy.sections.optional}
        </span>
      </button>

      {advancedOpen ? (
        <CharacterBuilderAdvancedControls
          addMustRemainTag={addMustRemainTag}
          bodyBuildOptions={bodyBuildOptions}
          consistencyOptions={consistencyOptions}
          copy={copy}
          eyeColorOptions={eyeColorOptions}
          faceCueOptions={faceCueOptions}
          hasIdentityReference={hasIdentityReference}
          mustRemainDraft={mustRemainDraft}
          referenceStrengthOptions={referenceStrengthOptions}
          removeMustRemainTag={removeMustRemainTag}
          setMustRemainDraft={setMustRemainDraft}
          setState={setState}
          skinToneOptions={skinToneOptions}
          state={state}
          updateTrait={updateTrait}
        />
      ) : null}

      <div className="rounded-[24px] border border-border bg-surface/95 p-4 shadow-card">
        <CharacterBuilderStickyDock
          identityReference={identityReference}
          hairSummary={hairSummary}
          outfitSummary={outfitSummary}
          traits={state.traits}
          outputMode={state.outputMode}
          qualityMode={state.qualityMode}
          formatMode={state.formatMode}
          genderOptions={genderOptions}
          ageOptions={ageOptions}
          realismOptions={realismOptions.map((option) => ({ id: option.id, label: option.label }))}
          outputOptions={outputModeOptions.map((option) => ({ id: option.id, label: option.label }))}
          qualityOptions={qualityOptions.map((option) => ({ id: option.id, label: option.label }))}
          formatOptions={formatLabelOptions}
          estimatedImageCostUsd={estimatedImageCostUsd}
          onQualityChange={(value) =>
            setState((previous) => ({
              ...previous,
              qualityMode: value,
              formatMode: normalizeCharacterFormatMode(previous.formatMode, value),
            }))
          }
          onFormatChange={(value) =>
            setState((previous) => ({
              ...previous,
              formatMode: normalizeCharacterFormatMode(value, previous.qualityMode),
            }))
          }
          onGenerateOne={onGenerateOne}
          onGenerateFour={onGenerateFour}
          loadingGenerateOne={loadingGenerateOne}
          loadingGenerateFour={loadingGenerateFour}
          copy={copy}
        />
      </div>
    </section>
  );
}
