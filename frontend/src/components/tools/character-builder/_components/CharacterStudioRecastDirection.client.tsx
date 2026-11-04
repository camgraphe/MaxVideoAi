'use client';
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { StudioCopy } from '../_lib/character-studio-copy';

export function CharacterStudioRecastDirection({
  copy,
  prompt,
  onPrompt,
  dialogue,
  onDialogue,
  audio,
  addAudio,
  removeAudio,
}: {
  copy: StudioCopy;
  prompt: string;
  onPrompt: (value: string) => void;
  dialogue: string;
  onDialogue: (value: string) => void;
  audio: { name: string; url: string } | null;
  addAudio: () => void;
  removeAudio: () => void;
}) {
  const [tab, setTab] = useState<'direction' | 'dialogue'>('direction');
  const field = 'mt-2 w-full resize-y rounded-xl border border-border bg-bg p-3 text-sm font-normal';
  return (
    <section className="space-y-3">
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
            {t === 'dialogue' && (dialogue.trim() || audio) ? ' •' : ''}
          </button>
        ))}
      </div>
      {tab === 'direction' ? (
        <label className="block text-xs text-text-secondary">
          {copy.recastPrompt}
          <textarea
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
              value={dialogue}
              onChange={(e) => onDialogue(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder={copy.spokenHint}
              className={field}
            />
          </label>
          {audio ? (
            <div className="rounded-xl border border-border p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs">{audio.name}</span>
                <button type="button" onClick={removeAudio} aria-label={copy.remove + ' · ' + copy.addAudio}>
                  <X size={16} />
                </button>
              </div>
              <audio
                src={audio.url}
                controls
                preload="none"
                className="mt-2 w-full"
                aria-label={audio.name}
              />
            </div>
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
