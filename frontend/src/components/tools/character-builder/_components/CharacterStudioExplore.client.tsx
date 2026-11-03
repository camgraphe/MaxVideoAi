'use client';
import { ArrowUpRight } from 'lucide-react';
import { CHARACTER_INSPIRATIONS } from '../_lib/character-studio-state';
import type { StudioCopy } from '../_lib/character-studio-copy';
import { StudioImage } from './CharacterStudioChoices.client';

export function CharacterStudioExplore({
  copy,
  onChoose,
  onNew,
}: {
  copy: StudioCopy;
  onChoose: (name: string) => void;
  onNew: () => void;
}) {
  return (
    <section className="space-y-5 p-4 sm:p-6">
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
