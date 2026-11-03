'use client';
import type { Dispatch, SetStateAction } from 'react';
import { normalizeCharacterFormatMode } from '@/lib/character-builder';
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
  generateCount,
  setGenerateCount,
}: {
  state: CharacterBuilderState;
  setState: Dispatch<SetStateAction<CharacterBuilderState>>;
  copy: CharacterCopy;
  labels: StudioCopy;
  generateCount: 1 | 4;
  setGenerateCount: (value: 1 | 4) => void;
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
            label={copy.generatePanel.quality}
            options={options.qualityOptions}
            value={state.qualityMode}
            onChange={(id) => {
              if (id)
                setState((previous) => ({
                  ...previous,
                  qualityMode: id as CharacterBuilderState['qualityMode'],
                  formatMode: normalizeCharacterFormatMode(
                    previous.formatMode,
                    id as CharacterBuilderState['qualityMode'],
                  ),
                }));
            }}
          />
          <StudioChips
            label={copy.generatePanel.format}
            options={options.formatLabelOptions}
            value={state.formatMode}
            onChange={(id) => {
              if (id)
                setState((previous) => ({
                  ...previous,
                  formatMode: id as CharacterBuilderState['formatMode'],
                }));
            }}
          />
          <StudioChips
            label={labels.count}
            options={[
              { id: '1', label: '1' },
              { id: '4', label: '4' },
            ]}
            value={String(generateCount)}
            onChange={(id) => {
              if (id) setGenerateCount(id === '4' ? 4 : 1);
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
