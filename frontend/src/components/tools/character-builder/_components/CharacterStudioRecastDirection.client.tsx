'use client';
import { useId, useState } from 'react';
import { Plus } from 'lucide-react';
import type { StudioCopy } from '../_lib/character-studio-copy';
import { getRecastReadinessCopy } from '../_lib/recast-readiness-copy';

import type { RecastTrackControl } from './useRecastTrack';
import { CharacterStudioRecastPassage } from './CharacterStudioRecastPassage.client';

export function CharacterStudioRecastDirection({
  copy,
  prompt,
  onPrompt,
  dialogue,
  onDialogue,
  audioControl,
  hasVideo = false,
  addAudio,
}: {
  copy: StudioCopy;
  prompt: string;
  onPrompt: (value: string) => void;
  dialogue: string;
  onDialogue: (value: string) => void;
  audioControl: RecastTrackControl;
  hasVideo?: boolean;
  addAudio: () => void;
}) {
  const [tab, setTab] = useState<'direction' | 'dialogue'>('direction');
  const hintId = useId();
  const readiness = getRecastReadinessCopy(copy.recastLocale);
  const hasAlternative = Boolean(hasVideo || dialogue.trim() || audioControl.track);
  const missing = !hasAlternative && !prompt.trim();
  const field = 'mt-2 w-full resize-y rounded-xl border border-border bg-bg p-3 text-sm font-normal';
  return (
    <section data-required-missing={missing || undefined} className={'space-y-3 ' + (missing ? 'rounded-xl ring-1 ring-brand/50 ring-offset-4 ring-offset-surface' : '')}>
      <div
        role="group"
        aria-label={copy.direction + ' / ' + copy.dialogue}
        className="flex rounded-lg bg-bg p-1"
      >
        {(['direction', 'dialogue'] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
            className={
              'flex-1 rounded-md px-2 py-2 text-xs font-medium ' +
              (tab === t ? 'bg-surface-hover text-text-primary shadow-sm' : 'text-text-secondary')
            }
          >
            {copy[t]}
            {t === 'dialogue' && (dialogue.trim() || audioControl.track) ? ' •' : ''}
          </button>
        ))}
      </div>
      {missing && <p id={hintId} className="text-xs leading-relaxed text-text-secondary">{readiness.directionHint}</p>}
      {tab === 'direction' ? (
        <label className="block text-xs text-text-secondary">
          {hasAlternative ? copy.recastPrompt : readiness.directionLabel}
          <textarea
            aria-describedby={missing ? hintId : undefined}
            value={prompt}
            onChange={(e) => onPrompt(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder={copy.recastPromptHint}
            className={field}
          />
        </label>
      ) : (
        <div className="space-y-3">
          <label className="block text-xs text-text-secondary">
            {copy.spokenLine}
            <textarea
              aria-describedby={missing ? hintId : undefined}
              value={dialogue}
              onChange={(e) => onDialogue(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder={copy.spokenHint}
              className={field}
            />
          </label>
          {audioControl.track ? (
            <CharacterStudioRecastPassage
              kind="audio"
              control={audioControl}
              copy={copy}
              label={copy.addAudio}
            />
          ) : (
            <button
              type="button"
              onClick={addAudio}
              className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border p-3 text-xs"
            >
              <Plus size={16} />
              {copy.addAudio}
            </button>
          )}
          <p className="text-xs leading-relaxed text-text-secondary">{copy.audioHint}</p>
        </div>
      )}
    </section>
  );
}
