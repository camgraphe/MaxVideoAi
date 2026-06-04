'use client';

import { useMemo } from 'react';
import { ImageLibraryModal } from '@/app/(core)/(workspace)/app/image/_components/ImageLibraryModal';
import {
  DEFAULT_COPY as DEFAULT_IMAGE_WORKSPACE_COPY,
  mergeCopy as mergeImageWorkspaceCopy,
} from '@/app/(core)/(workspace)/app/image/_lib/image-workspace-copy';
import { useI18n } from '@/lib/i18n/I18nProvider';
import type { CharacterReferenceSelection } from '@/types/image-generation';
import {
  STORYBOARD_REFERENCE_SUPPORTED_FORMATS,
  STORYBOARD_REFERENCE_SUPPORTED_FORMATS_LABEL,
  type StoryboardLibraryAsset,
  type StoryboardLibraryModalState,
} from '../_lib/storyboard-reference-library';

const EMPTY_CHARACTER_REFERENCES: CharacterReferenceSelection[] = [];

type StoryboardReferenceLibraryModalProps = {
  libraryModal: StoryboardLibraryModalState;
  onClose: () => void;
  onSelect: (asset: StoryboardLibraryAsset) => void;
  toolsEnabled: boolean;
};

export function StoryboardReferenceLibraryModal({
  libraryModal,
  onClose,
  onSelect,
  toolsEnabled,
}: StoryboardReferenceLibraryModalProps) {
  const { t } = useI18n();
  const imageWorkspaceCopy = useMemo(
    () =>
      mergeImageWorkspaceCopy(
        DEFAULT_IMAGE_WORKSPACE_COPY,
        (t('workspace.image') ?? {}) as Partial<typeof DEFAULT_IMAGE_WORKSPACE_COPY>
      ),
    [t]
  );

  if (!libraryModal.open) return null;

  return (
    <ImageLibraryModal
      open={libraryModal.open}
      onClose={onClose}
      onSelect={onSelect}
      onToggleCharacter={() => undefined}
      selectedCharacterReferences={EMPTY_CHARACTER_REFERENCES}
      characterSelectionLimit={0}
      copy={imageWorkspaceCopy.library}
      characterCopy={imageWorkspaceCopy.characterPicker}
      selectionMode={libraryModal.selectionMode}
      initialSource={libraryModal.initialSource}
      supportedFormats={STORYBOARD_REFERENCE_SUPPORTED_FORMATS}
      supportedFormatsLabel={STORYBOARD_REFERENCE_SUPPORTED_FORMATS_LABEL}
      toolsEnabled={toolsEnabled}
    />
  );
}
