'use client';
import { useEffect, useRef, useState } from 'react';
import { LibraryImageThumbnail } from '@/components/library/LibraryImageThumbnail.client';
import type { StudioLibraryCopy } from '../_lib/character-studio-library-copy';

export function CharacterStudioSaveDialog({
  target,
  busy,
  error,
  copy,
  onSave,
  onRetry,
  onClose,
}: {
  target: {
    jobId: string;
    imageUrl: string;
    characterId: string | null;
    loading: boolean;
  };
  busy: boolean;
  error: boolean;
  copy: StudioLibraryCopy;
  onSave: (name: string) => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => {
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    if (!target.loading) {
      setName('');
      input.current?.focus();
    }
  }, [target.loading, target.characterId, copy.defaultLook, copy.defaultCharacter]);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="studio-save-title"
      aria-describedby="studio-save-hint"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[calc(100%_-_2rem)] max-w-md rounded-2xl border border-border bg-surface p-5 text-text-primary shadow-xl backdrop:bg-black/65"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && !target.loading)
            onSave(name.trim() || (target.characterId ? copy.defaultLook : copy.defaultCharacter));
        }}
      >
        <h2 id="studio-save-title" className="text-lg font-semibold">
          {target.characterId ? copy.saveLook : copy.saveCharacter}
        </h2>
        <p id="studio-save-hint" className="mt-2 text-sm text-text-secondary">
          {target.characterId ? copy.lookHint : copy.characterHint}
        </p>
        <LibraryImageThumbnail
          asset={{ url: target.imageUrl, kind: 'image' }}
          className="my-4 h-40 w-full rounded-xl bg-bg object-contain"
        />
        {target.loading && !error ? (
          <p role="status" className="text-sm text-text-secondary">
            {copy.loadingSource}
          </p>
        ) : null}
        <label className="mt-3 block text-sm">
          {copy.name}
          <input
            ref={input}
            placeholder={target.characterId ? copy.defaultLook : copy.defaultCharacter}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            disabled={target.loading || busy}
            className="mt-2 w-full rounded-lg border border-border bg-bg px-3 py-2.5"
          />
        </label>
        {error ? (
          <div role="alert" className="mt-3 text-sm text-text-secondary">
            {copy.failed}
            {target.loading ? (
              <button type="button" onClick={onRetry} className="ml-2 underline">
                {copy.retry}
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-lg border border-border px-4 text-sm"
          >
            {copy.cancel}
          </button>
          <button
            type="submit"
            disabled={busy || target.loading}
            className="min-h-10 rounded-lg bg-brand px-4 text-sm font-medium text-on-brand disabled:opacity-50"
          >
            {busy ? copy.saving : copy.save}
          </button>
        </div>
      </form>
    </dialog>
  );
}
