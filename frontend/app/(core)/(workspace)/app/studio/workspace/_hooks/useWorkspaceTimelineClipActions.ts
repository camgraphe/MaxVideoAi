import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  deleteWorkspaceTimelineItem,
  linkWorkspaceTimelineSelection,
  moveWorkspaceTimelineItem,
  moveWorkspaceTimelineSelectionWithMode,
  resizeWorkspaceTimelineItem,
  splitWorkspaceTimelineItem,
  unlinkWorkspaceTimelineSelection,
  type WorkspaceTimelineTrimEdge,
  type WorkspaceTimelineTrimMode,
} from '../_lib/workspace-timeline-editing';
import {
  defaultTimelineSelectionIds,
  nextAvailableTimelineItemId,
  timelineSelectionTouchesLockedTrack,
  uniqueTimelineSelectionIds,
} from '../_lib/workspace-timeline-selection';
import type {
  WorkspaceTimelineItem,
  WorkspaceTimelineTrack,
} from '../_lib/workspace-types';
import type { WorkspaceEditorSurface } from '../_state/workspace-state';
import type { StudioCopy } from '../../_lib/studio-copy';

type UseWorkspaceTimelineClipActionsParams = {
  applyTimelineSelection: (itemIds: string[]) => void;
  commitTimelineItems: (updater: (current: WorkspaceTimelineItem[]) => WorkspaceTimelineItem[]) => void;
  handleSelectTimelineItem: (itemId: string, mode?: 'replace' | 'toggle' | 'focus') => void;
  lockedTimelineTracks: WorkspaceTimelineTrack[];
  selectedTimelineItemId: string | null;
  selectedTimelineItemIds: string[];
  setActiveEditorSurface: Dispatch<SetStateAction<WorkspaceEditorSurface>>;
  setIsTimelinePlaying: Dispatch<SetStateAction<boolean>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setPlayheadSec: Dispatch<SetStateAction<number>>;
  setSelectedTimelineItemId: Dispatch<SetStateAction<string | null>>;
  setSelectedTimelineItemIds: Dispatch<SetStateAction<string[]>>;
  setTimelinePreview: Dispatch<SetStateAction<{ items: WorkspaceTimelineItem[]; playheadSec: number } | null>>;
  studioNotices: StudioCopy['notices'];
  timelineInsertIntoClipEnabled: boolean;
  timelineItemsRef: MutableRefObject<WorkspaceTimelineItem[]>;
};

