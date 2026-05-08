'use client';

import clsx from 'clsx';
import type { Dispatch, SetStateAction } from 'react';
import { Input, Textarea } from '@/components/ui/Input';
import type {
  CharacterBuilderState,
  CharacterBuilderTraits,
} from '@/types/character-builder';
import {
  BuildLookCarouselCard,
  GENDER_CARD_META,
  HairEditorPanel,
  IconChoiceCard,
  MultiToggleGroup,
  REALISM_CARD_META,
  SegmentedControl,
  StyleChoiceCard,
  type BuildLookSectionKey,
} from './character-builder-workspace-components';
import type { CharacterCopy } from '../_lib/character-builder-copy';
import {
  hasCustomHairSettings,
  hasCustomOutfitSettings,
} from '../_lib/character-builder-helpers';
import type { ChoiceOption, ToggleItem } from '../_lib/character-builder-types';
import type { TraitChoiceKey } from './character-builder-build-look-types';

export function CharacterBuilderBuildLookTabs({
  accessoriesFeaturesSummary,
  activeBuildSection,
  copy,
  hairSummary,
  identitySummary,
  outfitSummary,
  realismSummary,
  setActiveBuildSection,
}: {
  accessoriesFeaturesSummary: string;
  activeBuildSection: BuildLookSectionKey;
  copy: CharacterCopy;
  hairSummary: string;
  identitySummary: string;
  outfitSummary: string;
  realismSummary: string;
  setActiveBuildSection: Dispatch<SetStateAction<BuildLookSectionKey>>;
}) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max overflow-hidden rounded-[24px] border border-border bg-surface shadow-card md:min-w-0 md:w-full">
        <BuildLookCarouselCard
          title={copy.sections.gender}
          summary={identitySummary}
          active={activeBuildSection === 'identity'}
          onClick={() => setActiveBuildSection('identity')}
        />
        <BuildLookCarouselCard
          title={copy.sections.hair}
          summary={hairSummary === copy.notSet ? copy.sections.hairOpenEditor : hairSummary}
          active={activeBuildSection === 'hair'}
          onClick={() => setActiveBuildSection('hair')}
        />
        <BuildLookCarouselCard
          title={copy.sections.outfit}
          summary={outfitSummary === copy.notSet ? copy.open : outfitSummary}
          active={activeBuildSection === 'outfit'}
          onClick={() => setActiveBuildSection('outfit')}
        />
        <BuildLookCarouselCard
          title={copy.sections.accessoriesFeatures}
          summary={accessoriesFeaturesSummary || copy.open}
          active={activeBuildSection === 'details'}
          onClick={() => setActiveBuildSection('details')}
        />
        <BuildLookCarouselCard
          title={copy.sections.realism}
          summary={realismSummary}
          active={activeBuildSection === 'style'}
          onClick={() => setActiveBuildSection('style')}
        />
      </div>
    </div>
  );
}

