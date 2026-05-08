'use client';

import clsx from 'clsx';
import type { Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import {
  AUTO_TRAIT_KEYS,
  normalizeCharacterFormatMode,
} from '@/lib/character-builder';
import type {
  CharacterBuilderReferenceImage,
  CharacterBuilderState,
  CharacterBuilderTraits,
} from '@/types/character-builder';
import {
  BuildLookCarouselCard,
  CharacterBuilderStickyDock,
  CompactSelectField,
  GENDER_CARD_META,
  HairEditorPanel,
  IconChoiceCard,
  MultiToggleGroup,
  REALISM_CARD_META,
  SectionTitle,
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
        <div className="space-y-5 rounded-card border border-border bg-bg/40 p-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <CompactSelectField
              label={copy.sections.skinTone}
              value={state.traits.skinTone.value}
              options={skinToneOptions}
              onChange={(value) => updateTrait('skinTone', value)}
              placeholder={copy.choose}
              autoLabel={copy.auto}
              autoEnabled={state.sourceMode === 'reference-image' && AUTO_TRAIT_KEYS.has('skinTone')}
            />
            <CompactSelectField
              label={copy.sections.faceCues}
              value={state.traits.faceCues.value}
              options={faceCueOptions}
              onChange={(value) => updateTrait('faceCues', value)}
              placeholder={copy.choose}
              autoLabel={copy.auto}
              autoEnabled={state.sourceMode === 'reference-image' && AUTO_TRAIT_KEYS.has('faceCues')}
            />
            <CompactSelectField
              label={copy.sections.eyeColor}
              value={state.traits.eyeColor.value}
              options={eyeColorOptions}
              onChange={(value) => updateTrait('eyeColor', value)}
              placeholder={copy.choose}
              autoLabel={copy.auto}
              autoEnabled={state.sourceMode === 'reference-image' && AUTO_TRAIT_KEYS.has('eyeColor')}
            />
            <CompactSelectField
              label={copy.sections.bodyBuild}
              value={state.traits.bodyBuild.value}
              options={bodyBuildOptions}
              onChange={(value) => updateTrait('bodyBuild', value)}
              placeholder={copy.choose}
              autoLabel={copy.auto}
              autoEnabled={state.sourceMode === 'reference-image' && AUTO_TRAIT_KEYS.has('bodyBuild')}
            />
            <CompactSelectField
              label={copy.sections.consistency}
              value={state.consistencyMode}
              options={consistencyOptions}
              onChange={(value) =>
                setState((previous) => ({
                  ...previous,
                  consistencyMode: value as CharacterBuilderState['consistencyMode'],
                }))
              }
              placeholder={copy.choose}
              autoLabel={copy.auto}
            />
            {hasIdentityReference ? (
              <CompactSelectField
                label={copy.sections.referenceStrength}
                value={state.referenceStrength}
                options={referenceStrengthOptions}
                onChange={(value) =>
                  setState((previous) => ({
                    ...previous,
                    referenceStrength: value as CharacterBuilderState['referenceStrength'],
                  }))
                }
                placeholder={copy.choose}
                autoLabel={copy.auto}
              />
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {[
              ['includeCloseUps', copy.outputOptions.includeCloseUps],
              ['neutralStudioBackground', copy.outputOptions.neutralStudioBackground],
              ['preserveFacialDetails', copy.outputOptions.preserveFacialDetails],
              ['avoid3dRenderLook', copy.outputOptions.avoid3dRenderLook],
            ].map(([key, label]) => {
              const typedKey = key as keyof CharacterBuilderState['outputOptions'];
              const active = state.outputOptions[typedKey];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    setState((previous) => ({
                      ...previous,
                      outputOptions: {
                        ...previous.outputOptions,
                        [typedKey]: !previous.outputOptions[typedKey],
                      },
                    }))
                  }
                  className={clsx(
                    'flex items-center justify-between rounded-card border px-4 py-3 text-left transition',
                    active
                      ? 'border-brand bg-brand/10'
                      : 'border-border bg-surface text-text-secondary hover:border-border-hover hover:bg-surface-hover'
                  )}
                >
                  <span className="text-sm font-semibold text-text-primary">{label}</span>
                  <span className="text-xs font-semibold uppercase tracking-micro">
                    {active ? copy.on : copy.off}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-semibold text-text-primary">{copy.sections.advancedNotes}</label>
            <Textarea
              rows={3}
              value={state.advancedNotes}
              onChange={(event) =>
                setState((previous) => ({
                  ...previous,
                  advancedNotes: event.target.value,
                }))
              }
              placeholder={copy.sections.advancedNotesPlaceholder}
            />
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-semibold text-text-primary">{copy.sections.mustRemainVisible}</label>
            <div className="flex gap-2">
              <Input
                value={mustRemainDraft}
                onChange={(event) => setMustRemainDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addMustRemainTag();
                  }
                }}
                placeholder={copy.sections.mustRemainPlaceholder}
              />
              <Button onClick={addMustRemainTag}>{copy.add}</Button>
            </div>
            {state.mustRemainVisible.length ? (
              <div className="flex flex-wrap gap-2">
                {state.mustRemainVisible.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => removeMustRemainTag(tag)}
                    className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold uppercase tracking-micro text-text-secondary hover:border-border-hover"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
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
