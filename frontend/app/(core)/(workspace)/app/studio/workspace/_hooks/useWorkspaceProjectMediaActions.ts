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
import type { WorkspaceEditorSurface } from '../_state/workspace-state';
import type { StudioCopy } from '../../_lib/studio-copy';

function createProjectMediaFolderId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `folder-${crypto.randomUUID()}`;
  }
  return `folder-${Date.now().toString(36)}`;
}

function formatNotice(value: string, replacements: Record<string, string | number>): string {
  return Object.entries(replacements).reduce(
    (current, [key, replacement]) => current.replaceAll(`{${key}}`, String(replacement)),
    value
  );
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
  studioNotices,
  timelineInsertIntoClipEnabled,
  timelineItemsRef,
}: UseWorkspaceProjectMediaActionsParams): {
  handleCreateProjectMediaFolder: (requestedName?: string) => void;
  handleDeleteGeneratedClip: (nodeId: string) => void;
  handleDeleteProjectAsset: (assetId: string) => void;
  handleDeleteProjectMediaFolder: (folderId: string) => void;
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
      ? projectMediaFolders.find((folder) => folder.id === folderId)?.name ?? studioNotices.projectMediaFallbackFolder
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

  const handleDeleteGeneratedClip = useCallback(
    (nodeId: string) => {
      const node = nodes.find((candidate) => candidate.id === nodeId);
      if (!node?.data.output) {
        setNotice(studioNotices.generatedClipNotFound);
        return;
      }
      if (
        typeof window !== 'undefined' &&
        !window.confirm(formatNotice(studioNotices.deleteGeneratedClipConfirm, { title: node.data.title }))
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
      setNotice(formatNotice(studioNotices.generatedClipRemoved, { title: node.data.title }));
    },
    [nodes, setNodes, setNotice, studioNotices]
  );

  const handleCreateProjectMediaFolder = useCallback((requestedName?: string) => {
    const fallbackName = formatNotice(studioNotices.newProjectMediaFolderName, {
      index: projectMediaFolders.length + 1,
    });
    const name = requestedName?.trim() || fallbackName;
    const timestamp = new Date().toISOString();
    const folder: WorkspaceProjectMediaFolder = {
      id: createProjectMediaFolderId(),
      name,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    setProjectMediaFolders((current) => [folder, ...current].slice(0, 80));
    setNotice(formatNotice(studioNotices.projectMediaFolderCreated, { name }));
  }, [projectMediaFolders.length, setNotice, setProjectMediaFolders, studioNotices]);

  const handleDeleteProjectMediaFolder = useCallback(
    (folderId: string) => {
      const folder = projectMediaFolders.find((candidate) => candidate.id === folderId);
      if (!folder) {
        setNotice(studioNotices.projectMediaFolderNotFound);
        return;
      }
      if (
        typeof window !== 'undefined' &&
        !window.confirm(formatNotice(studioNotices.deleteProjectMediaFolderConfirm, { name: folder.name }))
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
      setNotice(formatNotice(studioNotices.projectMediaFolderDeleted, { name: folder.name }));
    },
    [projectMediaFolders, setNodes, setNotice, setProjectAssets, setProjectMediaFolders, studioNotices]
  );

  const handleRenameProjectMediaFolder = useCallback(
    (folderId: string, requestedName: string) => {
      const folder = projectMediaFolders.find((candidate) => candidate.id === folderId);
      if (!folder) {
        setNotice(studioNotices.projectMediaFolderNotFound);
        return;
      }
      const name = requestedName.trim();
      if (!name || name === folder.name) return;
      setProjectMediaFolders((current) => current.map((candidate) => (
        candidate.id === folderId
          ? { ...candidate, name, updatedAt: new Date().toISOString() }
          : candidate
      )));
      setNotice(formatNotice(studioNotices.projectMediaFolderRenamed, {
        oldName: folder.name,
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
        ? projectMediaFolders.find((folder) => folder.id === folderId)?.name ?? studioNotices.projectMediaFallbackFolder
        : studioNotices.projectMediaRoot;
      setProjectAssets((current) => current.map((candidate) => (
        candidate.id === assetId ? { ...candidate, folderId } : candidate
      )));
      setNotice(formatNotice(studioNotices.projectAssetMovedToFolder, {
        filename: asset.filename,
        folder: folderName,
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
        ? projectMediaFolders.find((folder) => folder.id === folderId)?.name ?? studioNotices.projectMediaFallbackFolder
        : studioNotices.projectMediaRoot;
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
        title: node.data.title,
        folder: folderName,
      }));
    },
    [nodes, projectMediaFolders, setNodes, setNotice, studioNotices]
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
    handleMoveGeneratedClipToFolder,
    handleMoveProjectAssetToFolder,
    handleRenameProjectMediaFolder,
    handleSelectProjectMediaAsset,
  };
}
