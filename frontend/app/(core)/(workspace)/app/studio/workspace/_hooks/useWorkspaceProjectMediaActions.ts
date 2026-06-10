import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { resolveProjectAssetTimelineInsert } from '../_lib/workspace-project-media-timeline';
import type {
  WorkspaceAssetRecord,
  WorkspaceGraphNode,
  WorkspaceTimelineItem,
  WorkspaceTimelineTrack,
} from '../_lib/workspace-types';
import type { WorkspaceEditorSurface } from '../_state/workspace-state';

type UseWorkspaceProjectMediaActionsParams = {
  commitTimelineItems: (updater: (current: WorkspaceTimelineItem[]) => WorkspaceTimelineItem[]) => void;
  lockedTimelineTracks: WorkspaceTimelineTrack[];
  nodes: WorkspaceGraphNode[];
  playheadSec: number;
  projectAssets: WorkspaceAssetRecord[];
  setActiveEditorSurface: Dispatch<SetStateAction<WorkspaceEditorSurface>>;
  setIsProjectMediaPickerOpen: Dispatch<SetStateAction<boolean>>;
  setIsTimelinePlaying: Dispatch<SetStateAction<boolean>>;
  setNodes: Dispatch<SetStateAction<WorkspaceGraphNode[]>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setPlayheadSec: Dispatch<SetStateAction<number>>;
  setProjectAssets: Dispatch<SetStateAction<WorkspaceAssetRecord[]>>;
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
  setActiveEditorSurface,
  setIsProjectMediaPickerOpen,
  setIsTimelinePlaying,
  setNodes,
  setNotice,
  setPlayheadSec,
  setProjectAssets,
  setSelectedTimelineItemId,
  setSelectedTimelineItemIds,
  timelineInsertIntoClipEnabled,
  timelineItemsRef,
}: UseWorkspaceProjectMediaActionsParams): {
  handleCreateProjectMediaFolder: () => void;
  handleDeleteGeneratedClip: (nodeId: string) => void;
  handleDeleteProjectAsset: (assetId: string) => void;
  handleDropProjectAssetToTimeline: (assetId: string, startSec: number, targetTrack: WorkspaceTimelineTrack) => void;
  handleImportProjectMedia: () => void;
  handleInsertProjectAssetToTimeline: (assetId: string) => void;
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
    setNotice('Project media folders are ready in the UI. Backend folder persistence will be wired in the media library pass.');
  }, [setNotice]);

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
    handleDropProjectAssetToTimeline,
    handleImportProjectMedia,
    handleInsertProjectAssetToTimeline,
  };
}
