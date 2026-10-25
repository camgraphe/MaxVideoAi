import type { Dispatch, SetStateAction } from 'react';
import type { KlingElementState } from '@/components/KlingElementsBuilder';
import { useWorkspaceVideoExcerpt } from './useWorkspaceVideoExcerpt';
import type { EngineCaps, EngineInputSchema, Mode } from '@/types/engines';
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
  engine?: EngineCaps | null;
  locale?: string;
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
  engine,
  locale,
  inputSchema = engine?.inputSchema,
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

  const { handleOpenAssetLibrary, handleSelectLibraryAsset, handleImportLibraryFile, handleAssetAdd, handleAssetRemove } =
    useWorkspaceReferenceAssets({
      accountScope,
      engineId,
      engine,
      locale,
      assetPickerTarget,
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
    handleImportKlingLibraryFile,
    handleKlingElementAdd,
    handleKlingElementRemove,
    handleKlingElementAssetRemove,
    handleKlingElementAssetAdd,
  } = useWorkspaceKlingElementAssets({
    accountScope,
    engineId,
    preferredMode,
    locale,
    showNotice,
    klingElements,
    setKlingElements,
    assetLibrarySource,
    resetAssetLibraryForSource,
    setAssetPickerTarget,
  });

  const excerpts = useWorkspaceVideoExcerpt({ accountScope, engine, mode: preferredMode, inputAssets, commitInputAssetMutation });

  return {
    ...excerpts,
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
    handleImportLibraryFile,
    handleSelectKlingLibraryAsset,
    handleImportKlingLibraryFile,
    handleAssetAdd,
    handleAssetRemove,
    handleKlingElementAdd,
    handleKlingElementRemove,
    handleKlingElementAssetRemove,
    handleKlingElementAssetAdd,
  };
}
