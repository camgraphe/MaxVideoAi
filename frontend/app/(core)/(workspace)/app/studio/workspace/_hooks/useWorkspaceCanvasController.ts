'use client';

import { useMemo, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
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
import type { StudioCopy } from '../../_lib/studio-copy';
import type {
  WorkspaceEditorSurface,
  WorkspaceFocusMode,
  WorkspaceUserCanvasTemplate,
} from '../_state/workspace-state';

type UseWorkspaceCanvasControllerParams = {
  activeUserCanvasTemplateId: string | null;
  assetPickerNodeId: string | null;
  capabilities: WorkspaceModelCapability[];
  commitTimelineItems: (updater: (current: WorkspaceTimelineItem[]) => WorkspaceTimelineItem[]) => void;
  defaultModelId: string;
  edges: WorkspaceGraphEdge[];
  isProjectMediaPickerOpen: boolean;
  lockedTimelineTracks: WorkspaceTimelineTrack[];
  mockMode: boolean;
  nodes: WorkspaceGraphNode[];
  playheadSec: number;
  pricingEstimates: Record<string, WorkspacePricingEstimate>;
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
  studioNotices: StudioCopy['notices'];
  timelineInsertIntoClipEnabled: boolean;
  timelineItemsRef: MutableRefObject<WorkspaceTimelineItem[]>;
  userCanvasTemplates: WorkspaceUserCanvasTemplate[];
};

export function useWorkspaceCanvasController({
  activeUserCanvasTemplateId,
  assetPickerNodeId,
  capabilities,
  commitTimelineItems,
  defaultModelId,
  edges,
  isProjectMediaPickerOpen,
  lockedTimelineTracks,
  mockMode,
  nodes,
  playheadSec,
  pricingEstimates,
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
  studioNotices,
  timelineInsertIntoClipEnabled,
  timelineItemsRef,
  userCanvasTemplates,
}: UseWorkspaceCanvasControllerParams) {
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
    defaultModelId,
    edges,
    nodes,
    setActiveEditorSurface,
    setAssetPickerNodeId,
    setEdges,
    setNodes,
    setNotice,
    setSelectedNodeId,
  });

  const {
    handleCanvasFileDrop,
    handleCanvasTextPaste,
    handleSendProgramSnapshotToCanvas,
  } = useWorkspaceCanvasImportActions({
    defaultModelId,
    nodes,
    patchNodeData,
    setActiveEditorSurface,
    setFocusMode,
    setNodes,
    setNotice,
    setSelectedNodeId,
  });

  const { handleGenerateShot } = useWorkspaceGenerationActions({
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
    timelineInsertIntoClipEnabled,
    timelineItemsRef,
  });

  const renderNodes = useWorkspaceRenderNodes({
    capabilities,
    edges,
    nodes,
    pricingEstimates,
    onGenerateShot: handleGenerateShot,
    onOpenAssetLibrary: handleOpenAssetLibrary,
    onPatchNodeData: patchNodeData,
    onSendOutputToTimeline: handleSendOutputToTimeline,
  });

  const renderEdges = useMemo(() => filterRenderableWorkspaceEdges(renderNodes, edges), [edges, renderNodes]);
  const selectedNode = renderNodes.find((node) => node.id === selectedNodeId) ?? null;
  const assetPickerNode = renderNodes.find((node) => node.id === assetPickerNodeId) ?? null;
  const assetPickerLibrary = useWorkspaceEditorAssetLibrary(assetPickerNode ? assetPickerNode.data.kind : undefined);
  const projectMediaLibrary = useWorkspaceEditorAssetLibrary(isProjectMediaPickerOpen ? null : undefined);

  const {
    handleApplyCanvasTemplate,
    handleApplyUserCanvasTemplate,
    handleDeleteUserCanvasTemplate,
    handleDuplicateUserCanvasTemplate,
    handleSaveCanvasTemplate,
  } = useWorkspaceCanvasTemplateActions({
    activeUserCanvasTemplateId,
    edges,
    nodes,
    setActiveEditorSurface,
    setActiveTemplateId,
    setActiveUserCanvasTemplateId,
    setCanvasRevision,
    setEdges,
    setNodes,
    setNotice,
    setSelectedNodeId,
    setUserCanvasTemplates,
    studioNotices,
    userCanvasTemplates,
  });

  return {
    assetPickerLibrary,
    assetPickerNode,
    handleApplyCanvasTemplate,
    handleApplyUserCanvasTemplate,
    handleCanvasFileDrop,
    handleCanvasTextPaste,
    handleCreateNodeFromHandleDrop,
    handleCreateNodeFromPaletteDrop,
    handleDeleteUserCanvasTemplate,
    handleDropNodeToTimeline,
    handleDuplicateUserCanvasTemplate,
    handleGenerateShot,
    handleInvalidNodeDropToTimeline,
    handleOpenAssetLibrary,
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
    renderEdges,
    renderNodes,
    selectedNode,
  };
}
