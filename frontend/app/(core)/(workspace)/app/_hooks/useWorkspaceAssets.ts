import type { Dispatch, SetStateAction } from 'react';
import type { KlingElementState } from '@/components/KlingElementsBuilder';
import type { EngineInputSchema, Mode } from '@/types/engines';
import { useWorkspaceAssetLibrary } from './useWorkspaceAssetLibrary';
import type { CommitInputAssetMutation, WorkspaceInputAssetState } from './useWorkspaceAssetState';
import { useWorkspaceKlingElementAssets } from './useWorkspaceKlingElementAssets';
import { useWorkspaceReferenceAssets } from './useWorkspaceReferenceAssets';

type UseWorkspaceAssetsOptions = {
  accountScope?: string | null;
  userId?: string | null;
  inputAssets: WorkspaceInputAssetState;
  setInputAssets: Dispatch<SetStateAction<WorkspaceInputAssetState>>;
  commitInputAssetMutation: CommitInputAssetMutation;
  engineId?: string | null;
  inputSchema?: EngineInputSchema | null;
  preferredMode: Mode;
  workflowCopy: {
    clearReferencesToUseStartEnd: string;
    clearStartEndToUseReferences: string;
  };
  showNotice: (message: string) => void;
  klingElements: KlingElementState[];
  setKlingElements: Dispatch<SetStateAction<KlingElementState[]>>;
};

export function useWorkspaceAssets({
  accountScope,
  userId,
  inputAssets,
  setInputAssets,
  commitInputAssetMutation,
  engineId,
  inputSchema,
  preferredMode,
  workflowCopy,
  showNotice,
  klingElements,
  setKlingElements,
}: UseWorkspaceAssetsOptions) {
  const {
    assetPickerTarget,
    setAssetPickerTarget,
    assetLibraryKind,
    assetLibrarySource,
    setAssetLibrary,
    visibleAssetLibrary,
    isAssetLibraryLoading,
    assetLibraryError,
    assetLibraryHasMore,
    isAssetLibraryLoadingMore,
    assetDeletePendingId,
    fetchAssetLibrary,
    loadMoreAssetLibrary,
    handleAssetLibrarySourceChange,
    closeAssetLibrary,
    handleDeleteLibraryAsset,
    resetAssetLibraryForSource,
  } = useWorkspaceAssetLibrary({
    userId,
    showNotice,
    setInputAssets,
  });

  const { handleOpenAssetLibrary, handleSelectLibraryAsset, handleAssetAdd, handleAssetRemove } =
    useWorkspaceReferenceAssets({
      accountScope,
      engineId,
      inputSchema,
      preferredMode,
      workflowCopy,
      showNotice,
      inputAssets,
      setInputAssets,
      commitInputAssetMutation,
      assetLibrarySource,
      resetAssetLibraryForSource,
      setAssetPickerTarget,
      setAssetLibrary,
    });

  const {
    handleOpenKlingAssetLibrary,
    handleSelectKlingLibraryAsset,
    handleKlingElementAdd,
    handleKlingElementRemove,
    handleKlingElementAssetRemove,
    handleKlingElementAssetAdd,
  } = useWorkspaceKlingElementAssets({
    accountScope,
    showNotice,
    klingElements,
    setKlingElements,
    assetLibrarySource,
    resetAssetLibraryForSource,
    setAssetPickerTarget,
  });

  return {
    inputAssets,
    setInputAssets,
    assetPickerTarget,
    assetLibraryKind,
    assetLibrarySource,
    visibleAssetLibrary,
    isAssetLibraryLoading,
    assetLibraryError,
    assetLibraryHasMore,
    isAssetLibraryLoadingMore,
    assetDeletePendingId,
    fetchAssetLibrary,
    loadMoreAssetLibrary,
    handleAssetLibrarySourceChange,
    closeAssetLibrary,
    handleDeleteLibraryAsset,
    handleOpenAssetLibrary,
    handleOpenKlingAssetLibrary,
    handleSelectLibraryAsset,
    handleSelectKlingLibraryAsset,
    handleAssetAdd,
    handleAssetRemove,
    handleKlingElementAdd,
    handleKlingElementRemove,
    handleKlingElementAssetRemove,
    handleKlingElementAssetAdd,
  };
}
