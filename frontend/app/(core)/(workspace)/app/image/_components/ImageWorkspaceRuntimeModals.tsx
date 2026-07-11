'use client';

import dynamic from 'next/dynamic';
import type { Dispatch, SetStateAction } from 'react';
import type { MediaLightboxEntry } from '@/components/MediaLightbox';
import type { CharacterReferenceSelection } from '@/types/image-generation';
import type { VideoGroup } from '@/types/video-groups';
import type { ImageAuthGateModalProps } from './ImageAuthGateModal';
import type { ImageLibraryModalProps } from './ImageLibraryModal';
import type { ImageWorkspaceCopy } from '../_lib/image-workspace-copy';
import type {
  ImageLibraryModalState,
  LibraryAsset,
} from '../_lib/image-workspace-types';

const GroupViewerModal = dynamic(
  () => import('@/components/groups/GroupViewerModal').then((mod) => mod.GroupViewerModal),
  { ssr: false }
);

const ImageAuthGateModal = dynamic<ImageAuthGateModalProps>(
  () => import('./ImageAuthGateModal').then((mod) => mod.ImageAuthGateModal),
  { ssr: false }
);

const ImageLibraryModal = dynamic<ImageLibraryModalProps>(
  () => import('./ImageLibraryModal').then((mod) => mod.ImageLibraryModal),
  { ssr: false }
);

type ImageWorkspaceRuntimeModalsProps = {
  authModalOpen: boolean;
  characterSelectionLimit: number;
  closeLibraryModal: () => void;
  closeViewer: () => void;
  handleLibrarySelect: (asset: LibraryAsset) => void;
  handleSaveVariantToLibrary: (entry: MediaLightboxEntry) => Promise<void>;
  libraryModal: ImageLibraryModalState;
  loginRedirectTarget: string;
  resolvedCopy: ImageWorkspaceCopy;
  selectedCharacterReferences: CharacterReferenceSelection[];
  setAuthModalOpen: Dispatch<SetStateAction<boolean>>;
  supportedReferenceFormats: string[];
  supportedReferenceFormatsLabel: string;
  toggleCharacterReference: (reference: CharacterReferenceSelection) => void;
  toolsEnabled: boolean;
  viewerGroup: VideoGroup | null;
};

export function ImageWorkspaceRuntimeModals({
  authModalOpen,
  characterSelectionLimit,
  closeLibraryModal,
  closeViewer,
  handleLibrarySelect,
  handleSaveVariantToLibrary,
  libraryModal,
  loginRedirectTarget,
  resolvedCopy,
  selectedCharacterReferences,
  setAuthModalOpen,
  supportedReferenceFormats,
  supportedReferenceFormatsLabel,
  toggleCharacterReference,
  toolsEnabled,
  viewerGroup,
}: ImageWorkspaceRuntimeModalsProps) {
  return (
    <>
      {viewerGroup ? (
        <GroupViewerModal
          group={viewerGroup}
          onClose={closeViewer}
          onSaveToLibrary={handleSaveVariantToLibrary}
        />
      ) : null}
      {authModalOpen ? (
        <ImageAuthGateModal
          open
          copy={resolvedCopy.authGate}
          loginRedirectTarget={loginRedirectTarget}
          onClose={() => setAuthModalOpen(false)}
        />
      ) : null}
      {libraryModal.open ? (
        <ImageLibraryModal
          open={libraryModal.open}
          onClose={closeLibraryModal}
          onSelect={handleLibrarySelect}
          onToggleCharacter={toggleCharacterReference}
          selectedCharacterReferences={selectedCharacterReferences}
          characterSelectionLimit={characterSelectionLimit}
          copy={resolvedCopy.library}
          characterCopy={resolvedCopy.characterPicker}
          selectionMode={libraryModal.selectionMode}
          initialSource={libraryModal.initialSource}
          supportedFormats={supportedReferenceFormats}
          supportedFormatsLabel={supportedReferenceFormatsLabel}
          toolsEnabled={toolsEnabled}
        />
      ) : null}
    </>
  );
}
