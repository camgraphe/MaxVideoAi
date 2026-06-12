'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type {
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
} from '../_lib/workspace-types';
import {
  TIMELINE_HISTORY_LIMIT,
  type CanvasGraphHistorySnapshot,
  type CanvasGraphHistoryState,
} from '../_state/workspace-state';

const CANVAS_HISTORY_GESTURE_COMMIT_DELAY_MS = 180;

type CanvasGraphUpdater = (current: CanvasGraphHistorySnapshot) => CanvasGraphHistorySnapshot;

type CommitCanvasGraphOptions = {
  history?: boolean;
  gesture?: boolean;
};

type UseWorkspaceCanvasHistoryOptions = {
  edgesRef: MutableRefObject<WorkspaceGraphEdge[]>;
  nodesRef: MutableRefObject<WorkspaceGraphNode[]>;
  setEdges: Dispatch<SetStateAction<WorkspaceGraphEdge[]>>;
  setNodes: Dispatch<SetStateAction<WorkspaceGraphNode[]>>;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
};

function cloneCanvasGraphSnapshot(snapshot: CanvasGraphHistorySnapshot): CanvasGraphHistorySnapshot {
  return {
    edges: snapshot.edges,
    nodes: snapshot.nodes,
  };
}

function canvasGraphSnapshotsEqual(left: CanvasGraphHistorySnapshot, right: CanvasGraphHistorySnapshot): boolean {
  return JSON.stringify(left.nodes) === JSON.stringify(right.nodes) && JSON.stringify(left.edges) === JSON.stringify(right.edges);
}

export function useWorkspaceCanvasHistory({
  edgesRef,
  nodesRef,
  setEdges,
  setNodes,
  setSelectedNodeId,
}: UseWorkspaceCanvasHistoryOptions): {
  canvasHistory: CanvasGraphHistoryState;
  commitCanvasGraph: (updater: CanvasGraphUpdater, options?: CommitCanvasGraphOptions) => void;
  redoCanvas: () => void;
  resetCanvasHistory: () => void;
  undoCanvas: () => void;
} {
  const [canvasHistory, setCanvasHistory] = useState<CanvasGraphHistoryState>({ past: [], future: [] });
  const pendingGestureSnapshotRef = useRef<CanvasGraphHistorySnapshot | null>(null);
  const gestureCommitTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const currentSnapshot = useCallback((): CanvasGraphHistorySnapshot => ({
    edges: edgesRef.current,
    nodes: nodesRef.current,
  }), [edgesRef, nodesRef]);

  const applySnapshot = useCallback((snapshot: CanvasGraphHistorySnapshot) => {
    nodesRef.current = snapshot.nodes;
    edgesRef.current = snapshot.edges;
    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);
  }, [edgesRef, nodesRef, setEdges, setNodes]);

  const clearGestureCommitTimer = useCallback(() => {
    if (gestureCommitTimerRef.current === null) return;
    window.clearTimeout(gestureCommitTimerRef.current);
    gestureCommitTimerRef.current = null;
  }, []);

  const flushGestureHistory = useCallback(() => {
    clearGestureCommitTimer();
    const snapshot = pendingGestureSnapshotRef.current;
    if (!snapshot) return;
    pendingGestureSnapshotRef.current = null;
    const current = currentSnapshot();
    if (canvasGraphSnapshotsEqual(snapshot, current)) return;
    setCanvasHistory((history) => ({
      past: [...history.past, cloneCanvasGraphSnapshot(snapshot)].slice(-TIMELINE_HISTORY_LIMIT),
      future: [],
    }));
  }, [clearGestureCommitTimer, currentSnapshot]);

  const scheduleGestureHistoryFlush = useCallback(() => {
    clearGestureCommitTimer();
    gestureCommitTimerRef.current = window.setTimeout(flushGestureHistory, CANVAS_HISTORY_GESTURE_COMMIT_DELAY_MS);
  }, [clearGestureCommitTimer, flushGestureHistory]);

  const commitCanvasGraph = useCallback((updater: CanvasGraphUpdater, options: CommitCanvasGraphOptions = {}) => {
    const before = currentSnapshot();
    const next = updater(before);
    if (canvasGraphSnapshotsEqual(before, next)) return;

    const shouldTrackHistory = options.history !== false;
    if (shouldTrackHistory && options.gesture) {
      if (!pendingGestureSnapshotRef.current) {
        pendingGestureSnapshotRef.current = cloneCanvasGraphSnapshot(before);
      }
      scheduleGestureHistoryFlush();
    } else if (shouldTrackHistory) {
      flushGestureHistory();
      setCanvasHistory((history) => ({
        past: [...history.past, cloneCanvasGraphSnapshot(before)].slice(-TIMELINE_HISTORY_LIMIT),
        future: [],
      }));
    }

    applySnapshot(next);
  }, [applySnapshot, currentSnapshot, flushGestureHistory, scheduleGestureHistoryFlush]);

  const resetCanvasHistory = useCallback(() => {
    clearGestureCommitTimer();
    pendingGestureSnapshotRef.current = null;
    setCanvasHistory({ past: [], future: [] });
  }, [clearGestureCommitTimer]);

  const undoCanvas = useCallback(() => {
    flushGestureHistory();
    setCanvasHistory((history) => {
      const previous = history.past.at(-1);
      if (!previous) return history;
      const current = currentSnapshot();
      applySnapshot(previous);
      setSelectedNodeId(null);
      return {
        past: history.past.slice(0, -1),
        future: [cloneCanvasGraphSnapshot(current), ...history.future].slice(0, TIMELINE_HISTORY_LIMIT),
      };
    });
  }, [applySnapshot, currentSnapshot, flushGestureHistory, setSelectedNodeId]);

  const redoCanvas = useCallback(() => {
    flushGestureHistory();
    setCanvasHistory((history) => {
      const next = history.future[0];
      if (!next) return history;
      const current = currentSnapshot();
      applySnapshot(next);
      setSelectedNodeId(null);
      return {
        past: [...history.past, cloneCanvasGraphSnapshot(current)].slice(-TIMELINE_HISTORY_LIMIT),
        future: history.future.slice(1),
      };
    });
  }, [applySnapshot, currentSnapshot, flushGestureHistory, setSelectedNodeId]);

  useEffect(() => {
    return () => {
      clearGestureCommitTimer();
    };
  }, [clearGestureCommitTimer]);

  return {
    canvasHistory,
    commitCanvasGraph,
    redoCanvas,
    resetCanvasHistory,
    undoCanvas,
  };
}
