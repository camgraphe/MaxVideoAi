'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type {
  WorkspaceCanvasGuideState,
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
} from '../_lib/workspace-types';
import { reconcileWorkspaceCanvasGuideState } from '../_lib/workspace-guide-state';
import {
  TIMELINE_HISTORY_LIMIT,
  type CanvasHistorySnapshot,
  type CanvasGraphHistorySnapshot,
  type CanvasGraphHistoryState,
} from '../_state/workspace-state';

const CANVAS_HISTORY_GESTURE_COMMIT_DELAY_MS = 180;

export type CanvasGraphUpdater = (current: CanvasGraphHistorySnapshot) => CanvasGraphHistorySnapshot;

export type CommitCanvasGraphOptions = {
  history?: boolean;
  gesture?: boolean;
};

export type CommitCanvasGuideState = (
  updater: (current: WorkspaceCanvasGuideState) => WorkspaceCanvasGuideState,
  options?: CommitCanvasGraphOptions,
) => void;

type UseWorkspaceCanvasHistoryOptions = {
  edgesRef: MutableRefObject<WorkspaceGraphEdge[]>;
  guideStateRef: MutableRefObject<WorkspaceCanvasGuideState>;
  nodesRef: MutableRefObject<WorkspaceGraphNode[]>;
  setEdges: Dispatch<SetStateAction<WorkspaceGraphEdge[]>>;
  setGuideState: Dispatch<SetStateAction<WorkspaceCanvasGuideState>>;
  setNodes: Dispatch<SetStateAction<WorkspaceGraphNode[]>>;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
};

function cloneCanvasGraphSnapshot(snapshot: CanvasGraphHistorySnapshot): CanvasGraphHistorySnapshot {
  return {
    edges: snapshot.edges,
    nodes: snapshot.nodes,
  };
}

function cloneCanvasState(snapshot: CanvasHistorySnapshot): CanvasHistorySnapshot {
  return {
    ...cloneCanvasGraphSnapshot(snapshot),
    guideState: reconcileWorkspaceCanvasGuideState(snapshot.guideState, snapshot.nodes),
  };
}

function canvasStateSnapshotsEqual(left: CanvasHistorySnapshot, right: CanvasHistorySnapshot): boolean {
  return JSON.stringify(left.nodes) === JSON.stringify(right.nodes)
    && JSON.stringify(left.edges) === JSON.stringify(right.edges)
    && JSON.stringify({ ...left.guideState, hidden: false }) === JSON.stringify({ ...right.guideState, hidden: false });
}

function restoreCanvasHistorySnapshot(
  snapshot: CanvasHistorySnapshot,
  liveGuideState: WorkspaceCanvasGuideState,
): CanvasHistorySnapshot {
  const restored = cloneCanvasState(snapshot);
  return {
    ...restored,
    guideState: {
      ...restored.guideState,
      hidden: liveGuideState.hidden,
    },
  };
}

export type WorkspaceCanvasHistoryController = {
  canvasHistory: () => CanvasGraphHistoryState;
  commitCanvasGuideState: CommitCanvasGuideState;
  commitCanvasGraph: (updater: CanvasGraphUpdater, options?: CommitCanvasGraphOptions) => void;
  commitCanvasState: (
    updater: (current: CanvasHistorySnapshot) => CanvasHistorySnapshot,
    options?: CommitCanvasGraphOptions,
  ) => void;
  dispose: () => void;
  redoCanvas: () => void;
  resetCanvasHistory: () => void;
  undoCanvas: () => void;
};

