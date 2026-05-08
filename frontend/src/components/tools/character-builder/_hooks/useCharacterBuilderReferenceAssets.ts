import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { normalizeTraitsForSourceMode } from '@/lib/character-builder';
import type {
  CharacterBuilderReferenceImage,
  CharacterBuilderState,
} from '@/types/character-builder';
import {
  buildReferenceImage,
  isAuthRequiredError,
  updateReferenceImage,
  uploadImage,
} from '../_lib/character-builder-helpers';
import type { CharacterCopy } from '../_lib/character-builder-copy';
import type { CharacterLibraryAsset } from '../_lib/character-builder-types';

interface UseCharacterBuilderReferenceAssetsOptions {
  copy: CharacterCopy;
  libraryModalRole: CharacterBuilderReferenceImage['role'] | null;
  openAuthGate: () => void;
  setError: Dispatch<SetStateAction<string | null>>;
  setLibraryModalRole: Dispatch<SetStateAction<CharacterBuilderReferenceImage['role'] | null>>;
  setShowStyleReferenceSlot: Dispatch<SetStateAction<boolean>>;
  setState: Dispatch<SetStateAction<CharacterBuilderState>>;
  setStatusMessage: Dispatch<SetStateAction<string | null>>;
  user: unknown;
}

export function useCharacterBuilderReferenceAssets({
  copy,
  libraryModalRole,
  openAuthGate,
  setError,
  setLibraryModalRole,
  setShowStyleReferenceSlot,
  setState,
  setStatusMessage,
  user,
}: UseCharacterBuilderReferenceAssetsOptions) {
  const applyReferenceImage = useCallback(
    (role: CharacterBuilderReferenceImage['role'], nextImage: CharacterBuilderReferenceImage) => {
      if (role === 'style') {
        setShowStyleReferenceSlot(true);
      }
      setState((previous) => ({
        ...previous,
        sourceMode: role === 'identity' ? 'reference-image' : previous.sourceMode,
        referenceStrength:
          role === 'identity'
            ? previous.referenceStrength ?? 'balanced'
            : previous.referenceStrength,
        referenceImages: updateReferenceImage(previous.referenceImages, nextImage),
        traits: role === 'identity' ? normalizeTraitsForSourceMode(previous.traits, 'reference-image') : previous.traits,
      }));
    },
    [setShowStyleReferenceSlot, setState]
  );

  const handleUpload = useCallback(
    async (role: CharacterBuilderReferenceImage['role'], file: File) => {
      if (!user) {
        openAuthGate();
        return;
      }
      setError(null);
      setStatusMessage(role === 'identity' ? copy.uploadIdentityStart : copy.uploadStyleStart);

      try {
        const asset = await uploadImage(file, copy);
        applyReferenceImage(role, buildReferenceImage(role, asset));
        setStatusMessage(role === 'identity' ? copy.uploadIdentityDone : copy.uploadStyleDone);
      } catch (uploadError) {
        if (isAuthRequiredError(uploadError)) {
          openAuthGate();
          return;
        }
        setError(uploadError instanceof Error ? uploadError.message : copy.uploadFailed);
        setStatusMessage(null);
      }
    },
    [
      applyReferenceImage,
      copy,
      openAuthGate,
      setError,
      setStatusMessage,
      user,
    ]
  );

  const triggerUpload = useCallback(
    async (role: CharacterBuilderReferenceImage['role'], fileList: FileList | null) => {
      const file = fileList?.[0];
      if (!file) return;
      await handleUpload(role, file);
    },
    [handleUpload]
  );

  const handleLibrarySelect = useCallback(
    (asset: CharacterLibraryAsset) => {
      if (!user) {
        openAuthGate();
        return;
      }
      const role = libraryModalRole;
      if (!role) return;

      applyReferenceImage(role, {
        id: asset.id,
        url: asset.url,
        role,
        width: asset.width ?? null,
        height: asset.height ?? null,
        name: null,
      });
      setLibraryModalRole(null);
      setStatusMessage(role === 'identity' ? copy.uploadIdentityDone : copy.uploadStyleDone);
      setError(null);
    },
    [
      applyReferenceImage,
      copy.uploadIdentityDone,
      copy.uploadStyleDone,
      libraryModalRole,
      openAuthGate,
      setError,
      setLibraryModalRole,
      setStatusMessage,
      user,
    ]
  );

  return {
    handleLibrarySelect,
    triggerUpload,
  };
}
