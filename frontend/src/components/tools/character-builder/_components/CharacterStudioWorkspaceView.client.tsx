'use client';
import type { ReactNode } from 'react';
import { Compass, Images, SlidersHorizontal, Users, X } from 'lucide-react';
import type { StudioCopy } from '../_lib/character-studio-copy';
import type { StudioLibraryCopy } from '../_lib/character-studio-library-copy';
import type { CharacterStudioMode } from './CharacterStudioNavigation.client';

export type StudioTab = 'explore' | 'characters' | 'history';
export function CharacterStudioWorkspaceView({
  mode,
  tab,
  onTab,
  mobileResults,
  onEditor,
  copy,
  libraryCopy,
  pendingCount,
  error,
  status,
  restoredDraft,
  onNew,
  onDismissRestoredDraft,
  composer,
  explore,
  characters,
  results,
  recast,
}: {
  mode: CharacterStudioMode;
  tab: StudioTab;
  onTab: (tab: StudioTab) => void;
  mobileResults: boolean;
  onEditor: () => void;
  copy: StudioCopy;
  libraryCopy: StudioLibraryCopy;
  pendingCount: number;
  error: string | null;
  status: string | null;
  restoredDraft: boolean;
  onNew: () => void;
  onDismissRestoredDraft: () => void;
  composer: ReactNode;
  explore: ReactNode;
  characters: ReactNode;
  results: ReactNode;
  recast: ReactNode;
}) {
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1700px] flex-col gap-2">
      {mode === 'character' && restoredDraft ? (
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-text-secondary">
          <p role="status" className="min-w-0 flex-1">{copy.restoredDraft}</p>
          <button type="button" onClick={onNew} className="min-h-9 rounded-lg px-2 font-medium text-text-primary underline underline-offset-4 hover:bg-surface-hover">
            {copy.fresh}
          </button>
          <button type="button" onClick={onDismissRestoredDraft} aria-label={copy.dismissDraftNotice} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-surface-hover">
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl border border-border p-3 text-sm">
          {error}
        </p>
      ) : null}
      {status ? (
        <p role="status" aria-live="polite" className="text-sm text-text-secondary">
          {status}
        </p>
      ) : null}
      <div
        className={
          mode === 'character' ? 'grid min-h-0 flex-1 gap-3 lg:grid-cols-[340px_minmax(0,1fr)]' : 'hidden'
        }
      >
        <div className={`min-h-0 ${mobileResults ? 'hidden lg:block' : ''}`}>{composer}</div>
        <section
          className={`min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface ${mobileResults ? 'flex' : 'hidden lg:flex'}`}
          aria-label={libraryCopy.title}
        >
          <nav
            className="flex shrink-0 items-center gap-2 border-b border-border px-3 sm:gap-4 sm:px-5"
            aria-label={libraryCopy.title}
          >
            <button
              type="button"
              onClick={onEditor}
              aria-label={copy.character}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border lg:hidden"
            >
              <SlidersHorizontal size={15} />
            </button>
            {(['explore', 'characters', 'history'] as const).map((value) => {
              const Icon = value === 'explore' ? Compass : value === 'characters' ? Users : Images;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={tab === value}
                  onClick={() => onTab(value)}
                  className={`flex min-h-12 min-w-0 items-center gap-2 border-b-2 text-xs sm:text-sm ${tab === value ? 'border-brand text-text-primary' : 'border-transparent text-text-secondary'}`}
                >
                  <Icon size={16} className="hidden shrink-0 sm:block" />
                  <span>{value === 'characters' ? libraryCopy.title : copy[value]}</span>
                  {value === 'history' && pendingCount ? (
                    <span className="text-xs">({pendingCount})</span>
                  ) : null}
                </button>
              );
            })}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-studio-scroll="results">
            {tab === 'explore' ? (
              explore
            ) : tab === 'characters' ? (
              characters
            ) : (
              <div className="p-4 sm:p-6">{results}</div>
            )}
          </div>
        </section>
      </div>
      <div className={mode === 'recast' ? 'min-h-0 flex-1' : 'hidden'}>{recast}</div>
    </div>
  );
}
