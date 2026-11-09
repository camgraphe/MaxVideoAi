'use client';
import type { ComponentProps } from 'react';
import { MediaLightbox, type MediaLightboxEntry } from '@/components/MediaLightbox';
import type { useCharacterStudioLibrary } from '../_hooks/useCharacterStudioLibrary';
import type { CharacterCopy } from '../_lib/character-builder-copy';
import type { StudioLibraryCopy } from '../_lib/character-studio-library-copy';
import { CharacterReferenceLibraryModal } from './character-builder-reference-library';
import { CharacterBuilderAuthGateModal } from './character-builder-page-shell';
import { CharacterStudioSaveDialog } from './CharacterStudioSaveDialog.client';

export function CharacterStudioOverlays(props: {
  library: ReturnType<typeof useCharacterStudioLibrary>;
  libraryCopy: StudioLibraryCopy;
  copy: CharacterCopy;
  lightboxEntry: MediaLightboxEntry | null;
  onCloseLightbox: () => void;
  referenceOpen: boolean;
  referenceRole?: string | null;
  userId: string | null;
  onCloseReference: () => void;
  onSelectReference: ComponentProps<typeof CharacterReferenceLibraryModal>['onSelect'];
  authOpen: boolean;
  onCloseAuth: () => void;
  loginRedirectTarget: string;
  onSaved: () => void;
}) {
  const { library, libraryCopy, copy, lightboxEntry } = props;
  return (
    <>
      {library.saveTarget ? (
        <CharacterStudioSaveDialog
          key={`${library.saveTarget.jobId}:${library.saveTarget.imageUrl}`}
          target={library.saveTarget}
          busy={library.saving}
          error={library.saveError}
          copy={libraryCopy}
          onClose={library.closeSave}
          onRetry={() => {
            if (library.saveTarget) void library.openSave(library.saveTarget);
          }}
          onSave={async (name) => {
            if (await library.save(name)) props.onSaved();
          }}
        />
      ) : null}
      {lightboxEntry ? (
        <MediaLightbox
          title={copy.top.resultsTitle}
          subtitle={lightboxEntry.engineLabel ?? undefined}
          prompt={lightboxEntry.prompt ?? null}
          entries={[lightboxEntry]}
          onClose={props.onCloseLightbox}
        />
      ) : null}
      <CharacterReferenceLibraryModal
        role={props.referenceRole}
        open={props.referenceOpen}
        userId={props.userId}
        onClose={props.onCloseReference}
        onSelect={props.onSelectReference}
        copy={copy}
      />
      <CharacterBuilderAuthGateModal
        open={props.authOpen}
        copy={copy}
        loginRedirectTarget={props.loginRedirectTarget}
        onClose={props.onCloseAuth}
      />
    </>
  );
}