export function useWorkspaceTimelineClipActions({
  applyTimelineSelection,
  commitTimelineItems,
  handleSelectTimelineItem,
  lockedTimelineTracks,
  selectedTimelineItemId,
  selectedTimelineItemIds,
  setActiveEditorSurface,
  setIsTimelinePlaying,
  setNotice,
  setPlayheadSec,
  setSelectedTimelineItemId,
  setSelectedTimelineItemIds,
  setTimelinePreview,
  studioNotices,
  timelineInsertIntoClipEnabled,
  timelineItemsRef,
}: UseWorkspaceTimelineClipActionsParams): {
  handleCutTimelineItem: (itemId: string, splitOffsetSec?: number) => void;
  handleDeleteTimelineItem: (ripple?: boolean) => void;
  handleLinkTimelineItems: (itemIds: string[]) => void;
  handleMoveTimelineItem: (itemId: string, direction: -1 | 1) => void;
  handlePatchTimelineItem: (itemId: string, patch: Partial<WorkspaceTimelineItem>) => void;
  handlePositionTimelineItem: (itemId: string, nextStartSec: number, nextTrack?: WorkspaceTimelineTrack, itemIds?: string[]) => void;
  handleResizeTimelineItem: (itemId: string, edge: WorkspaceTimelineTrimEdge, nextStartSec: number, nextDurationSec: number, mode: WorkspaceTimelineTrimMode) => void;
  handleTimelinePreviewItemsChange: (items: WorkspaceTimelineItem[] | null, previewSec: number | null) => void;
  handleUnlinkTimelineItems: (itemIds: string[]) => void;
} {
  const handleMoveTimelineItem = useCallback(
    (itemId: string, direction: -1 | 1) => {
      setActiveEditorSurface('timeline');
      if (timelineSelectionTouchesLockedTrack(timelineItemsRef.current, [itemId], lockedTimelineTracks)) {
        setNotice(studioNotices.unlockBeforeMoving);
        return;
      }
      handleSelectTimelineItem(itemId, 'focus');
      commitTimelineItems((current) => moveWorkspaceTimelineItem(current, itemId, direction));
    },
    [commitTimelineItems, handleSelectTimelineItem, lockedTimelineTracks, setActiveEditorSurface, setNotice, studioNotices.unlockBeforeMoving, timelineItemsRef]
  );

  const handleCutTimelineItem = useCallback(
    (itemId: string, splitOffsetSec?: number) => {
      setActiveEditorSurface('timeline');
      if (timelineSelectionTouchesLockedTrack(timelineItemsRef.current, [itemId], lockedTimelineTracks)) {
        setNotice(studioNotices.unlockBeforeCutting);
        return;
      }
      const currentItems = timelineItemsRef.current;
      const currentItem = currentItems.find((item) => item.id === itemId);
      const nextSelectedItemId = currentItem && currentItem.durationSec >= 2
        ? nextAvailableTimelineItemId(`${itemId}-split`, currentItems)
        : itemId;
      applyTimelineSelection([nextSelectedItemId]);
      setIsTimelinePlaying(false);
      commitTimelineItems((current) => splitWorkspaceTimelineItem(current, itemId, splitOffsetSec));
    },
    [
      applyTimelineSelection,
      commitTimelineItems,
      lockedTimelineTracks,
      setActiveEditorSurface,
      setIsTimelinePlaying,
      setNotice,
      studioNotices.unlockBeforeCutting,
      timelineItemsRef,
    ]
  );

  const handlePositionTimelineItem = useCallback(
    (itemId: string, nextStartSec: number, nextTrack?: WorkspaceTimelineTrack, itemIds?: string[]) => {
      setActiveEditorSurface('timeline');
      const nextSelectedItemIds = itemIds?.length ? uniqueTimelineSelectionIds(itemIds) : [itemId];
      const currentItems = timelineItemsRef.current;
      if ((nextTrack && lockedTimelineTracks.includes(nextTrack)) || timelineSelectionTouchesLockedTrack(currentItems, nextSelectedItemIds, lockedTimelineTracks)) {
        setNotice(studioNotices.unlockBeforeMoving);
        setIsTimelinePlaying(false);
        return;
      }
      const nextItems = moveWorkspaceTimelineSelectionWithMode({
        items: currentItems,
        itemIds: nextSelectedItemIds,
        anchorItemId: itemId,
        nextStartSec,
        nextTrack,
        mode: 'insert',
        idSeed: Date.now().toString(36),
        allowInsertIntoClip: timelineInsertIntoClipEnabled,
      });
      const nextAnchorItem = nextItems.find((item) => item.id === itemId);
      setSelectedTimelineItemIds(nextSelectedItemIds);
      setSelectedTimelineItemId(itemId);
      setPlayheadSec(nextAnchorItem?.startSec ?? nextStartSec);
      setIsTimelinePlaying(false);
      commitTimelineItems(() => nextItems);
    },
    [
      commitTimelineItems,
      lockedTimelineTracks,
      setActiveEditorSurface,
      setIsTimelinePlaying,
      setNotice,
      setPlayheadSec,
      setSelectedTimelineItemId,
      setSelectedTimelineItemIds,
      studioNotices.unlockBeforeMoving,
      timelineInsertIntoClipEnabled,
      timelineItemsRef,
    ]
  );

  const handleResizeTimelineItem = useCallback(
    (itemId: string, edge: WorkspaceTimelineTrimEdge, nextStartSec: number, nextDurationSec: number, mode: WorkspaceTimelineTrimMode) => {
      setActiveEditorSurface('timeline');
      if (timelineSelectionTouchesLockedTrack(timelineItemsRef.current, [itemId], lockedTimelineTracks)) {
        setNotice(studioNotices.unlockBeforeTrimming);
        return;
      }
      applyTimelineSelection([itemId]);
      setPlayheadSec(nextStartSec);
      setIsTimelinePlaying(false);
      commitTimelineItems((current) =>
        resizeWorkspaceTimelineItem({
          items: current,
          itemId,
          edge,
          nextStartSec,
          nextDurationSec,
          mode,
        })
      );
    },
    [
      applyTimelineSelection,
      commitTimelineItems,
      lockedTimelineTracks,
      setActiveEditorSurface,
      setIsTimelinePlaying,
      setNotice,
      setPlayheadSec,
      studioNotices.unlockBeforeTrimming,
      timelineItemsRef,
    ]
  );

  const handleTimelinePreviewItemsChange = useCallback(
    (items: WorkspaceTimelineItem[] | null, previewSec: number | null) => {
      setTimelinePreview(items && previewSec !== null ? { items, playheadSec: previewSec } : null);
    },
    [setTimelinePreview]
  );

  const handleUnlinkTimelineItems = useCallback(
    (itemIds: string[]) => {
      if (!itemIds.length) return;
      setActiveEditorSurface('timeline');
      if (timelineSelectionTouchesLockedTrack(timelineItemsRef.current, itemIds, lockedTimelineTracks)) {
        setNotice(studioNotices.unlockBeforeUnlinking);
        return;
      }
      setIsTimelinePlaying(false);
      commitTimelineItems((current) => unlinkWorkspaceTimelineSelection(current, itemIds));
      applyTimelineSelection(itemIds);
      setNotice(studioNotices.selectedClipsUnlinked);
    },
    [
      applyTimelineSelection,
      commitTimelineItems,
      lockedTimelineTracks,
      setActiveEditorSurface,
      setIsTimelinePlaying,
      setNotice,
      studioNotices.unlockBeforeUnlinking,
      studioNotices.selectedClipsUnlinked,
      timelineItemsRef,
    ]
  );

  const handleLinkTimelineItems = useCallback(
    (itemIds: string[]) => {
      if (itemIds.length < 2) return;
      setActiveEditorSurface('timeline');
      if (timelineSelectionTouchesLockedTrack(timelineItemsRef.current, itemIds, lockedTimelineTracks)) {
        setNotice(studioNotices.unlockBeforeLinking);
        return;
      }
      setIsTimelinePlaying(false);
      commitTimelineItems((current) => linkWorkspaceTimelineSelection(current, itemIds, `manual-link-${Date.now().toString(36)}`));
      applyTimelineSelection(itemIds);
      setNotice(studioNotices.selectedClipsLinked);
    },
    [
      applyTimelineSelection,
      commitTimelineItems,
      lockedTimelineTracks,
      setActiveEditorSurface,
      setIsTimelinePlaying,
      setNotice,
      studioNotices.unlockBeforeLinking,
      studioNotices.selectedClipsLinked,
      timelineItemsRef,
    ]
  );

  const handlePatchTimelineItem = useCallback(
    (itemId: string, patch: Partial<WorkspaceTimelineItem>) => {
      setActiveEditorSurface('timeline');
      commitTimelineItems((current) => current.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));
    },
    [commitTimelineItems, setActiveEditorSurface]
  );

  const handleDeleteTimelineItem = useCallback(
    (ripple = false) => {
      setActiveEditorSurface('timeline');
      const currentItems = timelineItemsRef.current;
      const selectedItemIds = selectedTimelineItemIds.length
        ? selectedTimelineItemIds
        : selectedTimelineItemId
          ? [selectedTimelineItemId]
          : [];
      if (!selectedItemIds.length) return;
      if (timelineSelectionTouchesLockedTrack(currentItems, selectedItemIds, lockedTimelineTracks)) {
        setNotice(studioNotices.unlockBeforeDeleting);
        return;
      }
      const selectedItem = currentItems.find((item) => item.id === selectedItemIds[0]);
      const nextItems = selectedItemIds.reduce(
        (nextTimelineItems, itemId) => deleteWorkspaceTimelineItem(nextTimelineItems, itemId, { ripple }),
        currentItems
      );
      commitTimelineItems(() => nextItems);
      applyTimelineSelection(defaultTimelineSelectionIds(nextItems));
      setPlayheadSec(selectedItem?.startSec ?? 0);
      setIsTimelinePlaying(false);
    },
    [
      applyTimelineSelection,
      commitTimelineItems,
      lockedTimelineTracks,
      selectedTimelineItemId,
      selectedTimelineItemIds,
      setActiveEditorSurface,
      setIsTimelinePlaying,
      setNotice,
      setPlayheadSec,
      studioNotices.unlockBeforeDeleting,
      timelineItemsRef,
    ]
  );

  return {
    handleCutTimelineItem,
    handleDeleteTimelineItem,
    handleLinkTimelineItems,
    handleMoveTimelineItem,
    handlePatchTimelineItem,
    handlePositionTimelineItem,
    handleResizeTimelineItem,
    handleTimelinePreviewItemsChange,
    handleUnlinkTimelineItems,
  };
}
