import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { WorkspaceTimelineItem } from '../_lib/workspace-types';
import { defaultTimelineSelectionIds } from '../_lib/workspace-timeline-selection';

export function useWorkspaceTimelineSelectionSync(params: {
  applyTimelineSelection: (itemIds: string[]) => void;
  selectedTimelineItemId: string | null;
  selectedTimelineItemIds: string[];
  setIsTimelinePlaying: Dispatch<SetStateAction<boolean>>;
  setSelectedTimelineItemId: Dispatch<SetStateAction<string | null>>;
  timelineItems: WorkspaceTimelineItem[];
  timelineItemsRef: MutableRefObject<WorkspaceTimelineItem[]>;
}) {
  const {
    applyTimelineSelection,
    selectedTimelineItemId,
    selectedTimelineItemIds,
    setIsTimelinePlaying,
    setSelectedTimelineItemId,
    timelineItems,
    timelineItemsRef,
  } = params;

  useEffect(() => {
    timelineItemsRef.current = timelineItems;
  }, [timelineItems, timelineItemsRef]);

  useEffect(() => {
    if (!timelineItems.length) {
      if (selectedTimelineItemId || selectedTimelineItemIds.length) {
        applyTimelineSelection([]);
      }
      setIsTimelinePlaying(false);
      return;
    }
    const existingItemIds = new Set(timelineItems.map((item) => item.id));
    const currentSelection = selectedTimelineItemIds.filter((itemId) => existingItemIds.has(itemId));
    const nextSelection = selectedTimelineItemIds.length
      ? currentSelection.length
        ? currentSelection
        : defaultTimelineSelectionIds(timelineItems)
      : [];
    if (
      nextSelection.length !== selectedTimelineItemIds.length ||
      nextSelection.some((itemId, index) => itemId !== selectedTimelineItemIds[index])
    ) {
      applyTimelineSelection(nextSelection);
      return;
    }
    const nextSelectedItemId = nextSelection.at(-1) ?? null;
    if (selectedTimelineItemId !== nextSelectedItemId) {
      setSelectedTimelineItemId(nextSelectedItemId);
    }
  }, [
    applyTimelineSelection,
    selectedTimelineItemId,
    selectedTimelineItemIds,
    setIsTimelinePlaying,
    setSelectedTimelineItemId,
    timelineItems,
  ]);
}