export function CharacterBuilderActiveLookPanel({
  accessoryOptions,
  accessoriesFeaturesSummary,
  activeBuildSection,
  ageOptions,
  copy,
  distinctiveOptions,
  genderOptions,
  hairColorOptions,
  hairLengthOptions,
  hairOpen,
  hairSummary,
  hairstyleOptions,
  outfitOptions,
  outfitSummary,
  realismOptions,
  setHairOpen,
  setState,
  state,
  toggleListValue,
  updateTrait,
}: {
  accessoryOptions: ToggleItem[];
  accessoriesFeaturesSummary: string;
  activeBuildSection: BuildLookSectionKey;
  ageOptions: ChoiceOption[];
  copy: CharacterCopy;
  distinctiveOptions: ToggleItem[];
  genderOptions: ChoiceOption[];
  hairColorOptions: ChoiceOption[];
  hairLengthOptions: ChoiceOption[];
  hairOpen: boolean;
  hairSummary: string;
  hairstyleOptions: ChoiceOption[];
  outfitOptions: ChoiceOption[];
  outfitSummary: string;
  realismOptions: ChoiceOption[];
  setHairOpen: Dispatch<SetStateAction<boolean>>;
  setState: Dispatch<SetStateAction<CharacterBuilderState>>;
  state: CharacterBuilderState;
  toggleListValue: (key: 'accessories' | 'distinctiveFeatures', value: string) => void;
  updateTrait: <K extends TraitChoiceKey>(key: K, value: string | 'auto') => void;
}) {
  return (
    <div className="rounded-[24px] border border-border bg-surface p-4 shadow-card sm:p-5">
      {activeBuildSection === 'identity' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(148px,172px))] justify-center gap-3 xl:justify-start">
            {genderOptions.map((option) => {
              const meta = GENDER_CARD_META[option.id] ?? GENDER_CARD_META.custom;
              return (
                <IconChoiceCard
                  key={option.id}
                  selected={state.traits.genderPresentation.value === option.id}
                  title={option.label}
                  glyph={meta.glyph}
                  background={meta.background}
                  accent={meta.accent}
                  onClick={() => updateTrait('genderPresentation', option.id)}
                />
              );
            })}
          </div>

          <div className="max-w-xl">
            <SegmentedControl
              label={copy.sections.age}
              options={ageOptions}
              value={state.traits.ageRange.value}
              onChange={(value) => updateTrait('ageRange', value)}
            />
          </div>

          {state.traits.genderPresentation.value === 'custom' ? (
            <Input
              value={state.traits.customGenderDescription ?? ''}
              onChange={(event) =>
                setState((previous) => ({
                  ...previous,
                  traits: {
                    ...previous.traits,
                    customGenderDescription: event.target.value,
                  },
                }))
              }
              placeholder={copy.sections.customGenderPlaceholder}
            />
          ) : null}
        </div>
      ) : null}

      {activeBuildSection === 'hair' ? (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-text-primary">{copy.sections.hair}</p>
            <p className="mt-1 text-xs text-text-secondary">
              {hairSummary === copy.notSet ? copy.sections.hairOpenEditor : hairSummary}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setHairOpen((previous) => !previous)}
            className="flex w-full items-center justify-between gap-4 rounded-[24px] border border-border bg-surface px-4 py-4 text-left transition hover:border-border-hover hover:bg-surface-hover hover:shadow-card"
          >
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-surface-2/80">
                <div className="space-y-1">
                  <div className="h-2 w-7 rounded-full bg-slate-500" />
                  <div className="h-2 w-5 rounded-full bg-slate-400" />
                  <div className="h-2 w-6 rounded-full bg-slate-300" />
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-primary">{copy.sections.hair}</p>
                <p className="truncate text-xs text-text-secondary">
                  {hairSummary === copy.notSet ? copy.sections.hairOpenEditor : hairSummary}
                </p>
              </div>
            </div>
            <span className="rounded-full border border-border bg-surface-2/80 px-3 py-1 text-xs font-semibold text-text-secondary">
              {hairOpen ? copy.sections.hairClose : copy.sections.hairEdit}
            </span>
          </button>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-text-primary">{copy.sections.customHair}</label>
            <Textarea
              value={state.traits.customHairDescription ?? ''}
              onChange={(event) =>
                setState((previous) => {
                  const nextTraits = {
                    ...previous.traits,
                    customHairDescription: event.target.value,
                  };
                  return {
                    ...previous,
                    traits: {
                      ...nextTraits,
                      hairEnabled: hasCustomHairSettings(nextTraits),
                    },
                  };
                })
              }
              placeholder={copy.sections.customHairPlaceholder}
            />
          </div>
          <HairEditorPanel
            open={hairOpen}
            onClose={() => setHairOpen(false)}
            sourceMode={state.sourceMode}
            traits={state.traits}
            onChange={(key, value) => updateTrait(key, value)}
            hairColorOptions={hairColorOptions}
            hairLengthOptions={hairLengthOptions}
            hairstyleOptions={hairstyleOptions}
            copy={copy}
          />
        </div>
      ) : null}

      {activeBuildSection === 'outfit' ? (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-text-primary">{copy.sections.outfit}</p>
            <p className="mt-1 text-xs text-text-secondary">
              {outfitSummary === copy.notSet ? copy.open : outfitSummary}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {outfitOptions.map((option) => {
              const selected = state.traits.outfitStyle.value === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => updateTrait('outfitStyle', selected ? 'auto' : option.id)}
                  className={clsx(
                    'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                    selected
                      ? 'border-brand bg-brand text-on-brand'
                      : 'border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-hover'
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-text-primary">{copy.sections.customOutfit}</label>
            <Textarea
              value={state.traits.customOutfitDescription ?? ''}
              onChange={(event) =>
                setState((previous) => {
                  const nextTraits = {
                    ...previous.traits,
                    customOutfitDescription: event.target.value,
                  };
                  return {
                    ...previous,
                    traits: {
                      ...nextTraits,
                      outfitEnabled: hasCustomOutfitSettings(nextTraits),
                    },
                  };
                })
              }
              placeholder={copy.sections.customOutfitPlaceholder}
            />
          </div>
        </div>
      ) : null}

      {activeBuildSection === 'style' ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(148px,172px))] justify-center gap-3 xl:justify-start">
          {realismOptions.map((option) => {
            const meta = REALISM_CARD_META[option.id];
            return (
              <StyleChoiceCard
                key={option.id}
                selected={state.traits.realismStyle === option.id}
                title={option.label}
                background={meta.background}
                accent={meta.accent}
                onClick={() =>
                  setState((previous) => ({
                    ...previous,
                    traits: {
                      ...previous.traits,
                      realismStyle: option.id as CharacterBuilderTraits['realismStyle'],
                    },
                  }))
                }
              />
            );
          })}
        </div>
      ) : null}

      {activeBuildSection === 'details' ? (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-text-primary">{copy.sections.accessoriesFeatures}</p>
            <p className="mt-1 text-xs text-text-secondary">
              {accessoriesFeaturesSummary || copy.open}
            </p>
          </div>
          <MultiToggleGroup
            label={copy.sections.accessories}
            items={accessoryOptions}
            values={state.traits.accessories}
            onToggle={(value) => toggleListValue('accessories', value)}
          />
          <MultiToggleGroup
            label={copy.sections.distinctiveFeatures}
            items={distinctiveOptions}
            values={state.traits.distinctiveFeatures}
            onToggle={(value) => toggleListValue('distinctiveFeatures', value)}
          />
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-text-primary">{copy.sections.customDetails}</label>
            <Textarea
              value={state.traits.customDetailsDescription ?? ''}
              onChange={(event) =>
                setState((previous) => ({
                  ...previous,
                  traits: {
                    ...previous.traits,
                    customDetailsDescription: event.target.value,
                  },
                }))
              }
              placeholder={copy.sections.customDetailsPlaceholder}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
