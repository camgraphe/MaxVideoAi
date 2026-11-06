'use client';
import Link from 'next/link';
import { Images, Plus, ScanFace, Clapperboard, Film } from 'lucide-react';
import type { StudioCopy } from '../_lib/character-studio-copy';
export type CharacterStudioMode = 'character' | 'recast';
export function CharacterStudioNavigation({
  mode,
  onMode,
  onNew,
  onExplore,
  copy,
}: {
  mode: CharacterStudioMode;
  onMode: (mode: CharacterStudioMode) => void;
  onNew: () => void;
  onExplore: () => void;
  copy: StudioCopy;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 p-3">
      <h1 className="sr-only">Character Studio</h1>
      <div
        className="flex min-w-0 flex-1 rounded-xl border border-border bg-bg p-1"
        role="group"
        aria-label="Character Studio"
      >
        {(['character', 'recast'] as const).map((value) => {
          const Icon = value === 'character' ? ScanFace : Clapperboard;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => onMode(value)}
              className={`flex min-h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium transition ${mode === value ? 'bg-surface-hover text-text-primary shadow-sm ring-1 ring-border' : 'text-text-secondary hover:text-text-primary'}`}
            >
              <Icon size={14} />
              {copy[value]}
              {value === 'character' && (
                <span className="hidden rounded bg-brand/15 px-1 text-[9px] font-semibold text-brand sm:inline">
                  AI
                </span>
              )}
            </button>
          );
        })}
      </div>
      {mode === 'recast' && (
        <Link
          href="/app"
          prefetch={false}
          className="flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border px-2 text-xs font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary"
        >
          <Film size={14} aria-hidden="true" />
          {copy.myVideos}
        </Link>
      )}
      {mode === 'character' && (
        <button
          type="button"
          onClick={onNew}
          aria-label={copy.newCharacter}
          title={copy.newCharacter}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-surface-hover hover:text-text-primary"
        >
          <Plus size={16} />
        </button>
      )}
      {mode === 'character' && (
        <button
          type="button"
          onClick={onExplore}
          aria-label={copy.explore}
          title={copy.explore}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-text-secondary lg:hidden"
        >
          <Images size={16} />
        </button>
      )}
    </div>
  );
}
