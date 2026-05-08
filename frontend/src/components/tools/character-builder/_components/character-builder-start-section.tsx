import type { Dispatch, RefObject, SetStateAction } from 'react';
import { Upload } from 'lucide-react';
import type {
  CharacterBuilderReferenceImage,
  CharacterBuilderState,
} from '@/types/character-builder';
import type { CharacterCopy } from '../_lib/character-builder-copy';
import { OutputPreviewCard, ReferenceSlot, SectionTitle } from './character-builder-workspace-components';

export function CharacterBuilderStartSection({
  canUseReferences,
  copy,
  identityFileRef,
  identityReference,
  onAuthRequired,
  onRemoveIdentityReference,
  onRemoveStyleReference,
  outputMode,
  setLibraryModalRole,
  setShowStyleReferenceSlot,
  setState,
  showStyleReferenceSlot,
  styleFileRef,
  styleReference,
}: {
  canUseReferences: boolean;
  copy: CharacterCopy;
  identityFileRef: RefObject<HTMLInputElement | null>;
  identityReference: CharacterBuilderReferenceImage | null;
  onAuthRequired: () => void;
  onRemoveIdentityReference: () => void;
  onRemoveStyleReference: () => void;
  outputMode: CharacterBuilderState['outputMode'];
  setLibraryModalRole: Dispatch<SetStateAction<CharacterBuilderReferenceImage['role'] | null>>;
  setShowStyleReferenceSlot: Dispatch<SetStateAction<boolean>>;
  setState: Dispatch<SetStateAction<CharacterBuilderState>>;
  showStyleReferenceSlot: boolean;
  styleFileRef: RefObject<HTMLInputElement | null>;
  styleReference: CharacterBuilderReferenceImage | null;
}) {
  const openIdentityUpload = () => {
    if (!canUseReferences) {
      onAuthRequired();
      return;
    }
    identityFileRef.current?.click();
  };
  const openStyleUpload = () => {
    if (!canUseReferences) {
      onAuthRequired();
      return;
    }
    styleFileRef.current?.click();
  };
  const openIdentityLibrary = () => {
    if (!canUseReferences) {
      onAuthRequired();
      return;
    }
    setLibraryModalRole('identity');
  };
  const openStyleLibrary = () => {
    if (!canUseReferences) {
      onAuthRequired();
      return;
    }
    setShowStyleReferenceSlot(true);
    setLibraryModalRole('style');
  };

  return (
    <section className="space-y-4">
      <SectionTitle title={copy.top.start} />
      <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
        <OutputPreviewCard
          selected={outputMode === 'character-sheet'}
          title={copy.generatePanel.sheetTitle}
          subtitle={copy.generatePanel.sheetBody}
          mode="character-sheet"
          onClick={() =>
            setState((previous) => ({
              ...previous,
              outputMode: 'character-sheet',
              outputOptions: {
                ...previous.outputOptions,
                fullBodyRequired: true,
              },
            }))
          }
        />
        <OutputPreviewCard
          selected={outputMode === 'portrait-reference'}
          title={copy.generatePanel.portraitTitle}
          subtitle={copy.generatePanel.portraitBody}
          mode="portrait-reference"
          onClick={() =>
            setState((previous) => ({
              ...previous,
              outputMode: 'portrait-reference',
              outputOptions: {
                ...previous.outputOptions,
                fullBodyRequired: false,
              },
            }))
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReferenceSlot
          title={copy.references.identityTitle}
          subtitle={copy.references.identityBody}
          image={identityReference}
          onUpload={openIdentityUpload}
          onOpenLibrary={openIdentityLibrary}
          removeLabel={copy.references.remove}
          libraryLabel={copy.library.open}
          optionalLabel={copy.sections.optional}
          onRemove={onRemoveIdentityReference}
        />
        {showStyleReferenceSlot || styleReference ? (
          <ReferenceSlot
            title={copy.references.styleTitle}
            subtitle={copy.references.styleBody}
            image={styleReference}
            onUpload={openStyleUpload}
            onOpenLibrary={openStyleLibrary}
            removeLabel={copy.references.remove}
            libraryLabel={copy.library.open}
            optionalLabel={copy.sections.optional}
            onRemove={onRemoveStyleReference}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowStyleReferenceSlot(true)}
            className="flex min-h-[180px] flex-col items-center justify-center rounded-card border border-dashed border-border bg-bg/40 px-4 py-6 text-center transition hover:border-border-hover hover:bg-surface-hover"
          >
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
              <Upload className="h-5 w-5" />
            </span>
            <div className="mt-3 flex items-center justify-center gap-2">
              <p className="text-sm font-semibold text-text-primary">{copy.references.addInspiration}</p>
              <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-micro text-text-secondary">
                {copy.sections.optional}
              </span>
            </div>
            <p className="mt-1 text-xs text-text-secondary">{copy.references.addInspirationBody}</p>
          </button>
        )}
      </div>
    </section>
  );
}
