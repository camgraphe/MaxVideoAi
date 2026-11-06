'use client';
import { useEffect, useState } from 'react';
import { ArrowLeft, Clapperboard, Loader2, Shirt } from 'lucide-react';
import { LibraryImageThumbnail } from '@/components/library/LibraryImageThumbnail.client';
import type { StudioImage } from '@/types/character-studio';
import type { StudioLibraryCopy } from '../_lib/character-studio-library-copy';
import type { useCharacterStudioLibrary } from '../_hooks/useCharacterStudioLibrary';

import { CharacterStudioSheet } from './CharacterStudioSheet.client';
import { CharacterStudioPresentation } from './CharacterStudioPresentation.client';
import type { CharacterCopy } from '../_lib/character-builder-copy';
import type { StudioLocale } from '@/lib/character-studio-catalog';

type ImageSource = Pick<StudioImage, 'imageUrl' | 'thumbUrl' | 'jobId'>;
export function CharacterStudioLibrary({
  library,
  builderCopy,
  locale,
  copy,
  userId,
  onSignIn,
  onNewLook,
  onRecast,
}: {
  builderCopy: CharacterCopy;
  locale: StudioLocale;
  library: ReturnType<typeof useCharacterStudioLibrary>;
  copy: StudioLibraryCopy;
  userId: string | null;
  onSignIn: () => void;
  onNewLook: (id: string, sheet?: boolean) => void;
  onRecast: (image: ImageSource, name: string, characterId: string) => void;
}) {
  const { selected } = library;
  const [name, setName] = useState(''),
    [renaming, setRenaming] = useState(false);
  useEffect(() => {
    setName(selected?.name ?? '');
  }, [selected?.id, selected?.name]);
  const buttonClass =
    'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 text-xs hover:bg-surface-hover disabled:opacity-50';
  function preview(image: ImageSource, name: string) {
    return (
      <LibraryImageThumbnail
        asset={{ url: image.imageUrl, thumbUrl: image.thumbUrl, kind: 'image' }}
        alt={name}
        className="aspect-[4/3] w-full bg-bg object-contain"
      />
    );
  }
  if (!userId)
    return (
      <div className="p-6">
        <button type="button" onClick={onSignIn} className={buttonClass}>
          {copy.signIn}
        </button>
      </div>
    );
  return (
    <div className="space-y-4 p-4 sm:p-5">
      {library.error ? (
        <div role="alert" className="rounded-xl border border-border bg-bg p-4 text-sm">
          <p>{copy.unavailable}</p>
          <button type="button" onClick={() => void library.retry()} className={`${buttonClass} mt-3`}>
            {copy.retry}
          </button>
        </div>
      ) : null}
      {library.loading || library.detailLoading ? (
        <p role="status" className="flex items-center gap-2 text-sm text-text-secondary">
          <Loader2 className="animate-spin" size={16} />
          {copy.loading}
        </p>
      ) : null}
      {selected ? (
        <>
          <button type="button" onClick={library.closeCharacter} className={buttonClass}>
            <ArrowLeft size={14} />
            {copy.back}
          </button>
          <div className="grid gap-4 rounded-xl border border-border bg-bg/50 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-lg">{preview(selected.identity, selected.name)}</div>
            <div className="space-y-4">
              <p className="text-xs text-text-secondary">{copy.identity}</p>
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  setRenaming(true);
                  try {
                    await library.rename(selected.id, name.trim());
                  } finally {
                    setRenaming(false);
                  }
                }}
                className="space-y-2"
              >
                <label className="block text-xs text-text-secondary">
                  {copy.name}
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={80}
                    required
                    className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary"
                  />
                </label>
                {name.trim() !== selected.name ? (
                  <button type="submit" disabled={renaming || !name.trim()} className={buttonClass}>
                    {copy.rename}
                  </button>
                ) : null}
              </form>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => onNewLook(selected.id)} className={buttonClass}>
                  <Shirt size={14} />
                  {copy.newLook}
                </button>
                <button type="button" className={buttonClass} onClick={() => onNewLook(selected.id, true)}>
                  {copy.sheet}
                </button>
                <button
                  type="button"
                  onClick={() => onRecast(selected.identity, selected.name, selected.id)}
                  className={buttonClass}
                >
                  <Clapperboard size={14} />
                  {copy.recast}
                </button>
              </div>
            </div>
          </div>
          <CharacterStudioPresentation
            key={selected.id}
            character={selected}
            copy={builderCopy}
            locale={locale}
            onSave={(profile) => library.savePresentation(selected.id, profile)}
          />
          <h3 className="text-sm font-medium">
            {copy.looks} <span className="text-text-secondary">{selected.lookCount}</span>
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {selected.looks.map((look) => (
              <article key={look.id} className="overflow-hidden rounded-xl border border-border bg-bg/50">
                {preview(look, look.name)}
                <div className="space-y-3 p-3">
                  <h4 className="truncate text-sm font-medium">{look.name}</h4>
                  {look.settingsSnapshot.builder.outputMode === 'character-sheet' && (
                    <CharacterStudioSheet character={selected} look={look} locale={locale} />
                  )}
                  <button
                    type="button"
                    onClick={() => onRecast(look, `${selected.name} · ${look.name}`, selected.id)}
                    className={buttonClass}
                  >
                    <Clapperboard size={14} />
                    {copy.recast}
                  </button>
                </div>
              </article>
            ))}
          </div>
          {selected.nextLookCursor ? (
            <button
              type="button"
              disabled={library.detailLoading}
              onClick={() => void library.openCharacter(selected.id, selected.nextLookCursor)}
              className={buttonClass}
            >
              {copy.more}
            </button>
          ) : null}
        </>
      ) : (
        <>
          {!library.loading && !library.error && !library.characters.length ? (
            <div className="rounded-xl border border-dashed border-border p-6">
              <h2 className="text-base font-medium">{copy.empty}</h2>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{copy.emptyBody}</p>
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {library.characters.map((character) => (
              <article
                key={character.id}
                className="overflow-hidden rounded-xl border border-border bg-bg/50"
              >
                <button
                  type="button"
                  onClick={() => void library.openCharacter(character.id)}
                  className="block w-full text-left"
                >
                  {preview(character.identity, character.name)}
                  <span className="block truncate px-3 pt-3 text-sm font-medium">{character.name}</span>
                </button>
                <p className="px-3 pt-1 text-xs text-text-secondary">
                  {copy.looks} · {character.lookCount}
                </p>
                <div className="flex flex-wrap gap-2 p-3">
                  <button type="button" onClick={() => onNewLook(character.id)} className={buttonClass}>
                    <Shirt size={14} />
                    {copy.newLook}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRecast(character.identity, character.name, character.id)}
                    className={buttonClass}
                  >
                    <Clapperboard size={14} />
                    {copy.recast}
                  </button>
                </div>
              </article>
            ))}
          </div>
          {library.nextCursor ? (
            <button
              type="button"
              disabled={library.loading}
              onClick={() => void library.load(library.nextCursor)}
              className={buttonClass}
            >
              {copy.more}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
