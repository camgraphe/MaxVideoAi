'use client';
import type { Dispatch, SetStateAction } from 'react';
import { getCharacterFormatResolution, normalizeCharacterFormatMode } from '@/lib/character-builder';
import type { CharacterBuilderState } from '@/types/character-builder';
import type { CharacterCopy } from '../_lib/character-builder-copy';
import type { StudioCopy } from '../_lib/character-studio-copy';
import { useCharacterBuilderOptions } from '../_hooks/useCharacterBuilderOptions';
import { StudioChips } from './CharacterStudioChoices.client';

export function CharacterStudioOutputSettings({
  state,
  setState,
  copy,
  labels,
}: {
  state: CharacterBuilderState;
  setState: Dispatch<SetStateAction<CharacterBuilderState>>;
  copy: CharacterCopy;
  labels: StudioCopy;
}) {
  const options = useCharacterBuilderOptions(copy, state.qualityMode);
  const fieldClass =
    'mt-2 w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-text-primary';
  return (
    <div className="border-t border-border p-4">
      <details>
        <summary className="cursor-pointer text-sm text-text-secondary">{labels.generation}</summary>
        <div className="mt-4 space-y-4">
          <StudioChips
            label={copy.summary.output}
            options={options.outputModeOptions}
            value={state.outputMode}
            onChange={(id) => {
              if (id)
                setState((previous) => ({
                  ...previous,
                  outputMode: id as CharacterBuilderState['outputMode'],
                  outputOptions: {
                    ...previous.outputOptions,
                    fullBodyRequired: id === 'character-sheet',
                  },
                }));
            }}
          />
          <StudioChips
            label={copy.generatePanel.format}
            options={['1k', '2k', '4k'].map((id) => ({
              id,
              label: id.toUpperCase(),
            }))}
            value={getCharacterFormatResolution(state.formatMode, state.qualityMode)}
            onChange={(id) => {
              if (id === '1k' || id === '2k' || id === '4k') {
                setState((previous) => ({
                  ...previous,
                  qualityMode: 'draft',
                  formatMode: normalizeCharacterFormatMode(id === '1k' ? 'standard' : id, 'draft'),
                }));
              }
            }}
          />
          {!state.characterId && (
            <StudioChips
              label={copy.sections.consistency}
              options={options.consistencyOptions}
              value={state.consistencyMode}
              onChange={(id) => {
                if (id)
                  setState((previous) => ({
                    ...previous,
                    consistencyMode: id as CharacterBuilderState['consistencyMode'],
                  }));
              }}
            />
          )}
          {!state.characterId && state.sourceMode === 'reference-image' ? (
            <StudioChips
              label={copy.sections.referenceStrength}
              options={options.referenceStrengthOptions}
              value={state.referenceStrength}
              onChange={(id) => {
                if (id)
                  setState((previous) => ({
                    ...previous,
                    referenceStrength: id as CharacterBuilderState['referenceStrength'],
                  }));
              }}
            />
          ) : null}
          <label className="block text-xs text-text-secondary">
            {labels.notes}
            <textarea
              className={fieldClass}
              rows={3}
              maxLength={2000}
              placeholder={labels.notesPlaceholder}
              value={state.advancedNotes}
              onChange={(event) =>
                setState((previous) => ({
                  ...previous,
                  advancedNotes: event.target.value,
                }))
              }
            />
          </label>
        </div>
      </details>
    </div>
  );
}
