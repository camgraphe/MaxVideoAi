'use client';
import type { RefObject } from 'react';
import { ImagePlus, FolderOpen, Plus, X } from 'lucide-react';
import { LibraryImageThumbnail } from '@/components/library/LibraryImageThumbnail.client';
import type { CharacterBuilderReferenceImage } from '@/types/character-builder';
import type { StudioCopy } from '../_lib/character-studio-copy';
import { StudioImage } from './CharacterStudioChoices.client';

export function CharacterStudioReference({
  image,
  label,
  copy,
  onUpload,
  onLibrary,
  onRemove,
  prominent = false,
}: {
  image: CharacterBuilderReferenceImage | null;
  label: string;
  copy: StudioCopy;
  onUpload: () => void;
  onLibrary: () => void;
  onRemove: () => void;
  prominent?: boolean;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onUpload}
        className={`group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-surface-hover to-surface p-4 text-left shadow-[inset_0_1px_0_0_rgb(255_255_255_/_0.08),0_6px_16px_-8px_rgb(0_0_0_/_0.35)] transition hover:border-brand/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${prominent ? 'min-h-[128px]' : 'min-h-24'}`}
      >
        {image ? (
          <LibraryImageThumbnail
            asset={{ url: image.url }}
            alt={image.name || label}
            className="h-20 w-16 shrink-0 rounded-lg object-cover shadow-md"
          />
        ) : prominent ? (
          <span aria-hidden="true" className="relative ml-1 block h-20 w-[74px] shrink-0">
            <StudioImage
              atlas="identity"
              tile={7}
              className="absolute left-0 top-0 h-16 w-16 -rotate-12 rounded-lg border-2 border-surface shadow-lg"
            />
            <StudioImage
              atlas="identity"
              tile={3}
              className="absolute left-3 top-2 h-16 w-16 rotate-6 rounded-lg border-2 border-surface shadow-lg transition group-hover:rotate-0"
            />
            <span className="absolute -bottom-1 -right-2 rounded-full border-2 border-surface bg-brand p-1 text-on-brand shadow-sm">
              <Plus size={14} />
            </span>
          </span>
        ) : (
          <ImagePlus size={24} className="shrink-0 text-text-secondary" />
        )}
        <span className="min-w-0 flex-1 pr-2">
          <span className="block text-sm font-semibold text-text-primary">
            {image ? copy.replacePhoto : prominent ? copy.uploadPhoto : label}
          </span>
          <span className="mt-1.5 block text-xs leading-relaxed text-text-secondary">
            {image?.name || (prominent ? copy.uploadHint : copy.upload)}
          </span>
        </span>
        {!image && (
          <span className="absolute right-2 top-2 rounded-full bg-bg/50 px-2 py-0.5 text-[10px] text-text-secondary">
            {copy.optional}
          </span>
        )}
      </button>
      {image && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${copy.remove} · ${label}`}
          className="absolute right-2 top-2 rounded-full bg-bg p-1.5 text-text-secondary shadow-sm hover:text-text-primary"
        >
          <X size={14} />
        </button>
      )}
      <button
        type="button"
        onClick={onLibrary}
        className="mx-auto mt-1.5 flex min-h-8 items-center justify-center gap-1.5 rounded-md px-3 text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary"
      >
        <FolderOpen size={13} />
        {copy.library}
      </button>
    </div>
  );
}
export function CharacterStudioReferenceInputs({
  identityRef,
  styleRef,
  onUpload,
}: {
  identityRef: RefObject<HTMLInputElement>;
  styleRef: RefObject<HTMLInputElement>;
  onUpload: (role: 'identity' | 'style', files: FileList | null) => void;
}) {
  return (
    <>
      {(['identity', 'style'] as const).map((role) => (
        <input
          key={role}
          ref={role === 'identity' ? identityRef : styleRef}
          data-character-reference={role}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            onUpload(role, event.target.files);
            event.target.value = '';
          }}
        />
      ))}
    </>
  );
}
