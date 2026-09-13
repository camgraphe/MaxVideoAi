'use client';

import { useCallback, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { normalizeWorkspaceTimelineIdentities } from '../_lib/workspace-timeline-editing';
import type { WorkspaceTimelineItem } from '../_lib/workspace-types';
import {
  TIMELINE_HISTORY_LIMIT,
  type TimelineHistoryState,
} from '../_state/workspace-state';

type UseWorkspaceTimelineHistoryOptions = {
  timelineItemsRef: MutableRefObject<WorkspaceTimelineItem[]>;
  setTimelineItems: Dispatch<SetStateAction<WorkspaceTimelineItem[]>>;
  selectDefaultItems: (items: WorkspaceTimelineItem[]) => void;
  stopPlayback: () => void;
};

export function useWorkspaceTimelineHistory({
  timelineItemsRef,
  setTimelineItems,
  selectDefaultItems,
  stopPlayback,
}: UseWorkspaceTimelineHistoryOptions): {
  timelineHistory: TimelineHistoryState;
  commitTimelineItems: (updater: (current: WorkspaceTimelineItem[]) => WorkspaceTimelineItem[]) => void;
  resetTimelineHistory: () => void;
  undoTimeline: () => void;
  redoTimeline: () => void;
} {
  const [timelineHistory, setTimelineHistory] = useState<TimelineHistoryState>({ past: [], future: [] });

  const commitTimelineItems = useCallback((updater: (current: WorkspaceTimelineItem[]) => WorkspaceTimelineItem[]) => {
    setTimelineItems((current) => {
      const nextItems = normalizeWorkspaceTimelineIdentities(updater(current));
      if (nextItems === current) return current;
      timelineItemsRef.current = nextItems;
      setTimelineHistory((history) => ({
        past: [...history.past, current].slice(-TIMELINE_HISTORY_LIMIT),
        future: [],
      }));
      return nextItems;
    });
  }, [setTimelineItems, timelineItemsRef]);

  const resetTimelineHistory = useCallback(() => {
    setTimelineHistory({ past: [], future: [] });
  }, []);

  const undoTimeline = useCallback(() => {
    setTimelineHistory((history) => {
      const previousItems = history.past.at(-1);
      if (!previousItems) return history;
      const currentItems = timelineItemsRef.current;
      timelineItemsRef.current = previousItems;
      setTimelineItems(previousItems);
      selectDefaultItems(previousItems);
      stopPlayback();
      return {
        past: history.past.slice(0, -1),
        future: [currentItems, ...history.future].slice(0, TIMELINE_HISTORY_LIMIT),
      };
    });
  }, [selectDefaultItems, setTimelineItems, stopPlayback, timelineItemsRef]);

  const redoTimeline = useCallback(() => {
    setTimelineHistory((history) => {
      const nextItems = history.future[0];
      if (!nextItems) return history;
      const currentItems = timelineItemsRef.current;
      timelineItemsRef.current = nextItems;
      setTimelineItems(nextItems);
      selectDefaultItems(nextItems);
      stopPlayback();
      return {
        past: [...history.past, currentItems].slice(-TIMELINE_HISTORY_LIMIT),
        future: history.future.slice(1),
      };
    });
  }, [selectDefaultItems, setTimelineItems, stopPlayback, timelineItemsRef]);

  return {
    timelineHistory,
    commitTimelineItems,
    resetTimelineHistory,
    undoTimeline,
    redoTimeline,
  };
}
