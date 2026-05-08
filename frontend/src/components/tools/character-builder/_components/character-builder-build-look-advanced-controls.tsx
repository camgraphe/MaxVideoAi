'use client';

import clsx from 'clsx';
import type { Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { AUTO_TRAIT_KEYS } from '@/lib/character-builder';
import type { CharacterBuilderState } from '@/types/character-builder';
import { CompactSelectField } from './character-builder-workspace-components';
import type { CharacterCopy } from '../_lib/character-builder-copy';
import type { ChoiceOption } from '../_lib/character-builder-types';
import type { TraitChoiceKey } from './character-builder-build-look-types';

export function CharacterBuilderAdvancedControls({
  addMustRemainTag,
  bodyBuildOptions,
  consistencyOptions,
  copy,
  eyeColorOptions,
  faceCueOptions,
  hasIdentityReference,
  mustRemainDraft,
  referenceStrengthOptions,
  removeMustRemainTag,
  setMustRemainDraft,
  setState,
  skinToneOptions,
  state,
  updateTrait,
}: {
  addMustRemainTag: () => void;
  bodyBuildOptions: ChoiceOption[];
  consistencyOptions: ChoiceOption[];
  copy: CharacterCopy;
  eyeColorOptions: ChoiceOption[];
  faceCueOptions: ChoiceOption[];
  hasIdentityReference: boolean;
  mustRemainDraft: string;
  referenceStrengthOptions: ChoiceOption[];
  removeMustRemainTag: (tag: string) => void;
  setMustRemainDraft: Dispatch<SetStateAction<string>>;
  setState: Dispatch<SetStateAction<CharacterBuilderState>>;
  skinToneOptions: ChoiceOption[];
  state: CharacterBuilderState;
  updateTrait: <K extends TraitChoiceKey>(key: K, value: string | 'auto') => void;
}) {
  return (
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
  );
}
