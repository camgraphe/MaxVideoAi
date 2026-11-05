'use client';
import type { Dispatch, SetStateAction } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import type { CharacterBuilderState } from '@/types/character-builder';
import type { CharacterCopy } from '../_lib/character-builder-copy';
import type { StudioCopy } from '../_lib/character-studio-copy';
import { useCharacterBuilderOptions } from '../_hooks/useCharacterBuilderOptions';
import { StudioChips } from './CharacterStudioChoices.client';

export function CharacterStudioAdvancedSettings({ state, setState, copy, labels }: {
  state: CharacterBuilderState;
  setState: Dispatch<SetStateAction<CharacterBuilderState>>;
  copy: CharacterCopy;
  labels: StudioCopy;
}) {
  const options = useCharacterBuilderOptions(copy, state.qualityMode);
  return (
    <details className="group mx-3 mb-3 rounded-xl border border-border bg-bg">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-text-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
        <SlidersHorizontal aria-hidden="true" size={17} className="shrink-0" />
        <span className="flex-1">{labels.advancedSettings}</span>
        <ChevronDown aria-hidden="true" size={16} className="group-open:rotate-180" />
      </summary>
      <div className="space-y-4 px-3 pb-3 pt-1">
        {!state.characterId ? (
          <StudioChips
            label={copy.sections.consistency}
            options={options.consistencyOptions}
            value={state.consistencyMode}
            onChange={(id) => {
              if (id) setState((previous) => ({ ...previous, consistencyMode: id as CharacterBuilderState['consistencyMode'] }));
            }}
          />
        ) : null}
        {!state.characterId && state.sourceMode === 'reference-image' ? (
          <StudioChips
            label={copy.sections.referenceStrength}
            options={options.referenceStrengthOptions}
            value={state.referenceStrength}
            onChange={(id) => {
              if (id) setState((previous) => ({ ...previous, referenceStrength: id as CharacterBuilderState['referenceStrength'] }));
            }}
          />
        ) : null}
        <label className="block text-xs text-text-secondary">
          {labels.notes}
          <textarea
            className="mt-2 w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-text-primary"
            rows={3}
            maxLength={2000}
            placeholder={labels.notesPlaceholder}
            value={state.advancedNotes}
            onChange={(event) => setState((previous) => ({ ...previous, advancedNotes: event.target.value }))}
          />
        </label>
      </div>
    </details>
  );
}
