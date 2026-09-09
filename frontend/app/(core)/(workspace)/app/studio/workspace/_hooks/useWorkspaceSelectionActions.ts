import { useCallback, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  defaultTimelineSelectionIds,
  uniqueTimelineSelectionIds,
} from '../_lib/workspace-timeline-selection';
import type { WorkspaceTimelineExportRangeMode } from '../_lib/workspace-timeline-render';
import type { WorkspaceTimelineItem } from '../_lib/workspace-types';
import type { WorkspaceEditorSurface } from '../_state/workspace-state';

type UseWorkspaceSelectionActionsParams = {
  setActiveEditorSurface: Dispatch<SetStateAction<WorkspaceEditorSurface>>;
  setExportRangeMode: Dispatch<SetStateAction<WorkspaceTimelineExportRangeMode>>;
  setIsCanvasInspectorOpen: Dispatch<SetStateAction<boolean>>;
  setInspectedProjectAssetId: Dispatch<SetStateAction<string | null>>;
  setInspectedSequenceId: Dispatch<SetStateAction<string | null>>;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  setSelectedTimelineItemId: Dispatch<SetStateAction<string | null>>;
  setSelectedTimelineItemIds: Dispatch<SetStateAction<string[]>>;
  timelineItemsRef: MutableRefObject<WorkspaceTimelineItem[]>;
};

