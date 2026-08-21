import type { Dispatch, SetStateAction } from 'react';
import type { KlingElementState } from '@/components/KlingElementsBuilder';
import type { EngineInputSchema, Mode } from '@/types/engines';
import { useWorkspaceAssetLibrary } from './useWorkspaceAssetLibrary';
import type {
  CommitInputAssetMutation,
  WorkspaceInputAssetState,
} from './useWorkspaceAssetState';
import { useWorkspaceKlingElementAssets } from './useWorkspaceKlingElementAssets';
import { useWorkspaceReferenceAssets } from './useWorkspaceReferenceAssets';

type UseWorkspaceAssetsOptions = {
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
    assetDeletePendingId,
    fetchAssetLibrary,
    handleAssetLibrarySourceChange,
    closeAssetLibrary,
    handleDeleteLibraryAsset,
    resetAssetLibraryForSource,
  } = useWorkspaceAssetLibrary({
    showNotice,
    setInputAssets,
  });

  const {
    handleOpenAssetLibrary,
    handleSelectLibraryAsset,
    handleAssetAdd,
    handleAssetRemove,
  } = useWorkspaceReferenceAssets({
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
    assetDeletePendingId,
    fetchAssetLibrary,
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
