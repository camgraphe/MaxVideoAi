import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
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
import type { WorkspaceEditorSurface } from '../_state/workspace-state';

function createProjectMediaFolderId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `folder-${crypto.randomUUID()}`;
  }
  return `folder-${Date.now().toString(36)}`;
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
  timelineInsertIntoClipEnabled,
  timelineItemsRef,
}: UseWorkspaceProjectMediaActionsParams): {
  handleCreateProjectMediaFolder: () => void;
  handleDeleteGeneratedClip: (nodeId: string) => void;
  handleDeleteProjectAsset: (assetId: string) => void;
  handleDeleteProjectMediaFolder: (folderId: string) => void;
  handleDropProjectAssetToTimeline: (assetId: string, startSec: number, targetTrack: WorkspaceTimelineTrack) => void;
  handleImportProjectMedia: () => void;
  handleInsertProjectAssetToTimeline: (assetId: string) => void;
  handleSelectProjectMediaAsset: (asset: WorkspaceLibraryAsset) => void;
} {
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
      timelineInsertIntoClipEnabled,
      timelineItemsRef,
    ]
  );

  const handleImportProjectMedia = useCallback(() => {
    setIsProjectMediaPickerOpen(true);
    setActiveEditorSurface('timeline');
  }, [setActiveEditorSurface, setIsProjectMediaPickerOpen]);

  const handleSelectProjectMediaAsset = useCallback((asset: WorkspaceLibraryAsset) => {
    const assetRecord = workspaceAssetRecordFromLibraryAsset(asset);
    setProjectAssets((current) => [
      assetRecord,
      ...current.filter((candidate) => candidate.id !== assetRecord.id),
    ].slice(0, 120));
    setIsProjectMediaPickerOpen(false);
    setNotice(`${asset.name} imported into Project media.`);
  }, [setIsProjectMediaPickerOpen, setNotice, setProjectAssets]);

  const handleInsertProjectAssetToTimeline = useCallback((assetId: string) => {
    insertProjectAssetIntoTimeline(assetId, playheadSec);
  }, [insertProjectAssetIntoTimeline, playheadSec]);

  const handleDeleteProjectAsset = useCallback(
    (assetId: string) => {
      const asset = projectAssets.find((candidate) => candidate.id === assetId);
      if (!asset) {
        setNotice('Project media asset not found.');
        return;
      }
      if (typeof window !== 'undefined' && !window.confirm(`Delete "${asset.filename}" from Project media? Timeline clips already placed will stay in the edit.`)) return;
      setProjectAssets((current) => current.filter((candidate) => candidate.id !== assetId));
      setNotice(`${asset.filename} removed from Project media.`);
    },
    [projectAssets, setNotice, setProjectAssets]
  );

  const handleDeleteGeneratedClip = useCallback(
    (nodeId: string) => {
      const node = nodes.find((candidate) => candidate.id === nodeId);
      if (!node?.data.output) {
        setNotice('Generated clip not found.');
        return;
      }
      if (typeof window !== 'undefined' && !window.confirm(`Delete "${node.data.title}" from Project media? Timeline clips already placed will stay in the edit.`)) return;
      setNodes((current) =>
        current.map((candidate) => {
          if (candidate.id !== nodeId) return candidate;
          return {
            ...candidate,
            data: {
              ...candidate.data,
              output: undefined,
              subtitle: candidate.data.subtitle ?? 'Generated output',
            },
          };
        })
      );
      setNotice(`${node.data.title} removed from Project media.`);
    },
    [nodes, setNodes, setNotice]
  );

  const handleCreateProjectMediaFolder = useCallback(() => {
    const fallbackName = `New folder ${projectMediaFolders.length + 1}`;
    const requestedName = typeof window !== 'undefined'
      ? window.prompt('Folder name', fallbackName)
      : fallbackName;
    if (requestedName === null) return;

    const name = requestedName.trim() || fallbackName;
    const timestamp = new Date().toISOString();
    const folder: WorkspaceProjectMediaFolder = {
      id: createProjectMediaFolderId(),
      name,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    setProjectMediaFolders((current) => [folder, ...current].slice(0, 80));
    setNotice(`${name} folder created in Project media.`);
  }, [projectMediaFolders.length, setNotice, setProjectMediaFolders]);

  const handleDeleteProjectMediaFolder = useCallback(
    (folderId: string) => {
      const folder = projectMediaFolders.find((candidate) => candidate.id === folderId);
      if (!folder) {
        setNotice('Project media folder not found.');
        return;
      }
      if (typeof window !== 'undefined' && !window.confirm(`Delete "${folder.name}" from Project media?`)) return;
      setProjectMediaFolders((current) => current.filter((candidate) => candidate.id !== folderId));
      setNotice(`${folder.name} folder deleted from Project media.`);
    },
    [projectMediaFolders, setNotice, setProjectMediaFolders]
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
    handleDeleteProjectAsset,
    handleDeleteProjectMediaFolder,
    handleDropProjectAssetToTimeline,
    handleImportProjectMedia,
    handleInsertProjectAssetToTimeline,
    handleSelectProjectMediaAsset,
  };
}
