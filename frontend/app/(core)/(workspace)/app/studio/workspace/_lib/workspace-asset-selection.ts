export type WorkspaceAssetSelection = {
  selectedAssetIds: string[];
  selectionAnchorId: string | null;
};

export type WorkspaceAssetSelectionMode = 'replace' | 'toggle' | 'range';

export function resetWorkspaceAssetSelection(): WorkspaceAssetSelection {
  return {
    selectedAssetIds: [],
    selectionAnchorId: null,
  };
}

export function selectWorkspaceAsset({
  assetIds,
  selection,
  assetId,
  mode,
}: {
  assetIds: readonly string[];
  selection: WorkspaceAssetSelection;
  assetId: string;
  mode: WorkspaceAssetSelectionMode;
}): WorkspaceAssetSelection {
  if (mode === 'replace') {
    return {
      selectedAssetIds: [assetId],
      selectionAnchorId: assetId,
    };
  }

  if (mode === 'toggle') {
    return {
      selectedAssetIds: selection.selectedAssetIds.includes(assetId)
        ? selection.selectedAssetIds.filter((currentAssetId) => currentAssetId !== assetId)
        : [...selection.selectedAssetIds, assetId],
      selectionAnchorId: assetId,
    };
  }

  const anchorIndex = selection.selectionAnchorId ? assetIds.indexOf(selection.selectionAnchorId) : -1;
  const targetIndex = assetIds.indexOf(assetId);
  if (anchorIndex === -1 || targetIndex === -1) {
    return {
      selectedAssetIds: [assetId],
      selectionAnchorId: assetId,
    };
  }
  const [start, end] = anchorIndex < targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
  return {
    selectedAssetIds: Array.from(new Set([...selection.selectedAssetIds, ...assetIds.slice(start, end + 1)])),
    selectionAnchorId: assetId,
  };
}
