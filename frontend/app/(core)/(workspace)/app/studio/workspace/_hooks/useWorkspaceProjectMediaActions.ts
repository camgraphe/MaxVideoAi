import { useCallback, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  workspaceAssetRecordFromLibraryAsset,
  type WorkspaceLibraryAsset,
} from '../_lib/workspace-library-assets';
import { resolveProjectAssetTimelineInsert } from '../_lib/workspace-project-media-timeline';
import type {
  WorkspaceAssetRecord,
  WorkspaceGraphNode,
  WorkspaceProjectMediaFolder,
  WorkspaceTimelineItem,
  WorkspaceTimelineTrack,
} from '../_lib/workspace-types';
import { localizeWorkspaceNodeTitle } from '../_lib/workspace-generated-copy';
import {
  WORKSPACE_PROJECT_MEDIA_FOLDER_ID_PREFIX,
  type WorkspaceEditorSurface,
} from '../_state/workspace-state';
import {
  STUDIO_PROJECT_MEDIA_FOLDER_TOKEN,
  formatStudioCountLabel,
  type StudioCopy,
} from '../../_lib/studio-copy';

function createProjectMediaFolderId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${WORKSPACE_PROJECT_MEDIA_FOLDER_ID_PREFIX}${crypto.randomUUID()}`;
  }
  return `${WORKSPACE_PROJECT_MEDIA_FOLDER_ID_PREFIX}${Date.now().toString(36)}`;
}

function formatNotice(value: string, replacements: Record<string, string | number>): string {
  return Object.entries(replacements).reduce(
    (current, [key, replacement]) => current.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

export function generatedClipProjectMediaTitle(
  node: WorkspaceGraphNode,
  studioCanvasNodeCopy: StudioCopy['canvas']['nodes']
): string {
  return localizeWorkspaceNodeTitle(node, studioCanvasNodeCopy);
}

type UseWorkspaceProjectMediaActionsParams = {
  commitTimelineItems: (updater: (current: WorkspaceTimelineItem[]) => WorkspaceTimelineItem[]) => void;
  lockedTimelineTracks: WorkspaceTimelineTrack[];
  nodes: WorkspaceGraphNode[];
  playheadSec: number;
  projectAssets: WorkspaceAssetRecord[];
  projectMediaFolders: WorkspaceProjectMediaFolder[];
  setActiveEditorSurface: Dispatch<SetStateAction<WorkspaceEditorSurface>>;
  setIsProjectMediaPickerOpen: Dispatch<SetStateAction<boolean>>;
  setIsTimelinePlaying: Dispatch<SetStateAction<boolean>>;
  setNodes: Dispatch<SetStateAction<WorkspaceGraphNode[]>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setPlayheadSec: Dispatch<SetStateAction<number>>;
  setProjectAssets: Dispatch<SetStateAction<WorkspaceAssetRecord[]>>;
  setProjectMediaFolders: Dispatch<SetStateAction<WorkspaceProjectMediaFolder[]>>;
  setSelectedTimelineItemId: Dispatch<SetStateAction<string | null>>;
  setSelectedTimelineItemIds: Dispatch<SetStateAction<string[]>>;
  studioCommonCopy: StudioCopy['common'];
  studioCanvasNodeCopy: StudioCopy['canvas']['nodes'];
  studioNotices: StudioCopy['notices'];
  timelineInsertIntoClipEnabled: boolean;
  timelineItemsRef: MutableRefObject<WorkspaceTimelineItem[]>;
};

export function useWorkspaceProjectMediaActions({
  commitTimelineItems,
  lockedTimelineTracks,
  nodes,
  playheadSec,
  projectAssets,
  projectMediaFolders,
  setActiveEditorSurface,
  setIsProjectMediaPickerOpen,
  setIsTimelinePlaying,
  setNodes,
  setNotice,
  setPlayheadSec,
  setProjectAssets,
  setProjectMediaFolders,
  setSelectedTimelineItemId,
  setSelectedTimelineItemIds,
  studioCommonCopy,
  studioCanvasNodeCopy,
  studioNotices,
  timelineInsertIntoClipEnabled,
  timelineItemsRef,
}: UseWorkspaceProjectMediaActionsParams): {
  handleCreateProjectMediaFolder: (requestedName?: string) => void;
  handleDeleteGeneratedClip: (nodeId: string) => void;
  handleDeleteGeneratedClips: (nodeIds: string[]) => void;
  handleDeleteProjectAsset: (assetId: string) => void;
  handleDeleteProjectAssets: (assetIds: string[]) => void;
  handleDeleteProjectMediaFolder: (folderId: string) => void;
  handleDeleteProjectMediaFolders: (folderIds: string[]) => void;
  handleDropProjectAssetToTimeline: (assetId: string, startSec: number, targetTrack: WorkspaceTimelineTrack) => void;
  handleImportProjectMedia: (folderId?: string | null) => void;
  handleInsertProjectAssetToTimeline: (assetId: string) => void;
  handleMoveGeneratedClipToFolder: (nodeId: string, folderId: string | null) => void;
  handleMoveProjectAssetToFolder: (assetId: string, folderId: string | null) => void;
  handleRenameProjectMediaFolder: (folderId: string, requestedName: string) => void;
  handleSelectProjectMediaAsset: (asset: WorkspaceLibraryAsset) => void;
} {
  const pendingImportFolderIdRef = useRef<string | null>(null);

  const insertProjectAssetIntoTimeline = useCallback(
    (assetId: string, startSec: number, targetTrack?: WorkspaceTimelineTrack) => {
      const timelineSeed = Date.now().toString(36);
      const result = resolveProjectAssetTimelineInsert({
        assetId,
        projectAssets,
        currentItems: timelineItemsRef.current,
        startSec,
        targetTrack,
        lockedTimelineTracks,
        allowInsertIntoClip: timelineInsertIntoClipEnabled,
        idSeed: timelineSeed,
        canvasNodeCopy: studioCanvasNodeCopy,
        notices: studioNotices,
      });
      if (!result.ok) {
        setNotice(result.notice);
        return;
      }

      commitTimelineItems(() => result.items);
      setActiveEditorSurface('timeline');
      setSelectedTimelineItemId(result.selectedItemId);
      setSelectedTimelineItemIds([result.selectedItemId]);
      setPlayheadSec(result.playheadSec);
      setIsTimelinePlaying(false);
      setNotice(result.notice);
    },
    [
      commitTimelineItems,
      lockedTimelineTracks,
      projectAssets,
      setActiveEditorSurface,
      setIsTimelinePlaying,
      setNotice,
      setPlayheadSec,
      setSelectedTimelineItemId,
      setSelectedTimelineItemIds,
      studioCanvasNodeCopy,
      studioNotices,
      timelineInsertIntoClipEnabled,
      timelineItemsRef,
    ]
  );

  const handleImportProjectMedia = useCallback((folderId?: string | null) => {
    pendingImportFolderIdRef.current = folderId ?? null;
    setIsProjectMediaPickerOpen(true);
    setActiveEditorSurface('timeline');
  }, [setActiveEditorSurface, setIsProjectMediaPickerOpen]);

  const handleSelectProjectMediaAsset = useCallback((asset: WorkspaceLibraryAsset) => {
    const folderId = pendingImportFolderIdRef.current;
    const assetRecord = {
      ...workspaceAssetRecordFromLibraryAsset(asset),
      folderId,
    };
    setProjectAssets((current) => [
      assetRecord,
      ...current.filter((candidate) => candidate.id !== assetRecord.id),
    ].slice(0, 120));
    pendingImportFolderIdRef.current = null;
    setIsProjectMediaPickerOpen(false);
    const folderName = folderId
      ? projectMediaFolders.find((candidateFolder) => candidateFolder.id === folderId)?.name ?? studioNotices.projectMediaFallbackFolder
      : studioNotices.projectMediaRoot;
    setNotice(formatNotice(studioNotices.projectMediaImportedInto, {
      filename: asset.name,
      target: folderName,
    }));
  }, [projectMediaFolders, setIsProjectMediaPickerOpen, setNotice, setProjectAssets, studioNotices]);

  const handleInsertProjectAssetToTimeline = useCallback((assetId: string) => {
    insertProjectAssetIntoTimeline(assetId, playheadSec);
  }, [insertProjectAssetIntoTimeline, playheadSec]);

  const handleDeleteProjectAsset = useCallback(
    (assetId: string) => {
      const asset = projectAssets.find((candidate) => candidate.id === assetId);
      if (!asset) {
        setNotice(studioNotices.projectMediaAssetNotFound);
        return;
      }
      if (
        typeof window !== 'undefined' &&
        !window.confirm(formatNotice(studioNotices.deleteProjectAssetConfirm, { filename: asset.filename }))
      ) return;
      setProjectAssets((current) => current.filter((candidate) => candidate.id !== assetId));
      setNotice(formatNotice(studioNotices.projectAssetRemoved, { filename: asset.filename }));
    },
    [projectAssets, setNotice, setProjectAssets, studioNotices]
  );

  const handleDeleteProjectAssets = useCallback(
    (assetIds: string[]) => {
      const assetIdSet = new Set(assetIds);
      const assetsToDelete = projectAssets.filter((candidate) => assetIdSet.has(candidate.id));
      if (!assetsToDelete.length) {
        setNotice(studioNotices.projectMediaAssetNotFound);
        return;
      }
      const label = assetsToDelete.length === 1
        ? assetsToDelete[0].filename
        : formatStudioCountLabel(
            assetsToDelete.length,
            studioCommonCopy.mediaAssetSingular,
            studioCommonCopy.mediaAssetPlural
          );
      if (
        typeof window !== 'undefined' &&
        !window.confirm(formatNotice(studioNotices.deleteProjectAssetConfirm, { filename: label }))
      ) return;
      setProjectAssets((current) => current.filter((candidate) => !assetIdSet.has(candidate.id)));
      setNotice(formatNotice(studioNotices.projectAssetRemoved, { filename: label }));
    },
    [projectAssets, setNotice, setProjectAssets, studioCommonCopy, studioNotices]
  );

  const handleDeleteGeneratedClip = useCallback(
    (nodeId: string) => {
      const node = nodes.find((candidate) => candidate.id === nodeId);
      if (!node?.data.output) {
        setNotice(studioNotices.generatedClipNotFound);
        return;
      }
      if (
        typeof window !== 'undefined' &&
        !window.confirm(formatNotice(studioNotices.deleteGeneratedClipConfirm, { title: generatedClipProjectMediaTitle(node, studioCanvasNodeCopy) }))
      ) return;
      setNodes((current) =>
        current.map((candidate) => {
          if (candidate.id !== nodeId) return candidate;
          return {
            ...candidate,
            data: {
              ...candidate.data,
              output: undefined,
              subtitle: candidate.data.subtitle ?? studioNotices.generatedOutputSubtitle,
            },
          };
        })
      );
      setNotice(formatNotice(studioNotices.generatedClipRemoved, { title: generatedClipProjectMediaTitle(node, studioCanvasNodeCopy) }));
    },
    [nodes, setNodes, setNotice, studioCanvasNodeCopy, studioNotices]
  );

  const handleDeleteGeneratedClips = useCallback(
    (nodeIds: string[]) => {
      const nodeIdSet = new Set(nodeIds);
      const nodesToDelete = nodes.filter((candidate) => nodeIdSet.has(candidate.id) && candidate.data.output);
      if (!nodesToDelete.length) {
        setNotice(studioNotices.generatedClipNotFound);
        return;
      }
      const label = nodesToDelete.length === 1
        ? generatedClipProjectMediaTitle(nodesToDelete[0], studioCanvasNodeCopy)
        : formatStudioCountLabel(
            nodesToDelete.length,
            studioCommonCopy.generatedClipSingular,
            studioCommonCopy.generatedClipPlural
          );
      if (
        typeof window !== 'undefined' &&
        !window.confirm(formatNotice(studioNotices.deleteGeneratedClipConfirm, { title: label }))
      ) return;
      setNodes((current) =>
        current.map((candidate) => {
          if (!nodeIdSet.has(candidate.id) || !candidate.data.output) return candidate;
          return {
            ...candidate,
            data: {
              ...candidate.data,
              output: undefined,
              subtitle: candidate.data.subtitle ?? studioNotices.generatedOutputSubtitle,
            },
          };
        })
      );
      setNotice(formatNotice(studioNotices.generatedClipRemoved, { title: label }));
    },
    [nodes, setNodes, setNotice, studioCanvasNodeCopy, studioCommonCopy, studioNotices]
  );

  const handleCreateProjectMediaFolder = useCallback((requestedName?: string) => {
    const fallbackName = formatNotice(studioNotices.newProjectMediaFolderName, {
      index: projectMediaFolders.length + 1,
    });
    const name = requestedName?.trim() || fallbackName;
    const timestamp = new Date().toISOString();
    const mediaBin: WorkspaceProjectMediaFolder = {
      id: createProjectMediaFolderId(),
      name,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    setProjectMediaFolders((current) => [mediaBin, ...current].slice(0, 80));
    setNotice(formatNotice(studioNotices.projectMediaFolderCreated, { name }));
  }, [projectMediaFolders.length, setNotice, setProjectMediaFolders, studioNotices]);

  const handleDeleteProjectMediaFolder = useCallback(
    (folderId: string) => {
      const mediaBin = projectMediaFolders.find((candidate) => candidate.id === folderId);
      if (!mediaBin) {
        setNotice(studioNotices.projectMediaFolderNotFound);
        return;
      }
      if (
        typeof window !== 'undefined' &&
        !window.confirm(formatNotice(studioNotices.deleteProjectMediaFolderConfirm, { name: mediaBin.name }))
      ) return;
      setProjectMediaFolders((current) => current.filter((candidate) => candidate.id !== folderId));
      setProjectAssets((current) => current.map((asset) => asset.folderId === folderId ? { ...asset, folderId: null } : asset));
      setNodes((current) => current.map((node) => {
        if (node.data.kind !== 'output' || node.data.output?.projectMediaFolderId !== folderId) return node;
        return {
          ...node,
          data: {
            ...node.data,
            output: {
              ...node.data.output,
              projectMediaFolderId: null,
            },
          },
        };
      }));
      setNotice(formatNotice(studioNotices.projectMediaFolderDeleted, { name: mediaBin.name }));
    },
    [projectMediaFolders, setNodes, setNotice, setProjectAssets, setProjectMediaFolders, studioNotices]
  );

  const handleDeleteProjectMediaFolders = useCallback(
    (folderIds: string[]) => {
      const folderIdSet = new Set(folderIds);
      const foldersToDelete = projectMediaFolders.filter((candidate) => folderIdSet.has(candidate.id));
      if (!foldersToDelete.length) {
        setNotice(studioNotices.projectMediaFolderNotFound);
        return;
      }
      const label = foldersToDelete.length === 1
        ? foldersToDelete[0].name
        : formatStudioCountLabel(
            foldersToDelete.length,
            studioCommonCopy.folderSingular,
            studioCommonCopy.folderPlural
          );
      if (
        typeof window !== 'undefined' &&
        !window.confirm(formatNotice(studioNotices.deleteProjectMediaFolderConfirm, { name: label }))
      ) return;
      setProjectMediaFolders((current) => current.filter((candidate) => !folderIdSet.has(candidate.id)));
      setProjectAssets((current) => current.map((asset) => folderIdSet.has(asset.folderId ?? '') ? { ...asset, folderId: null } : asset));
      setNodes((current) => current.map((node) => {
        if (node.data.kind !== 'output' || !folderIdSet.has(node.data.output?.projectMediaFolderId ?? '')) return node;
        return {
          ...node,
          data: {
            ...node.data,
            output: node.data.output
              ? {
                  ...node.data.output,
                  projectMediaFolderId: null,
                }
              : node.data.output,
          },
        };
      }));
      setNotice(formatNotice(studioNotices.projectMediaFolderDeleted, { name: label }));
    },
    [projectMediaFolders, setNodes, setNotice, setProjectAssets, setProjectMediaFolders, studioCommonCopy, studioNotices]
  );

  const handleRenameProjectMediaFolder = useCallback(
    (folderId: string, requestedName: string) => {
      const mediaBin = projectMediaFolders.find((candidate) => candidate.id === folderId);
      if (!mediaBin) {
        setNotice(studioNotices.projectMediaFolderNotFound);
        return;
      }
      const name = requestedName.trim();
      if (!name || name === mediaBin.name) return;
      setProjectMediaFolders((current) => current.map((candidate) => (
        candidate.id === folderId
          ? { ...candidate, name, updatedAt: new Date().toISOString() }
          : candidate
      )));
      setNotice(formatNotice(studioNotices.projectMediaFolderRenamed, {
        oldName: mediaBin.name,
        newName: name,
      }));
    },
    [projectMediaFolders, setNotice, setProjectMediaFolders, studioNotices]
  );

  const handleMoveProjectAssetToFolder = useCallback(
    (assetId: string, folderId: string | null) => {
      const asset = projectAssets.find((candidate) => candidate.id === assetId);
      if (!asset) {
        setNotice(studioNotices.projectMediaAssetNotFound);
        return;
      }
      const folderName = folderId
        ? projectMediaFolders.find((candidateFolder) => candidateFolder.id === folderId)?.name ?? studioNotices.projectMediaFallbackFolder
        : studioNotices.projectMediaRoot;
      setProjectAssets((current) => current.map((candidate) => (
        candidate.id === assetId ? { ...candidate, folderId } : candidate
      )));
      setNotice(formatNotice(studioNotices.projectAssetMovedToFolder, {
        filename: asset.filename,
        [STUDIO_PROJECT_MEDIA_FOLDER_TOKEN]: folderName,
      }));
    },
    [projectAssets, projectMediaFolders, setNotice, setProjectAssets, studioNotices]
  );

  const handleMoveGeneratedClipToFolder = useCallback(
    (nodeId: string, folderId: string | null) => {
      const node = nodes.find((candidate) => candidate.id === nodeId);
      if (!node?.data.output) {
        setNotice(studioNotices.generatedClipNotFound);
        return;
      }
      const folderName = folderId
        ? projectMediaFolders.find((candidateFolder) => candidateFolder.id === folderId)?.name ?? studioNotices.projectMediaFallbackFolder
        : studioNotices.projectMediaRoot;
      const title = generatedClipProjectMediaTitle(node, studioCanvasNodeCopy);
      setNodes((current) => current.map((candidate) => {
        if (candidate.id !== nodeId || !candidate.data.output) return candidate;
        return {
          ...candidate,
          data: {
            ...candidate.data,
            output: {
              ...candidate.data.output,
              projectMediaFolderId: folderId,
            },
          },
        };
      }));
      setNotice(formatNotice(studioNotices.generatedClipMovedToFolder, {
        title,
        [STUDIO_PROJECT_MEDIA_FOLDER_TOKEN]: folderName,
      }));
    },
    [nodes, projectMediaFolders, setNodes, setNotice, studioCanvasNodeCopy, studioNotices]
  );

  const handleDropProjectAssetToTimeline = useCallback(
    (assetId: string, startSec: number, targetTrack: WorkspaceTimelineTrack) => {
      setActiveEditorSurface('timeline');
      insertProjectAssetIntoTimeline(assetId, startSec, targetTrack);
    },
    [insertProjectAssetIntoTimeline, setActiveEditorSurface]
  );

  return {
    handleCreateProjectMediaFolder,
    handleDeleteGeneratedClip,
    handleDeleteGeneratedClips,
    handleDeleteProjectAsset,
    handleDeleteProjectAssets,
    handleDeleteProjectMediaFolder,
    handleDeleteProjectMediaFolders,
    handleDropProjectAssetToTimeline,
    handleImportProjectMedia,
    handleInsertProjectAssetToTimeline,
    handleMoveGeneratedClipToFolder,
    handleMoveProjectAssetToFolder,
    handleRenameProjectMediaFolder,
    handleSelectProjectMediaAsset,
  };
}
