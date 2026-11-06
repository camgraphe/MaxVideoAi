import type { CaptureCharacterBuilderAccountRequest } from '../_lib/character-builder-types';
import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
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
  captureAccountRequest: CaptureCharacterBuilderAccountRequest;
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
  captureAccountRequest,
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
  const uploadRevisions = useRef({ identity: 0, style: 0 });
  const activeUploads = useRef<Record<CharacterBuilderReferenceImage['role'], (() => boolean) | null>>({
    identity: null,
    style: null,
  });
  const invalidateReferenceUpload = useCallback((role: CharacterBuilderReferenceImage['role']) => {
    uploadRevisions.current[role]++;
    activeUploads.current[role] = null;
    setStatusMessage((current) => {
      const removedStatus = role === 'identity' ? copy.uploadIdentityStart : copy.uploadStyleStart;
      if (current !== removedStatus) return current;
      const otherRole = role === 'identity' ? 'style' : 'identity';
      return activeUploads.current[otherRole]?.()
        ? otherRole === 'identity' ? copy.uploadIdentityStart : copy.uploadStyleStart
        : null;
    });
  }, [copy.uploadIdentityStart, copy.uploadStyleStart, setStatusMessage]);

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
      const owner = captureAccountRequest();
      if (!owner) return;
      invalidateReferenceUpload(role);
      const revision = uploadRevisions.current[role];
      const request = {
        ...owner,
        isCurrent: () => owner.isCurrent() && uploadRevisions.current[role] === revision,
      };
      activeUploads.current[role] = request.isCurrent;
      setError(null);
      setStatusMessage(role === 'identity' ? copy.uploadIdentityStart : copy.uploadStyleStart);

      try {
        const asset = await uploadImage(file, copy, request);
        if (!request.isCurrent()) return;
        applyReferenceImage(role, buildReferenceImage(role, asset));
        setStatusMessage(role === 'identity' ? copy.uploadIdentityDone : copy.uploadStyleDone);
      } catch (uploadError) {
        if (!request.isCurrent()) return;
        if (isAuthRequiredError(uploadError)) {
          openAuthGate();
          return;
        }
        setError(uploadError instanceof Error ? uploadError.message : copy.uploadFailed);
        setStatusMessage(null);
      } finally {
        if (activeUploads.current[role] === request.isCurrent) activeUploads.current[role] = null;
      }
    },
    [
      applyReferenceImage,
      captureAccountRequest,
      copy,
      invalidateReferenceUpload,
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

      invalidateReferenceUpload(role);
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
      invalidateReferenceUpload,
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
    invalidateReferenceUpload,
    triggerUpload,
  };
}
