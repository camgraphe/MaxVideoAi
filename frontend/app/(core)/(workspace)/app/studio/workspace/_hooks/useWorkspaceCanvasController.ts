'use client';

import { useCallback, useMemo, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { AppLocale } from '@/i18n/locales';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { useWorkspaceCanvasGuideController } from './useWorkspaceCanvasGuideController';
import { useWorkspaceCanvasImportActions } from './useWorkspaceCanvasImportActions';
import { useWorkspaceCanvasTemplateActions } from './useWorkspaceCanvasTemplateActions';
import { useWorkspaceCanvasTimelineActions } from './useWorkspaceCanvasTimelineActions';
import { useWorkspaceEditorAssetLibrary } from './useWorkspaceEditorAssetLibrary';
import { useWorkspaceGenerationActions } from './useWorkspaceGenerationActions';
import { useWorkspaceGraphActions } from './useWorkspaceGraphActions';
import { useWorkspaceRenderNodes } from './useWorkspaceRenderNodes';
import type {
  WorkspaceCanvasGuideState,
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceGuideFocusRequest,
  WorkspaceAssetRecord,
  WorkspaceModelCapability,
  WorkspacePricingEstimate,
  WorkspaceTemplateId,
  WorkspaceTimelineItem,
  WorkspaceTimelineTrack,
} from '../_lib/workspace-types';
import { filterRenderableWorkspaceEdges } from '../_lib/workspace-render-edges';
import { localizeStudioEdgeKindLabel, type StudioCopy } from '../../_lib/studio-copy';
import type {
  CommitCanvasGuideState,
} from './useWorkspaceCanvasHistory';
import type {
  CanvasGraphHistorySnapshot,
  CanvasGraphHistoryState,
  CanvasHistorySnapshot,
  WorkspaceEditorSurface,
  WorkspaceFocusMode,
  WorkspaceUserCanvasTemplate,
} from '../_state/workspace-state';

type UseWorkspaceCanvasControllerParams = {
  activeUserCanvasTemplateId: string | null;
  assetPickerNodeId: string | null;
  canvasHistory: CanvasGraphHistoryState;
  capabilities: WorkspaceModelCapability[];
  commitCanvasGuideState: CommitCanvasGuideState;
  commitCanvasGraph: (
    updater: (current: CanvasGraphHistorySnapshot) => CanvasGraphHistorySnapshot,
    options?: { gesture?: boolean; history?: boolean }
  ) => void;
  commitCanvasState: (
    updater: (current: CanvasHistorySnapshot) => CanvasHistorySnapshot,
    options?: { gesture?: boolean; history?: boolean }
  ) => void;
  commitTimelineItems: (updater: (current: WorkspaceTimelineItem[]) => WorkspaceTimelineItem[]) => void;
  defaultModelId: string;
  edges: WorkspaceGraphEdge[];
  guideFocusRequest: WorkspaceGuideFocusRequest | null;
  guideState: WorkspaceCanvasGuideState;
  isProjectMediaPickerOpen: boolean;
  lockedTimelineTracks: WorkspaceTimelineTrack[];
  mockMode: boolean;
  nodes: WorkspaceGraphNode[];
  onGeneratedProjectAsset: (asset: WorkspaceAssetRecord) => void;
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
  setGuideFocusRequest: Dispatch<SetStateAction<WorkspaceGuideFocusRequest | null>>;
  setGuideState: Dispatch<SetStateAction<WorkspaceCanvasGuideState>>;
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
  commitCanvasGuideState,
  commitCanvasGraph,
  commitCanvasState,
  commitTimelineItems,
  defaultModelId,
  edges,
  guideFocusRequest,
  guideState,
  isProjectMediaPickerOpen,
  lockedTimelineTracks,
  mockMode,
  nodes,
  onGeneratedProjectAsset,
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
  setGuideFocusRequest,
  setGuideState,
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
  const { locale } = useI18n();
  const [canvasAutoCenterNodeId, setCanvasAutoCenterNodeId] = useState<string | null>(null);
  const handleCanvasAutoCenterNodeConsumed = useCallback(() => {
    setCanvasAutoCenterNodeId(null);
  }, []);

  const guide = useWorkspaceCanvasGuideController({
    activeCanvasId: activeUserCanvasTemplateId ?? 'starter',
    commitCanvasGuideState,
    guideState,
    locale: locale as AppLocale,
    nodes,
    setGuideFocusRequest,
    setGuideState,
    timelineItems: timelineItemsRef.current,
  });

  const {
    handleCreateNodeFromHandleDrop,
    handleCreateNodeFromPaletteDrop,
    handleCopySelectedNodes,
    handleOpenAssetLibrary,
    handlePasteCanvasClipboard,
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
    pricingEstimates,
    onGeneratedProjectAsset,
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
    mockMode,
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
    commitCanvasState,
    edges,
    guideState,
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
    guide: {
      state: guideState,
      focusRequest: guideFocusRequest,
      ...guide,
    },
    handleAddCanvasTemplate,
    handleApplyCanvasTemplate,
    handleApplyUserCanvasTemplate,
    handleCreateCanvasFromTemplate,
    handleCanvasFileDrop,
    handleCanvasTextPaste,
    handleCanvasAutoCenterNodeConsumed,
    handleCreateNodeFromHandleDrop,
    handleCreateNodeFromPaletteDrop,
    handleCopySelectedNodes,
    handleDeleteUserCanvasTemplate,
    handleDropNodeToTimeline,
    handleDuplicateUserCanvasTemplate,
    handleGenerateShot,
    handleRunChat,
    handleInvalidNodeDropToTimeline,
    handleOpenAssetLibrary,
    handlePasteCanvasClipboard,
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