export function createWorkspaceCanvasHistoryController(params: {
  applySnapshot: (snapshot: CanvasHistorySnapshot) => void;
  getCurrentSnapshot: () => CanvasHistorySnapshot;
  onHistoryChange?: (history: CanvasGraphHistoryState) => void;
  onSnapshotRestored?: () => void;
}): WorkspaceCanvasHistoryController {
  const {
    applySnapshot,
    getCurrentSnapshot,
    onHistoryChange,
    onSnapshotRestored,
  } = params;
  let history: CanvasGraphHistoryState = { past: [], future: [] };
  let pendingGestureSnapshot: CanvasHistorySnapshot | null = null;
  let gestureCommitTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

  const updateHistory = (next: CanvasGraphHistoryState) => {
    history = next;
    onHistoryChange?.(next);
  };

  const clearGestureCommitTimer = () => {
    if (gestureCommitTimer === null) return;
    globalThis.clearTimeout(gestureCommitTimer);
    gestureCommitTimer = null;
  };

  const applyHistoricalSnapshot = (snapshot: CanvasHistorySnapshot) => {
    const liveGuideState = getCurrentSnapshot().guideState;
    applySnapshot(restoreCanvasHistorySnapshot(snapshot, liveGuideState));
    onSnapshotRestored?.();
  };

  const flushGestureHistory = () => {
    clearGestureCommitTimer();
    const snapshot = pendingGestureSnapshot;
    if (!snapshot) return;
    pendingGestureSnapshot = null;
    if (canvasStateSnapshotsEqual(snapshot, getCurrentSnapshot())) return;
    updateHistory({
      past: [...history.past, cloneCanvasState(snapshot)].slice(-TIMELINE_HISTORY_LIMIT),
      future: [],
    });
  };

  const scheduleGestureHistoryFlush = () => {
    clearGestureCommitTimer();
    gestureCommitTimer = globalThis.setTimeout(flushGestureHistory, CANVAS_HISTORY_GESTURE_COMMIT_DELAY_MS);
  };

  const commitCanvasState: WorkspaceCanvasHistoryController['commitCanvasState'] = (updater, options = {}) => {
    const before = getCurrentSnapshot();
    const next = updater(before);
    if (canvasStateSnapshotsEqual(before, next)) return;

    if (options.history !== false && options.gesture) {
      if (!pendingGestureSnapshot) {
        pendingGestureSnapshot = cloneCanvasState(before);
      }
      scheduleGestureHistoryFlush();
    } else if (options.history !== false) {
      flushGestureHistory();
      updateHistory({
        past: [...history.past, cloneCanvasState(before)].slice(-TIMELINE_HISTORY_LIMIT),
        future: [],
      });
    }

    applySnapshot(next);
  };

  const commitCanvasGraph: WorkspaceCanvasHistoryController['commitCanvasGraph'] = (updater, options = {}) => {
    commitCanvasState((current) => {
      const nextGraph = updater({ edges: current.edges, nodes: current.nodes });
      return {
        ...nextGraph,
        guideState: reconcileWorkspaceCanvasGuideState(current.guideState, nextGraph.nodes),
      };
    }, options);
  };

  const commitCanvasGuideState: CommitCanvasGuideState = (updater, options = {}) => {
    commitCanvasState((current) => ({
      ...current,
      guideState: updater(current.guideState),
    }), options);
  };

  const resetCanvasHistory = () => {
    clearGestureCommitTimer();
    pendingGestureSnapshot = null;
    updateHistory({ past: [], future: [] });
  };

  const undoCanvas = () => {
    flushGestureHistory();
    const previous = history.past.at(-1);
    if (!previous) return;
    const current = getCurrentSnapshot();
    applyHistoricalSnapshot(previous);
    updateHistory({
      past: history.past.slice(0, -1),
      future: [cloneCanvasState(current), ...history.future].slice(0, TIMELINE_HISTORY_LIMIT),
    });
  };

  const redoCanvas = () => {
    flushGestureHistory();
    const next = history.future[0];
    if (!next) return;
    const current = getCurrentSnapshot();
    applyHistoricalSnapshot(next);
    updateHistory({
      past: [...history.past, cloneCanvasState(current)].slice(-TIMELINE_HISTORY_LIMIT),
      future: history.future.slice(1),
    });
  };

  return {
    canvasHistory: () => history,
    commitCanvasGuideState,
    commitCanvasGraph,
    commitCanvasState,
    dispose: clearGestureCommitTimer,
    redoCanvas,
    resetCanvasHistory,
    undoCanvas,
  };
}

export function useWorkspaceCanvasHistory({
  edgesRef,
  guideStateRef,
  nodesRef,
  setEdges,
  setGuideState,
  setNodes,
  setSelectedNodeId,
}: UseWorkspaceCanvasHistoryOptions): {
  canvasHistory: CanvasGraphHistoryState;
  commitCanvasGuideState: CommitCanvasGuideState;
  commitCanvasGraph: (updater: CanvasGraphUpdater, options?: CommitCanvasGraphOptions) => void;
  commitCanvasState: (
    updater: (current: CanvasHistorySnapshot) => CanvasHistorySnapshot,
    options?: CommitCanvasGraphOptions,
  ) => void;
  redoCanvas: () => void;
  resetCanvasHistory: () => void;
  undoCanvas: () => void;
} {
  const [canvasHistory, setCanvasHistory] = useState<CanvasGraphHistoryState>({ past: [], future: [] });

  const currentSnapshot = useCallback((): CanvasHistorySnapshot => ({
    edges: edgesRef.current,
    guideState: guideStateRef.current,
    nodes: nodesRef.current,
  }), [edgesRef, guideStateRef, nodesRef]);

  const applySnapshot = useCallback((snapshot: CanvasHistorySnapshot) => {
    nodesRef.current = snapshot.nodes;
    edgesRef.current = snapshot.edges;
    guideStateRef.current = snapshot.guideState;
    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);
    setGuideState(snapshot.guideState);
  }, [edgesRef, guideStateRef, nodesRef, setEdges, setGuideState, setNodes]);

  const historyControllerRef = useRef<WorkspaceCanvasHistoryController | null>(null);
  if (!historyControllerRef.current) {
    historyControllerRef.current = createWorkspaceCanvasHistoryController({
      getCurrentSnapshot: currentSnapshot,
      applySnapshot,
      onHistoryChange: setCanvasHistory,
      onSnapshotRestored: () => setSelectedNodeId(null),
    });
  }
  const historyController = historyControllerRef.current;

  useEffect(() => {
    return () => {
      historyController.dispose();
    };
  }, [historyController]);

  return {
    canvasHistory,
    commitCanvasGuideState: historyController.commitCanvasGuideState,
    commitCanvasGraph: historyController.commitCanvasGraph,
    commitCanvasState: historyController.commitCanvasState,
    redoCanvas: historyController.redoCanvas,
    resetCanvasHistory: historyController.resetCanvasHistory,
    undoCanvas: historyController.undoCanvas,
  };
}