export function useWorkspaceSelectionActions({
  setActiveEditorSurface,
  setExportRangeMode,
  setIsCanvasInspectorOpen,
  setInspectedProjectAssetId,
  setInspectedSequenceId,
  setSelectedNodeId,
  setSelectedTimelineItemId,
  setSelectedTimelineItemIds,
  timelineItemsRef,
}: UseWorkspaceSelectionActionsParams): {
  applyDefaultTimelineSelection: (items: WorkspaceTimelineItem[]) => void;
  applyTimelineSelection: (itemIds: string[]) => void;
  handleCanvasInteraction: () => void;
  handleClearProjectMediaInspector: () => void;
  handleClearSequenceInspector: () => void;
  handleInspectCanvasNode: (nodeId: string | null) => void;
  handleCloseCanvasInspector: () => void;
  handleInspectProjectAsset: (assetId: string) => void;
  handleInspectSequence: (sequenceId: string) => void;
  handleResetExportRangeMode: () => void;
  handleSelectTimelineItem: (itemId: string, mode?: 'replace' | 'toggle' | 'focus') => void;
  handleSelectTimelineItems: (itemIds: string[]) => void;
  handleSelectedCanvasNodeChange: (nodeId: string | null) => void;
  handleSyncSelectedCanvasNode: (nodeId: string | null) => void;
} {
  const lastInspectedCanvasNodeIdRef = useRef<string | null>(null);

  const handleResetExportRangeMode = useCallback(() => {
    setExportRangeMode('sequence');
  }, [setExportRangeMode]);

  const applyTimelineSelection = useCallback(
    (itemIds: string[]) => {
      const nextItemIds = uniqueTimelineSelectionIds(itemIds);
      setSelectedTimelineItemIds(nextItemIds);
      setSelectedTimelineItemId(nextItemIds.at(-1) ?? null);
    },
    [setSelectedTimelineItemId, setSelectedTimelineItemIds]
  );

  const applyDefaultTimelineSelection = useCallback(
    (items: WorkspaceTimelineItem[]) => {
      applyTimelineSelection(defaultTimelineSelectionIds(items));
    },
    [applyTimelineSelection]
  );

  const handleSelectTimelineItem = useCallback(
    (itemId: string, mode: 'replace' | 'toggle' | 'focus' = 'replace') => {
      setActiveEditorSurface('timeline');
      setInspectedProjectAssetId(null);
      setInspectedSequenceId(null);
      setSelectedTimelineItemIds((current) => {
        if (mode === 'focus') {
          const focusedItem = timelineItemsRef.current.find((item) => item.id === itemId);
          const focusedGroupId = focusedItem?.linkedGroupId ?? null;
          const isAlreadyInSelection = current.some((currentItemId) => {
            if (currentItemId === itemId) return true;
            if (!focusedGroupId) return false;
            return timelineItemsRef.current.find((item) => item.id === currentItemId)?.linkedGroupId === focusedGroupId;
          });
          const nextItemIds = isAlreadyInSelection ? current : [itemId];
          setSelectedTimelineItemId(itemId);
          return nextItemIds;
        }
        if (mode === 'toggle') {
          const nextItemIds = current.includes(itemId)
            ? current.filter((candidateId) => candidateId !== itemId)
            : [...current, itemId];
          setSelectedTimelineItemId(nextItemIds.at(-1) ?? null);
          return nextItemIds;
        }
        setSelectedTimelineItemId(itemId);
        return [itemId];
      });
    },
    [setActiveEditorSurface, setInspectedProjectAssetId, setInspectedSequenceId, setSelectedTimelineItemId, setSelectedTimelineItemIds, timelineItemsRef]
  );

  const handleSelectTimelineItems = useCallback(
    (itemIds: string[]) => {
      setActiveEditorSurface('timeline');
      if (itemIds.length) {
        setInspectedProjectAssetId(null);
        setInspectedSequenceId(null);
      }
      applyTimelineSelection(itemIds);
    },
    [applyTimelineSelection, setActiveEditorSurface, setInspectedProjectAssetId, setInspectedSequenceId]
  );

  const handleInspectSequence = useCallback(
    (sequenceId: string) => {
      setActiveEditorSurface('timeline');
      setInspectedProjectAssetId(null);
      setInspectedSequenceId(sequenceId);
    },
    [setActiveEditorSurface, setInspectedProjectAssetId, setInspectedSequenceId]
  );

  const handleInspectProjectAsset = useCallback(
    (assetId: string) => {
      setActiveEditorSurface('timeline');
      setInspectedProjectAssetId(assetId);
      setInspectedSequenceId(null);
    },
    [setActiveEditorSurface, setInspectedProjectAssetId, setInspectedSequenceId]
  );

  const handleClearProjectMediaInspector = useCallback(() => {
    setInspectedProjectAssetId(null);
    setInspectedSequenceId(null);
  }, [setInspectedProjectAssetId, setInspectedSequenceId]);

  const handleClearSequenceInspector = useCallback(() => {
    setInspectedSequenceId(null);
  }, [setInspectedSequenceId]);

  const handleCanvasInteraction = useCallback(() => {
    setActiveEditorSurface('canvas');
    setInspectedProjectAssetId(null);
    setInspectedSequenceId(null);
  }, [setActiveEditorSurface, setInspectedProjectAssetId, setInspectedSequenceId]);

  const handleSelectedCanvasNodeChange = useCallback(
    (nodeId: string | null) => {
      setActiveEditorSurface('canvas');
      setInspectedProjectAssetId(null);
      setInspectedSequenceId(null);
      setSelectedNodeId(nodeId);
      if (!nodeId) setIsCanvasInspectorOpen(false);
    },
    [setActiveEditorSurface, setInspectedProjectAssetId, setInspectedSequenceId, setIsCanvasInspectorOpen, setSelectedNodeId]
  );

  const handleSyncSelectedCanvasNode = useCallback(
    (nodeId: string | null) => {
      setSelectedNodeId(nodeId);
      if (!nodeId) setIsCanvasInspectorOpen(false);
    },
    [setIsCanvasInspectorOpen, setSelectedNodeId]
  );

  const handleInspectCanvasNode = useCallback(
    (nodeId: string | null) => {
      if (nodeId) lastInspectedCanvasNodeIdRef.current = nodeId;
      setActiveEditorSurface('canvas');
      setInspectedProjectAssetId(null);
      setInspectedSequenceId(null);
      setSelectedNodeId(nodeId);
      setIsCanvasInspectorOpen(Boolean(nodeId));
    },
    [setActiveEditorSurface, setInspectedProjectAssetId, setInspectedSequenceId, setIsCanvasInspectorOpen, setSelectedNodeId]
  );

  const handleCloseCanvasInspector = useCallback(() => {
    setIsCanvasInspectorOpen(false);
    const nodeId = lastInspectedCanvasNodeIdRef.current;
    requestAnimationFrame(() => {
      if (!nodeId) return;
      const escapedNodeId = typeof CSS === 'undefined' ? nodeId : CSS.escape(nodeId);
      document.querySelector<HTMLElement>(`[data-canvas-node-inspect-button="${escapedNodeId}"]`)?.focus();
    });
  }, [setIsCanvasInspectorOpen]);

  return {
    applyDefaultTimelineSelection,
    applyTimelineSelection,
    handleCanvasInteraction,
    handleClearProjectMediaInspector,
    handleClearSequenceInspector,
    handleInspectCanvasNode,
    handleCloseCanvasInspector,
    handleInspectProjectAsset,
    handleInspectSequence,
    handleResetExportRangeMode,
    handleSelectTimelineItem,
    handleSelectTimelineItems,
    handleSelectedCanvasNodeChange,
    handleSyncSelectedCanvasNode,
  };
}
