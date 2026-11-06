'use client';
import { LockKeyhole } from 'lucide-react';
import { LibraryImageThumbnail } from '@/components/library/LibraryImageThumbnail.client';
import type { CharacterBuilderReferenceImage } from '@/types/character-builder';
import type { StudioLibraryCopy } from '../_lib/character-studio-library-copy';

export function CharacterStudioIdentity({
  image,
  copy,
  onLibrary,
}: {
  image: CharacterBuilderReferenceImage | null | undefined;
  copy: StudioLibraryCopy;
  onLibrary: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-brand/30 bg-brand/5 p-3">
      <div className="flex items-center gap-3">
        {image ? (
          <LibraryImageThumbnail
            asset={{ url: image.url, kind: 'image' }}
            alt={image.name ?? copy.identity}
            className="h-16 w-16 shrink-0 rounded-lg bg-bg object-contain"
          />
        ) : null}
        <div className="min-w-0">
          <p className="text-xs text-text-secondary">{copy.newLook}</p>
          <h2 className="truncate text-sm font-medium">{image?.name || copy.defaultCharacter}</h2>
        </div>
        <LockKeyhole size={15} className="ml-auto shrink-0 text-brand" />
      </div>
      <p className="text-xs leading-relaxed text-text-secondary">{copy.identityLocked}</p>
      <button type="button" onClick={onLibrary} className="text-xs underline underline-offset-4">
        {copy.title}
      </button>
    </div>
  );
}
