'use client';
import { useId, type Dispatch, type SetStateAction } from 'react';
import { Check, PersonStanding, UserRound } from 'lucide-react';
import { getCharacterFormatResolution, normalizeCharacterFormatMode } from '@/lib/character-builder';
import type { CharacterBuilderState } from '@/types/character-builder';
import type { CharacterCopy } from '../_lib/character-builder-copy';
import type { StudioCopy } from '../_lib/character-studio-copy';

function OutputIllustration({ sheet, closeUps }: { sheet: boolean; closeUps: boolean }) {
  return (
    <span aria-hidden="true" className="flex h-12 items-center justify-center text-text-secondary">
      {sheet ? (
        <span className="grid w-20 grid-cols-4 gap-x-1 rounded border border-border bg-surface p-1.5 shadow-sm">
          {[0, 1, 2, 3].map((view) => (
            <span key={view} className="flex flex-col items-center gap-1">
              <PersonStanding size={18} strokeWidth={1.5} />
              {closeUps ? <UserRound size={9} strokeWidth={1.5} /> : null}
            </span>
          ))}
        </span>
      ) : (
        <span className="flex h-11 w-9 items-end justify-center overflow-hidden rounded border border-border bg-surface pt-2 shadow-sm">
          <UserRound size={32} strokeWidth={1.25} />
        </span>
      )}
    </span>
  );
}

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
  const id = useId();
  const resolution = getCharacterFormatResolution(state.formatMode, state.qualityMode);
  const outputs = [
    { id: 'portrait-reference', label: labels.outputPortrait, description: labels.portraitCaption },
    {
      id: 'character-sheet',
      label: labels.outputSheet,
      description: state.outputOptions.includeCloseUps ? labels.sheetCaption : labels.sheetViewsCaption,
    },
  ] as const;
  return (
    <div className="space-y-2.5">
      <fieldset>
        <legend className="mb-2 text-xs font-medium text-text-primary">{copy.summary.output}</legend>
        <div className="grid grid-cols-2 gap-2">
          {outputs.map((output) => (
            <label key={output.id} className="relative min-w-0 cursor-pointer">
              <input
                type="radio"
                name={`${id}-output`}
                value={output.id}
                checked={state.outputMode === output.id}
                aria-labelledby={`${id}-${output.id}-label`}
                aria-describedby={`${id}-${output.id}-description`}
                className="peer sr-only"
                onChange={() => setState((previous) => ({
                  ...previous,
                  outputMode: output.id,
                  outputOptions: { ...previous.outputOptions, fullBodyRequired: output.id === 'character-sheet' },
                }))}
              />
              <span className="block h-full rounded-xl border border-border bg-bg px-2 pb-2 pt-1 transition-colors hover:border-border-hover peer-checked:border-brand peer-checked:bg-brand/5 peer-checked:ring-1 peer-checked:ring-brand peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand">
                <OutputIllustration sheet={output.id === 'character-sheet'} closeUps={state.outputOptions.includeCloseUps} />
                <span id={`${id}-${output.id}-label`} className="block text-center text-xs font-medium text-text-primary">{output.label}</span>
                <span id={`${id}-${output.id}-description`} className="mt-0.5 block text-center text-[10px] leading-snug text-text-secondary">
                  {output.description}
                </span>
              </span>
              {state.outputMode === output.id ? (
                <Check aria-hidden="true" size={14} className="pointer-events-none absolute right-2 top-2 text-brand" />
              ) : null}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex items-center gap-3">
        <legend className="sr-only">{copy.generatePanel.format}</legend>
        <span aria-hidden="true" className="shrink-0 text-xs font-medium text-text-primary">{copy.generatePanel.format}</span>
        <div className="grid flex-1 grid-cols-3 gap-1 rounded-lg bg-bg p-1">
          {(['1k', '2k', '4k'] as const).map((format) => (
            <label key={format} className="cursor-pointer">
              <input
                type="radio"
                name={`${id}-format`}
                value={format}
                checked={resolution === format}
                className="peer sr-only"
                onChange={() => setState((previous) => ({
                  ...previous,
                  qualityMode: 'draft',
                  formatMode: normalizeCharacterFormatMode(format === '1k' ? 'standard' : format, 'draft'),
                }))}
              />
              <span className="flex min-h-8 items-center justify-center rounded-md border border-transparent text-xs font-medium text-text-secondary transition-colors hover:text-text-primary peer-checked:border-border peer-checked:bg-surface peer-checked:text-text-primary peer-checked:shadow-sm peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand">
                {format.toUpperCase()}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
