'use client';
import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { CHARACTER_INSPIRATIONS } from '../_lib/character-studio-state';
import type { StudioCopy } from '../_lib/character-studio-copy';
import { StudioImage } from './CharacterStudioChoices.client';

export function CharacterStudioEntry({ identity, copy, onExplore }: { identity: ReactNode; copy: StudioCopy; onExplore?: () => void }) {
  return (
    <div className="px-3 pb-2 pt-1">
      {identity}
      {onExplore ? (
        <button type="button" onClick={onExplore} className="mt-1 flex min-h-9 w-full items-center justify-center rounded-md px-3 text-xs text-text-secondary underline underline-offset-4 hover:bg-surface-hover hover:text-text-primary lg:hidden">
          {copy.exploreInspirations}
        </button>
      ) : null}
    </div>
  );
}

export function CharacterStudioExplore({
  copy,
  onChoose,
  onNew,
  recastExamples,
  onRecast,
}: {
  copy: StudioCopy;
  onChoose: (name: string) => void;
  onNew: () => void;
  recastExamples?: ReactNode;
  onRecast?: () => void;
}) {
  return (
    <section className="space-y-5 p-4 sm:p-6">
      {recastExamples}
      {onRecast ? <button type="button" onClick={onRecast} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium text-text-primary hover:bg-surface-2">
        Recast<ArrowUpRight size={16} aria-hidden="true" />
      </button> : null}
      <div>
        <h2 className="text-xl font-medium text-text-primary">{copy.startTitle}</h2>
        <p className="mt-2 text-sm text-text-secondary">{copy.startBody}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {CHARACTER_INSPIRATIONS.map((item) => (
          <button
            type="button"
            key={item.name}
            aria-label={`${copy.inspiration} ${item.name}`}
            onClick={() => onChoose(item.name)}
            className="group relative overflow-hidden rounded-xl border border-border text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          >
            <StudioImage
              atlas="gallery"
              tile={item.tile}
              className="aspect-[3/4] transition-transform duration-200 motion-safe:group-hover:scale-[1.025]"
            />
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-14 text-white">
              <span className="text-base font-medium">{item.name}</span>
              <ArrowUpRight size={18} />
            </span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-md text-xs leading-relaxed text-text-secondary">{copy.inspirationNote}</p>
        <button
          type="button"
          onClick={onNew}
          className="text-sm font-medium text-text-primary underline underline-offset-4"
        >
          {copy.fresh}
        </button>
      </div>
    </section>
  );
}
