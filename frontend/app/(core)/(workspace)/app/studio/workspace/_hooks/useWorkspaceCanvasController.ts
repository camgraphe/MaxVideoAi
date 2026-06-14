'use client';

import { useCallback, useMemo, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { useWorkspaceCanvasImportActions } from './useWorkspaceCanvasImportActions';
import { useWorkspaceCanvasTemplateActions } from './useWorkspaceCanvasTemplateActions';
import { useWorkspaceCanvasTimelineActions } from './useWorkspaceCanvasTimelineActions';
import { useWorkspaceEditorAssetLibrary } from './useWorkspaceEditorAssetLibrary';
import { useWorkspaceGenerationActions } from './useWorkspaceGenerationActions';
import { useWorkspaceGraphActions } from './useWorkspaceGraphActions';
import { useWorkspaceRenderNodes } from './useWorkspaceRenderNodes';
import type {
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceModelCapability,
  WorkspacePricingEstimate,
  WorkspaceTemplateId,
  WorkspaceTimelineItem,
  WorkspaceTimelineTrack,
} from '../_lib/workspace-types';
import { filterRenderableWorkspaceEdges } from '../_lib/workspace-render-edges';
import { localizeStudioEdgeKindLabel, type StudioCopy } from '../../_lib/studio-copy';
import type {
  CanvasGraphHistorySnapshot,
  CanvasGraphHistoryState,
  WorkspaceEditorSurface,
  WorkspaceFocusMode,
  WorkspaceUserCanvasTemplate,
} from '../_state/workspace-state';

type UseWorkspaceCanvasControllerParams = {
  activeUserCanvasTemplateId: string | null;
  assetPickerNodeId: string | null;
  canvasHistory: CanvasGraphHistoryState;
  capabilities: WorkspaceModelCapability[];
  commitCanvasGraph: (
    updater: (current: CanvasGraphHistorySnapshot) => CanvasGraphHistorySnapshot,
    options?: { gesture?: boolean; history?: boolean }
  ) => void;
  commitTimelineItems: (updater: (current: WorkspaceTimelineItem[]) => WorkspaceTimelineItem[]) => void;
  defaultModelId: string;
  edges: WorkspaceGraphEdge[];
  isProjectMediaPickerOpen: boolean;
  lockedTimelineTracks: WorkspaceTimelineTrack[];
  mockMode: boolean;
  nodes: WorkspaceGraphNode[];
  playheadSec: number;
  pricingEstimates: Record<string, WorkspacePricingEstimate>;
  redoCanvas: () => void;
  selectedNodeId: string | null;
  setActiveEditorSurface: Dispatch<SetStateAction<WorkspaceEditorSurface>>;
  setActiveTemplateId: Dispatch<SetStateAction<WorkspaceTemplateId>>;
  setActiveUserCanvasTemplateId: Dispatch<SetStateAction<string | null>>;
  setAssetPickerNodeId: Dispatch<SetStateAction<string | null>>;
  setCanvasRevision: Dispatch<SetStateAction<number>>;
  setEdges: Dispatch<SetStateAction<WorkspaceGraphEdge[]>>;
  setFocusMode: Dispatch<SetStateAction<WorkspaceFocusMode>>;
  setIsTimelinePlaying: Dispatch<SetStateAction<boolean>>;
  setNodes: Dispatch<SetStateAction<WorkspaceGraphNode[]>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setPlayheadSec: Dispatch<SetStateAction<number>>;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  setSelectedTimelineItemId: Dispatch<SetStateAction<string | null>>;
  setSelectedTimelineItemIds: Dispatch<SetStateAction<string[]>>;
  setUserCanvasTemplates: Dispatch<SetStateAction<WorkspaceUserCanvasTemplate[]>>;
  studioAssetLibraryCopy: StudioCopy['assetLibrary'];
  studioCanvasCopy: StudioCopy['canvas'];
  studioNotices: StudioCopy['notices'];
  timelineInsertIntoClipEnabled: boolean;
  timelineItemsRef: MutableRefObject<WorkspaceTimelineItem[]>;
  undoCanvas: () => void;
  userCanvasTemplates: WorkspaceUserCanvasTemplate[];
};

export function useWorkspaceCanvasController({
  activeUserCanvasTemplateId,
  assetPickerNodeId,
  canvasHistory,
  capabilities,
  commitCanvasGraph,
  commitTimelineItems,
  defaultModelId,
  edges,
  isProjectMediaPickerOpen,
  lockedTimelineTracks,
  mockMode,
  nodes,
  playheadSec,
  pricingEstimates,
  redoCanvas,
  selectedNodeId,
  setActiveEditorSurface,
  setActiveTemplateId,
  setActiveUserCanvasTemplateId,
  setAssetPickerNodeId,
  setCanvasRevision,
  setEdges,
  setFocusMode,
  setIsTimelinePlaying,
  setNodes,
  setNotice,
  setPlayheadSec,
  setSelectedNodeId,
  setSelectedTimelineItemId,
  setSelectedTimelineItemIds,
  setUserCanvasTemplates,
  studioAssetLibraryCopy,
  studioCanvasCopy,
  studioNotices,
  timelineInsertIntoClipEnabled,
  timelineItemsRef,
  undoCanvas,
  userCanvasTemplates,
}: UseWorkspaceCanvasControllerParams) {
  const [canvasAutoCenterNodeId, setCanvasAutoCenterNodeId] = useState<string | null>(null);
  const handleCanvasAutoCenterNodeConsumed = useCallback(() => {
    setCanvasAutoCenterNodeId(null);
  }, []);

  const {
    handleCreateNodeFromHandleDrop,
    handleCreateNodeFromPaletteDrop,
    handleOpenAssetLibrary,
    handleSelectLibraryAsset,
    isValidConnection,
    onConnect,
    onEdgesChange,
    onNodesChange,
    patchNodeData,
    patchShot,
  } = useWorkspaceGraphActions({
    capabilities,
    commitCanvasGraph,
    defaultModelId,
    edges,
    nodes,
    setActiveEditorSurface,
    setAssetPickerNodeId,
    setNotice,
    setSelectedNodeId,
    studioCanvasNodeCopy: studioCanvasCopy.nodes,
    studioNotices,
  });

  const {
    handleCanvasFileDrop,
    handleCanvasTextPaste,
    handleSendProgramSnapshotToCanvas,
  } = useWorkspaceCanvasImportActions({
    commitCanvasGraph,
    defaultModelId,
    nodes,
    setActiveEditorSurface,
    setCanvasAutoCenterNodeId,
    setFocusMode,
    setNotice,
    setSelectedNodeId,
    studioNotices,
  });

  const { handleGenerateShot, handleRunChat } = useWorkspaceGenerationActions({
    capabilities,
    edges,
    mockMode,
    nodes,
    patchShot,
    setActiveEditorSurface,
    setEdges,
    setNodes,
    setNotice,
    setSelectedNodeId,
    studioCanvasNodeCopy: studioCanvasCopy.nodes,
    studioNotices,
  });

  const {
    handleDropNodeToTimeline,
    handleInvalidNodeDropToTimeline,
    handleSendOutputToTimeline,
  } = useWorkspaceCanvasTimelineActions({
    commitTimelineItems,
    lockedTimelineTracks,
    nodes,
    playheadSec,
    setActiveEditorSurface,
    setIsTimelinePlaying,
    setNotice,
    setPlayheadSec,
    setSelectedTimelineItemId,
    setSelectedTimelineItemIds,
    studioCanvasNodeCopy: studioCanvasCopy.nodes,
    studioNotices,
    timelineInsertIntoClipEnabled,
    timelineItemsRef,
  });

  const renderNodes = useWorkspaceRenderNodes({
    capabilities,
    edges,
    nodes,
    pricingEstimates,
    studioCanvasCopy,
    onGenerateShot: handleGenerateShot,
    onOpenAssetLibrary: handleOpenAssetLibrary,
    onPatchNodeData: patchNodeData,
    onPatchShot: patchShot,
    onRunChat: handleRunChat,
    onSendOutputToTimeline: handleSendOutputToTimeline,
  });

  const renderEdges = useMemo(() => {
    return filterRenderableWorkspaceEdges(renderNodes, edges).map((edge) => {
      const edgeData = edge.data;
      if (!edgeData?.kind) return edge;
      const label = localizeStudioEdgeKindLabel(edgeData.kind, studioCanvasCopy.nodes);
      return {
        ...edge,
        label,
        data: {
          ...edgeData,
          label,
        },
      };
    });
  }, [edges, renderNodes, studioCanvasCopy.nodes]);
  const selectedNode = renderNodes.find((node) => node.id === selectedNodeId) ?? null;
  const assetPickerNode = renderNodes.find((node) => node.id === assetPickerNodeId) ?? null;
  const assetPickerLibrary = useWorkspaceEditorAssetLibrary(assetPickerNode ? assetPickerNode.data.kind : undefined, studioAssetLibraryCopy);
  const projectMediaLibrary = useWorkspaceEditorAssetLibrary(isProjectMediaPickerOpen ? null : undefined, studioAssetLibraryCopy);

  const {
    handleAddCanvasTemplate,
    handleApplyCanvasTemplate,
    handleApplyUserCanvasTemplate,
    handleCreateCanvasFromTemplate,
    handleDeleteUserCanvasTemplate,
    handleDuplicateUserCanvasTemplate,
    handleRenameUserCanvasTemplate,
    handleSaveActiveCanvasTemplate,
    handleSaveCanvasTemplate,
  } = useWorkspaceCanvasTemplateActions({
    activeUserCanvasTemplateId,
    commitCanvasGraph,
    edges,
    nodes,
    setActiveEditorSurface,
    setActiveTemplateId,
    setActiveUserCanvasTemplateId,
    setCanvasRevision,
    setNotice,
    setSelectedNodeId,
    setUserCanvasTemplates,
    studioCanvasCopy,
    studioNotices,
    userCanvasTemplates,
  });

  return {
    assetPickerLibrary,
    assetPickerNode,
    canvasAutoCenterNodeId,
    canvasHistory,
    handleAddCanvasTemplate,
    handleApplyCanvasTemplate,
    handleApplyUserCanvasTemplate,
    handleCreateCanvasFromTemplate,
    handleCanvasFileDrop,
    handleCanvasTextPaste,
    handleCanvasAutoCenterNodeConsumed,
    handleCreateNodeFromHandleDrop,
    handleCreateNodeFromPaletteDrop,
    handleDeleteUserCanvasTemplate,
    handleDropNodeToTimeline,
    handleDuplicateUserCanvasTemplate,
    handleGenerateShot,
    handleRunChat,
    handleInvalidNodeDropToTimeline,
    handleOpenAssetLibrary,
    handleRenameUserCanvasTemplate,
    handleSaveActiveCanvasTemplate,
    handleSaveCanvasTemplate,
    handleSelectLibraryAsset,
    handleSendOutputToTimeline,
    handleSendProgramSnapshotToCanvas,
    isValidConnection,
    onConnect,
    onEdgesChange,
    onNodesChange,
    patchNodeData,
    patchShot,
    projectMediaLibrary,
    redoCanvas,
    renderEdges,
    renderNodes,
    selectedNode,
    undoCanvas,
  };
}
