import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { KlingElementState } from '@/components/KlingElementsBuilder';
import type { ReferenceAsset } from '../_lib/workspace-assets';
import { useWorkspaceAssetLibrary } from './useWorkspaceAssetLibrary';
import { useWorkspaceKlingElementAssets } from './useWorkspaceKlingElementAssets';
import { useWorkspaceReferenceAssets } from './useWorkspaceReferenceAssets';

type UseWorkspaceAssetsOptions = {
  engineId?: string | null;
  workflowCopy: {
    clearReferencesToUseStartEnd: string;
    clearStartEndToUseReferences: string;
  };
  showNotice: (message: string) => void;
  klingElements: KlingElementState[];
  setKlingElements: Dispatch<SetStateAction<KlingElementState[]>>;
};

export function useWorkspaceAssets({
  engineId,
  workflowCopy,
  showNotice,
  klingElements,
  setKlingElements,
}: UseWorkspaceAssetsOptions) {
  const [inputAssets, setInputAssets] = useState<Record<string, (ReferenceAsset | null)[]>>({});

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
    workflowCopy,
    showNotice,
    inputAssets,
    setInputAssets,
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
