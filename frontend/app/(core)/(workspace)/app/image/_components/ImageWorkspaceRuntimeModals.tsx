'use client';

import dynamic from 'next/dynamic';
import { useRef, type Dispatch, type SetStateAction } from 'react';
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
  referenceSlotLimit: number;
  closeLibraryModal: () => void;
  closeViewer: () => void;
  modelIntent: string;
  handleLibrarySelectMany: (assets: LibraryAsset[]) => boolean | void;
  handleLibrarySelect: (asset: LibraryAsset) => boolean | void;
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
  referenceSlotLimit,
  closeLibraryModal,
  closeViewer,
  handleLibrarySelect,
  handleLibrarySelectMany,
  modelIntent,
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
  const libraryHasOpened = useRef(false);
  if (libraryModal.open) libraryHasOpened.current = true;
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
      {libraryHasOpened.current ? <ImageLibraryModal
          target={{ scope: `${modelIntent}:${libraryModal.slotIndex ?? "append"}`, capacity: referenceSlotLimit, slotIndex: libraryModal.slotIndex }}
          open={libraryModal.open}
          onClose={closeLibraryModal}
          onSelect={handleLibrarySelect}
          onSelectMany={libraryModal.slotIndex == null ? handleLibrarySelectMany : undefined}
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
        /> : null}
    </>
  );
}
