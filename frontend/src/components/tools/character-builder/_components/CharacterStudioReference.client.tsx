'use client';
import { ImagePlus, FolderOpen, X } from 'lucide-react';
import { LibraryImageThumbnail } from '@/components/library/LibraryImageThumbnail.client';
import type { CharacterBuilderReferenceImage } from '@/types/character-builder';
import type { StudioCopy } from '../_lib/character-studio-copy';

export function CharacterStudioReference({
  image,
  label,
  copy,
  onUpload,
  onLibrary,
  onRemove,
}: {
  image: CharacterBuilderReferenceImage | null;
  label: string;
  copy: StudioCopy;
  onUpload: () => void;
  onLibrary: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border p-3">
      <div className="flex items-center gap-3">
        {image ? (
          <LibraryImageThumbnail
            asset={{ url: image.url }}
            alt={image.name || label}
            className="h-14 w-12 shrink-0 rounded-md object-cover"
          />
        ) : (
          <ImagePlus size={20} className="shrink-0 text-text-secondary" />
        )}
        <span className="min-w-0 flex-1 text-xs text-text-secondary">{image?.name || label}</span>
        {image ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`${copy.remove} · ${label}`}
            className="rounded p-2 text-text-secondary"
          >
            <X size={16} />
          </button>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onUpload}
          className="flex min-h-9 items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs"
        >
          <ImagePlus size={14} />
          {copy.upload}
        </button>
        <button
          type="button"
          onClick={onLibrary}
          className="flex min-h-9 items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs"
        >
          <FolderOpen size={14} />
          {copy.library}
        </button>
      </div>
    </div>
  );
}
